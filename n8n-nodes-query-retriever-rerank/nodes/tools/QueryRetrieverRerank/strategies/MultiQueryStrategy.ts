import { BaseStrategy } from './BaseStrategy';
import { RerankingManager } from '../shared/reranking';
import type { StrategyContext, StrategyResult } from '../shared/types';

export class MultiQueryStrategy extends BaseStrategy {
	getName(): string {
		return 'multi_query';
	}

	getDescription(): string {
		return 'Generate multiple query variations, retrieve documents for each, then combine and rerank results';
	}

	async execute(input: string, context: StrategyContext): Promise<StrategyResult> {
		try {
			// Initialize debug manager
			this.initializeDebugManager('multi_query', context.config);

			const queryGenStart = Date.now();
			
			try {
				// Generate query variations using the language model
				const queryVariations = context.config.queryVariations || 3;
				const includeOriginal = context.config.includeOriginalQuery !== false;
				
				this.debugManager.setQueryDetails({ original: input });
				
				const defaultInstructions = `You are an AI language model assistant. Your task is to generate {count} different versions of the given question to retrieve relevant documents from a vector database. By generating multiple perspectives on the user question, your goal is to help overcome some of the limitations of distance-based similarity search.`;
				
				// Use custom instructions if provided, otherwise use default
				const instructions = context.config.promptTemplate?.trim() || defaultInstructions;
				
				// Build the complete prompt with hardcoded format requirements
				const queryPrompt = `${instructions}

Original question: {query}

Generate {count} alternative versions of this question that would help retrieve the most relevant documents.

IMPORTANT: Output ONLY the alternative questions, one per line, with no numbering, no explanations, no markdown formatting, and no additional text. Each line should contain exactly one complete question.

Example format:
What are the key features of this topic?
How does this concept work in practice?
What are the main benefits and applications?`
					.replace(/{count}/g, String(queryVariations))
					.replace(/{query}/g, input);
				
				const queryResponse = await context.model.invoke(queryPrompt);
				const queryResponseText = typeof queryResponse === 'string' ? queryResponse : queryResponse.content || queryResponse.text || String(queryResponse);
				
				this.debugManager.addTiming('queryGeneration', queryGenStart);
				
				// Parse the generated queries (expecting clean format: one question per line)
				const generatedQueries: string[] = [];
				const lines = queryResponseText.split('\n')
					.map((line: string) => line.trim())
					.filter((line: string) => line.length > 10 && !line.startsWith('Example') && !line.startsWith('IMPORTANT'))
					.slice(0, queryVariations);
				
				// Clean up any remaining formatting just in case
				for (let line of lines) {
					// Remove any residual numbering or formatting
					line = line.replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1').trim();
					
					if (line.length > 10) {
						generatedQueries.push(line);
					}
				}
				
				this.debugManager.setQueryDetails({ 
					variations: generatedQueries,
					includeOriginal,
					totalQueries: includeOriginal ? generatedQueries.length + 1 : generatedQueries.length
				});
				
				// Collect all queries to search with
				const queriesToSearch = includeOriginal ? [input, ...generatedQueries] : generatedQueries;
				
				// Search with each query, apply first-stage reranking, and collect top documents
				const allRerankedDocs: Array<{doc: any, source: string}> = [];
				const documentsPerQuery: number[] = [];
				const perQueryReranking: any[] = [];
				const retrievalStart = Date.now();
				
				for (let i = 0; i < queriesToSearch.length; i++) {
					const query = queriesToSearch[i];
					const isOriginal = includeOriginal && i === 0;
					
					try {
						const queryDocs = await context.vectorStore.similaritySearch(query, context.config.documentsToRetrieve);
						documentsPerQuery.push(queryDocs.length);
						
						// Apply first-stage reranking to this query's results
						if (queryDocs.length > 0) {
							try {
								// Get embeddings for this specific query
								const queryEmbedding = await context.embeddings.embedQuery(query);
								
								// Get embeddings for documents from this query
								const docTexts = queryDocs.map(doc => doc.pageContent);
								const docEmbeddings = await context.embeddings.embedDocuments(docTexts);
								
								// Calculate similarity scores
								const similarities = docEmbeddings.map(docEmbed => {
									const dotProduct = queryEmbedding.reduce((sum, a, j) => sum + a * docEmbed[j], 0);
									const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum, a) => sum + a * a, 0));
									const docMagnitude = Math.sqrt(docEmbed.reduce((sum, a) => sum + a * a, 0));
									return dotProduct / (queryMagnitude * docMagnitude);
								});
								
								// Create array with scores and original positions for detailed debugging
								const docsWithScoresAndPositions = queryDocs.map((doc, index) => ({
									doc,
									score: similarities[index],
									originalPosition: index,
									contentPreview: doc.pageContent.substring(0, 100) + (doc.pageContent.length > 100 ? '...' : '')
								}));
								
								// Sort by score (descending)
								const sortedDocsForQuery = [...docsWithScoresAndPositions].sort((a, b) => b.score - a.score);
								
								// Take top documents as specified by "Documents to Return"
								const topDocsForQuery = sortedDocsForQuery.slice(0, context.config.documentsToReturn);
								
								// Store per-query reranking details
								if (context.debugging) {
									perQueryReranking.push({
										queryIndex: i,
										query,
										isOriginal,
										totalDocuments: queryDocs.length,
										originalOrder: docsWithScoresAndPositions.map((item, index) => ({
											position: index,
											score: item.score,
											contentPreview: item.contentPreview
										})),
										rerankedOrder: sortedDocsForQuery.map((item, newIndex) => ({
											newPosition: newIndex,
											originalPosition: item.originalPosition,
											score: item.score,
											movement: newIndex - item.originalPosition,
											contentPreview: item.contentPreview
										})),
										finalSelection: topDocsForQuery.map((item, index) => ({
											finalPosition: index,
											originalPosition: item.originalPosition,
											score: item.score,
											totalMovement: index - item.originalPosition,
											contentPreview: item.contentPreview
										})),
										filteredOut: sortedDocsForQuery.slice(context.config.documentsToReturn).map((item, index) => ({
											originalPosition: item.originalPosition,
											rerankedPosition: context.config.documentsToReturn + index,
											score: item.score,
											reason: 'Below top-k threshold for this query',
											contentPreview: item.contentPreview
										})),
										effectiveness: {
											averageMovement: topDocsForQuery.reduce((sum, item, index) => 
												sum + Math.abs(index - item.originalPosition), 0) / topDocsForQuery.length,
											scoreRange: {
												highest: Math.max(...similarities),
												lowest: Math.min(...similarities),
												spread: Math.max(...similarities) - Math.min(...similarities)
											},
											topDocumentsChanged: topDocsForQuery.filter((item, index) => item.originalPosition !== index).length
										}
									});
								}
								
								// Add to collection with source tracking
								topDocsForQuery.forEach(item => {
									allRerankedDocs.push({
										doc: item.doc,
										source: isOriginal ? 'original' : `variation_${i}`
									});
								});
								
							} catch (rerankError) {
								// Fall back to taking top documents without reranking
								const fallbackDocs = queryDocs.slice(0, context.config.documentsToReturn);
								fallbackDocs.forEach(doc => {
									allRerankedDocs.push({
										doc,
										source: isOriginal ? 'original' : `variation_${i}`
									});
								});
							}
						}
						
					} catch (queryError) {
						// Continue with other queries even if one fails
					}
				}
				
				// Deduplicate documents by content
				const seenContent = new Set<string>();
				const uniqueDocs = [];
				
				for (const {doc} of allRerankedDocs) {
					const content = doc.pageContent.trim();
					if (!seenContent.has(content)) {
						seenContent.add(content);
						uniqueDocs.push(doc);
					}
				}
				
				let docs = uniqueDocs;
				
				// Add multi-query debug data
				this.debugManager.addTiming('documentRetrieval', retrievalStart);
				this.debugManager.setQueryDetails({ documentsPerQuery });
				this.debugManager.setDocumentFlow({ 
					totalRetrieved: allRerankedDocs.length,
					afterDeduplication: uniqueDocs.length
				});
				
				// Apply final reranking if we have more documents than needed
				if (docs.length > context.config.documentsToReturn) {
					const finalRerankStart = Date.now();
					try {
						// Get embeddings for the original query
						const queryEmbedding = await context.embeddings.embedQuery(input);
						
						// Get embeddings for all deduplicated documents
						const docTexts = docs.map(doc => doc.pageContent);
						const docEmbeddings = await context.embeddings.embedDocuments(docTexts);
						
						// Calculate similarity scores between original query and each document
						const similarities = docEmbeddings.map(docEmbed => {
							const dotProduct = queryEmbedding.reduce((sum, a, j) => sum + a * docEmbed[j], 0);
							const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum, a) => sum + a * a, 0));
							const docMagnitude = Math.sqrt(docEmbed.reduce((sum, a) => sum + a * a, 0));
							return dotProduct / (queryMagnitude * docMagnitude);
						});
						
						// Create array of documents with their similarity scores and positions
						const docsWithScoresAndPositions = docs.map((doc, index) => ({
							doc,
							score: similarities[index],
							preRerankPosition: index,
							contentPreview: doc.pageContent.substring(0, 100) + (doc.pageContent.length > 100 ? '...' : '')
						}));
						
						// Sort by similarity score (highest first)
						const finalSortedDocs = [...docsWithScoresAndPositions].sort((a, b) => b.score - a.score);
						
						// Take final top results
						const finalSelectedDocs = finalSortedDocs.slice(0, context.config.documentsToReturn);
						docs = finalSelectedDocs.map(item => item.doc);
						
						// Store final reranking debug information
						if (context.debugging) {
							const rerankingData: any = { perQueryDetails: perQueryReranking };
							rerankingData.multiQueryFinalRerank = {
								preRerankedOrder: docsWithScoresAndPositions.map((item, index) => ({
									position: index,
									score: item.score,
									contentPreview: item.contentPreview
								})),
								finalRerankedOrder: finalSortedDocs.map((item, newIndex) => ({
									finalPosition: newIndex,
									preRerankPosition: item.preRerankPosition,
									score: item.score,
									movement: newIndex - item.preRerankPosition,
									contentPreview: item.contentPreview
								})),
								finalSelection: finalSelectedDocs.map((item, index) => ({
									finalPosition: index,
									preRerankPosition: item.preRerankPosition,
									score: item.score,
									totalMovement: index - item.preRerankPosition,
									selected: true,
									contentPreview: item.contentPreview
								})),
								filteredOut: finalSortedDocs.slice(context.config.documentsToReturn).map((item, index) => ({
									preRerankPosition: item.preRerankPosition,
									finalRerankPosition: context.config.documentsToReturn + index,
									score: item.score,
									reason: 'Below final top-k threshold',
									contentPreview: item.contentPreview
								})),
								effectiveness: {
									averageMovement: finalSelectedDocs.reduce((sum, item, index) => 
										sum + Math.abs(index - item.preRerankPosition), 0) / finalSelectedDocs.length,
									scoreRange: {
										highest: Math.max(...similarities),
										lowest: Math.min(...similarities),
										spread: Math.max(...similarities) - Math.min(...similarities)
									},
									documentsReordered: finalSelectedDocs.filter((item, index) => item.preRerankPosition !== index).length,
									significantMovement: finalSelectedDocs.filter((item, index) => Math.abs(index - item.preRerankPosition) > 1).length
								}
							};
							
							this.debugManager.setRerankingData(rerankingData);
						}
						
						this.debugManager.addTiming('finalReranking', finalRerankStart);
						
					} catch (rerankingError) {
						// Fall back to first N documents if final reranking fails
						docs = docs.slice(0, context.config.documentsToReturn);
					}
				} else if (context.debugging) {
					// Store per-query reranking details even if no final rerank needed
					this.debugManager.setRerankingData({ perQueryDetails: perQueryReranking });
				}
				
				this.debugManager.setDocumentFlow({ finalCount: docs.length });
				
				// Generate answer
				const answer = await this.generateAnswer(docs, input, context);
				
				// Handle debugging
				await this.handleDebugging(input, context);
				
				// Format and return result
				return this.formatResult(answer, docs, context);
				
			} catch (multiQueryError) {
				// Fall back to simple search
				const docs = await context.vectorStore.similaritySearch(input, context.config.documentsToRetrieve);
				const answer = await this.generateAnswer(docs, input, context);
				return this.formatResult(answer, docs, context);
			}
			
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
}