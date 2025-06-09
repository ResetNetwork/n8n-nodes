import {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	NodeConnectionType,
} from 'n8n-workflow';

import { DynamicTool } from '@langchain/core/tools';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { VectorStore } from '@langchain/core/vectorstores';
import type { Embeddings } from '@langchain/core/embeddings';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';
import { nodeNameToToolName } from '../../utils/helpers';
import { logWrapper } from '../../utils/logWrapper';

export class QueryRetrieverRerank implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Query Retriever with Rerank',
		name: 'queryRetrieverRerank',
		group: ['transform'],
		version: 1,
		description: 'Query retrieval tool with multi-query strategies, intelligent reranking, and comprehensive debugging',
		defaults: {
			name: 'Query Retriever with Rerank',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolvectorstore/',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [
			{
				displayName: 'Vector Store',
				maxConnections: 1,
				type: NodeConnectionType.AiVectorStore,
			},
			{
				displayName: 'Chat Model',
				maxConnections: 1,
				type: NodeConnectionType.AiLanguageModel,
			},
			{
				displayName: 'Embedding',
				maxConnections: 1,
				type: NodeConnectionType.AiEmbedding,
				required: true,
			},
		],
		outputs: [NodeConnectionType.AiTool],
		outputNames: ['Tool'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionType.AiAgent]),
			{
				displayName: 'Tool Options',
				name: 'toolOptions',
				placeholder: 'Add Option',
				description: 'Configure the AI tool name and description',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Tool Name',
						name: 'toolName',
						type: 'string',
						default: '',
						placeholder: 'Leave empty to use node name automatically',
						description: 'Custom name for the AI tool. If empty, will use the node name from the interface (safer for API compatibility).',
					},
					{
						displayName: 'Tool Description',
						name: 'description',
						type: 'string',
						default: 'A tool for answering questions by searching through a vector store of documents',
						placeholder: 'Describe your data here, e.g. user information, knowledge base, etc.',
						description: 'Describe the data in vector store. This will be used to fill the tool description.',
						typeOptions: {
							rows: 3,
						},
					},
				],
			},
			{
				displayName: 'Retrieval Options',
				name: 'retrievalOptions',
				placeholder: 'Add Option',
				description: 'Configure document retrieval and reranking behavior',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Documents to Retrieve',
						name: 'documentsToRetrieve',
						type: 'number',
						default: 10,
						description: 'Number of documents to initially retrieve from the vector store before reranking.',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
					},
					{
						displayName: 'Documents to Return',
						name: 'documentsToReturn',
						type: 'number',
						default: 4,
						description: 'Number of top-ranked documents to use for answer generation and return in results.',
						typeOptions: {
							minValue: 1,
							maxValue: 50,
						},
					},
					{
						displayName: 'Return Ranked Documents',
						name: 'returnRankedDocuments',
						type: 'boolean',
						default: false,
						description: 'Whether to return the reranked documents along with the answer for debugging or citations.',
					},
				],
			},
			{
				displayName: 'Query Strategy Options',
				name: 'queryStrategy',
				placeholder: 'Add Option',
				description: 'Configure how to process and respond with retrieved documents',
				type: 'collection',
				default: {
					strategyType: 'simple_query'
				},
				options: [
					{
						displayName: 'Strategy Type',
						name: 'strategyType',
						type: 'options',
						default: 'simple_query',
						description: 'How to process the retrieved documents to generate a response',
						options: [
							{
								name: 'Simple Query',
								value: 'simple_query',
								description: 'Generate an answer using all retrieved documents in a single prompt',
							},
							{
								name: 'Multi-Query',
								value: 'multi_query',
								description: 'Generate multiple query variations, retrieve documents for each, then combine and rerank results',
							},
							{
								name: 'None',
								value: 'none',
								description: 'Return only the retrieved documents without generating an answer',
							},
						],
					},
					{
						displayName: 'Number of Query Variations',
						name: 'queryVariations',
						type: 'number',
						default: 3,
						description: 'Number of alternative queries to generate for multi-query retrieval',
						typeOptions: {
							minValue: 2,
							maxValue: 8,
						},
						displayOptions: {
							show: {
								strategyType: ['multi_query'],
							},
						},
					},
					{
						displayName: 'Include Original Query',
						name: 'includeOriginalQuery',
						type: 'boolean',
						default: true,
						description: 'Whether to include the original query in addition to the generated variations',
						displayOptions: {
							show: {
								strategyType: ['multi_query'],
							},
						},
					},
					{
						displayName: 'Query Prompt Template',
						name: 'promptTemplate',
						type: 'string',
						default: '',
						placeholder: 'Use the following pieces of context to answer the question: {context}\\n\\nQuestion: {question}\\nAnswer:',
						description: 'For Simple Query/Multi-Query: Answer generation template using {context} and {question}. For Multi-Query: Custom instructions for query generation using {count}.',
						typeOptions: {
							rows: 4,
						},
						displayOptions: {
							show: {
								strategyType: ['simple_query', 'multi_query'],
							},
						},
					},
				],
			},
			{
				displayName: 'Advanced Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Advanced configuration options for the vector store tool',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Debugging',
						name: 'debugging',
						type: 'boolean',
						default: false,
						description: 'Send detailed execution metrics and AI-generated performance analysis to the connected language model. Check the Chat Model execution logs to see the debug analysis.',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const node = this.getNode();
		const toolOptions = this.getNodeParameter('toolOptions', itemIndex, {}) as {
			toolName?: string;
			description?: string;
		};
		
		// Use custom name if provided, otherwise fall back to node name
		const rawName = toolOptions.toolName?.trim() || node.name;
		// Always apply nodeNameToToolName sanitization to ensure API compatibility
		const name = nodeNameToToolName({ name: rawName } as any);
		const description = toolOptions.description || 'A tool for answering questions by searching through a vector store of documents';

		// Modular reranking function for use across all strategies
		const performReranking = async (
			docs: any[], 
			query: string, 
			embeddings: any, 
			topK: number,
			context: {
				strategyType: string;
				queryIndex?: number;
				isOriginal?: boolean;
				label?: string;
			},
			debugging: boolean = false
		) => {
			if (docs.length === 0) return { docs: [], debugInfo: null };

			try {
				// Get embeddings for the query
				const queryEmbedding = await embeddings.embedQuery(query);
				
				// Get embeddings for all documents
				const docTexts = docs.map((doc: any) => doc.pageContent);
				const docEmbeddings = await embeddings.embedDocuments(docTexts);
				
				// Calculate similarity scores
				const similarities = docEmbeddings.map((docEmbed: number[]) => {
					const dotProduct = queryEmbedding.reduce((sum: number, a: number, j: number) => sum + a * docEmbed[j], 0);
					const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum: number, a: number) => sum + a * a, 0));
					const docMagnitude = Math.sqrt(docEmbed.reduce((sum: number, a: number) => sum + a * a, 0));
					return dotProduct / (queryMagnitude * docMagnitude);
				});
				
				// Create array with scores and original positions
				const docsWithScoresAndPositions = docs.map((doc: any, index: number) => ({
					doc,
					score: similarities[index],
					originalPosition: index,
					contentPreview: doc.pageContent.substring(0, 100) + (doc.pageContent.length > 100 ? '...' : '')
				}));
				
				// Sort by score (descending)
				const sortedDocs = [...docsWithScoresAndPositions].sort((a, b) => b.score - a.score);
				
				// Take top documents
				const finalDocs = sortedDocs.slice(0, topK);
				const resultDocs = finalDocs.map(item => item.doc);
				
				// Generate debug information if requested
				let debugInfo = null;
				if (debugging) {
					debugInfo = {
						context,
						totalDocuments: docs.length,
						originalOrder: docsWithScoresAndPositions.map((item, index) => ({
							position: index,
							score: item.score,
							contentPreview: item.contentPreview
						})),
						rerankedOrder: sortedDocs.map((item, newIndex) => ({
							newPosition: newIndex,
							originalPosition: item.originalPosition,
							score: item.score,
							movement: newIndex - item.originalPosition,
							contentPreview: item.contentPreview
						})),
						finalSelection: finalDocs.map((item, index) => ({
							finalPosition: index,
							originalPosition: item.originalPosition,
							score: item.score,
							totalMovement: index - item.originalPosition,
							selected: true,
							contentPreview: item.contentPreview
						})),
						filteredOut: sortedDocs.slice(topK).map((item, index) => ({
							originalPosition: item.originalPosition,
							rerankedPosition: topK + index,
							score: item.score,
							reason: `Below top-${topK} threshold${context.label ? ` for ${context.label}` : ''}`,
							contentPreview: item.contentPreview
						})),
						effectiveness: {
							averageMovement: finalDocs.length > 0 ? 
								finalDocs.reduce((sum, item, index) => sum + Math.abs(index - item.originalPosition), 0) / finalDocs.length : 0,
							scoreRange: {
								highest: Math.max(...similarities),
								lowest: Math.min(...similarities),
								spread: Math.max(...similarities) - Math.min(...similarities)
							},
							documentsReordered: finalDocs.filter((item, index) => item.originalPosition !== index).length,
							significantMovement: finalDocs.filter((item, index) => Math.abs(index - item.originalPosition) > 1).length
						}
					};
				}
				
				return { docs: resultDocs, debugInfo };
				
			} catch (error) {
				// Fall back to taking top documents without reranking
				return { 
					docs: docs.slice(0, topK), 
					debugInfo: debugging ? { context, error: error instanceof Error ? error.message : String(error) } : null 
				};
			}
		};
		const retrievalOptions = this.getNodeParameter('retrievalOptions', itemIndex, {}) as {
			documentsToRetrieve?: number;
			documentsToReturn?: number;
			returnRankedDocuments?: boolean;
		};
		const queryStrategy = this.getNodeParameter('queryStrategy', itemIndex, { strategyType: 'simple_query' }) as {
			strategyType: string;
			promptTemplate?: string;
			queryVariations?: number;
			includeOriginalQuery?: boolean;
		};
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			debugging?: boolean;
		};

		// Get the vector store and language model from input connections
		const vectorStore = (await this.getInputConnectionData(NodeConnectionType.AiVectorStore, itemIndex)) as VectorStore;
		const model = (await this.getInputConnectionData(NodeConnectionType.AiLanguageModel, 0)) as BaseLanguageModel;
		const rerankingEmbeddings = (await this.getInputConnectionData(NodeConnectionType.AiEmbedding, 0)) as Embeddings;

		if (!vectorStore) {
			throw new Error('Vector Store input is required');
		}

		if (!model) {
			throw new Error('Language Model input is required');
		}

		// Reranking embeddings are now required since we always rerank
		if (!rerankingEmbeddings) {
			throw new Error('Reranking Embeddings input is required for document reranking');
		}

		// Create the enhanced description  
		const documentsToReturn = retrievalOptions.documentsToReturn || 4;
		const strategyType = queryStrategy.strategyType;
		const enhancedDescription = `${description}. ${
			strategyType === 'multi_query' 
				? `Generates ${queryStrategy.queryVariations || 3} query variations, retrieves documents for each, combines and reranks results`
				: 'Retrieves and reranks documents'
		}${
			strategyType === 'none' 
				? `, then returns top ${documentsToReturn} ranked documents without generating an answer`
				: `, then uses top ${documentsToReturn} documents to generate answers`
		}${
			retrievalOptions.returnRankedDocuments ? ' with ranked document citations' : ''
		}. Supports AI-controlled retrieval parameters.`;

		// Create the DynamicTool
		const tool = new DynamicTool({
			name,
			description: enhancedDescription,
			func: async (input: string) => {
				try {
					// Initialize debugging data
					const startTime = Date.now();
					const debugData: any = {
						strategy: strategyType,
						configuration: {
							documentsToRetrieve: retrievalOptions.documentsToRetrieve || 10,
							documentsToReturn: retrievalOptions.documentsToReturn || 4,
							queryVariations: queryStrategy.queryVariations || 3,
							includeOriginalQuery: queryStrategy.includeOriginalQuery !== false
						},
						timing: {},
						documentFlow: {},
						queryDetails: {}
					};

					// Perform similarity search based on strategy type
					let docs;
					const documentsToRetrieve = retrievalOptions.documentsToRetrieve || 10;
					const documentsToReturn = retrievalOptions.documentsToReturn || 4;
					const perQueryReranking: any[] = []; // Declare at function scope for multi-query debugging
					
					if (strategyType === 'multi_query') {
						// Multi-Query strategy: generate variations and search with each
						const queryGenStart = Date.now();
						
						try {
							// Generate query variations using the language model
							const queryVariations = queryStrategy.queryVariations || 3;
							const includeOriginal = queryStrategy.includeOriginalQuery !== false;
							
							debugData.queryDetails.original = input;
							
							const defaultInstructions = `You are an AI language model assistant. Your task is to generate {count} different versions of the given question to retrieve relevant documents from a vector database. By generating multiple perspectives on the user question, your goal is to help overcome some of the limitations of distance-based similarity search.`;
							
							// Use custom instructions if provided, otherwise use default
							const instructions = queryStrategy.promptTemplate?.trim() || defaultInstructions;
							
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
							
							const queryResponse = await model.invoke(queryPrompt);
							const queryResponseText = typeof queryResponse === 'string' ? queryResponse : queryResponse.content || queryResponse.text || String(queryResponse);
							
							debugData.timing.queryGeneration = `${Date.now() - queryGenStart}ms`;
							
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
							
							
							debugData.queryDetails.variations = generatedQueries;
							debugData.queryDetails.includeOriginal = includeOriginal;
							
							// Collect all queries to search with
							const queriesToSearch = includeOriginal ? [input, ...generatedQueries] : generatedQueries;
							debugData.queryDetails.totalQueries = queriesToSearch.length;
							
							// Search with each query, apply first-stage reranking, and collect top documents
							const allRerankedDocs: Array<{doc: any, source: string}> = [];
							const documentsPerQuery: number[] = [];
							const retrievalStart = Date.now();
							
							for (let i = 0; i < queriesToSearch.length; i++) {
								const query = queriesToSearch[i];
								const isOriginal = includeOriginal && i === 0;
								
								try {
									const queryDocs = await vectorStore.similaritySearch(query, documentsToRetrieve);
									documentsPerQuery.push(queryDocs.length);
									
									// Apply first-stage reranking to this query's results
									if (queryDocs.length > 0) {
										
										try {
											// Get embeddings for this specific query
											const queryEmbedding = await rerankingEmbeddings.embedQuery(query);
											
											// Get embeddings for documents from this query
											const docTexts = queryDocs.map(doc => doc.pageContent);
											const docEmbeddings = await rerankingEmbeddings.embedDocuments(docTexts);
											
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
											const topDocsForQuery = sortedDocsForQuery.slice(0, documentsToReturn);
											
											// Store per-query reranking details
											if (options.debugging) {
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
													filteredOut: sortedDocsForQuery.slice(documentsToReturn).map((item, index) => ({
														originalPosition: item.originalPosition,
														rerankedPosition: documentsToReturn + index,
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
											const fallbackDocs = queryDocs.slice(0, documentsToReturn);
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
							
							docs = uniqueDocs;
							
							// Add multi-query debug data
							debugData.timing.documentRetrieval = `${Date.now() - retrievalStart}ms`;
							debugData.queryDetails.documentsPerQuery = documentsPerQuery;
							debugData.documentFlow.totalRetrieved = allRerankedDocs.length;
							debugData.documentFlow.afterDeduplication = uniqueDocs.length;
							
						} catch (multiQueryError) {
							// Fall back to simple search
							docs = await vectorStore.similaritySearch(input, documentsToRetrieve);
						}
						
					} else {
						// Simple strategy: single query search with immediate reranking
						const retrievalStart = Date.now();
						try {
							const rawDocs = await vectorStore.similaritySearch(input, documentsToRetrieve);
							debugData.documentFlow.totalRetrieved = rawDocs.length;
							
							// Use modular reranking function
							const rerankResult = await performReranking(
								rawDocs,
								input,
								rerankingEmbeddings,
								documentsToReturn,
								{
									strategyType: 'simple_query',
									label: 'simple query'
								},
								options.debugging
							);
							
							docs = rerankResult.docs;
							
							// Store debug information
							if (options.debugging && rerankResult.debugInfo) {
								debugData.reranking = {
									simpleQuery: rerankResult.debugInfo
								};
							}
							
							debugData.timing.documentRetrieval = `${Date.now() - retrievalStart}ms`;
							
						} catch (searchError) {
							
							// Try alternative search methods if the main one fails
							try {
								const rawDocs = await vectorStore.similaritySearch(input, documentsToRetrieve, {});
								// Apply same reranking logic to fallback results
								docs = rawDocs.slice(0, documentsToReturn);
							} catch (altSearchError) {
								const errorMessage = searchError instanceof Error ? searchError.message : String(searchError);
								return `Error searching for documents: ${errorMessage}. This might be due to vector store schema mismatch. Please check that the vector store is properly configured and the data types match the expected schema.`;
							}
						}
					}

					// Apply final reranking for multi-query strategy (already done for simple strategy)
					if (strategyType === 'multi_query' && docs.length > documentsToReturn) {
						const finalRerankStart = Date.now();
						try {
							// Get embeddings for the original query
							const queryEmbedding = await rerankingEmbeddings.embedQuery(input);
							
							// Get embeddings for all deduplicated documents
							const docTexts = docs.map(doc => doc.pageContent);
							const docEmbeddings = await rerankingEmbeddings.embedDocuments(docTexts);
							
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
							const finalSelectedDocs = finalSortedDocs.slice(0, documentsToReturn);
							docs = finalSelectedDocs.map(item => item.doc);
							
							// Store final reranking debug information
							if (options.debugging) {
								if (!debugData.reranking) debugData.reranking = {};
								debugData.reranking.multiQueryFinalRerank = {
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
									filteredOut: finalSortedDocs.slice(documentsToReturn).map((item, index) => ({
										preRerankPosition: item.preRerankPosition,
										finalRerankPosition: documentsToReturn + index,
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
								
								// Add per-query reranking details to debug data
								debugData.reranking.perQueryDetails = perQueryReranking;
							}
							
							debugData.timing.finalReranking = `${Date.now() - finalRerankStart}ms`;
							
						} catch (rerankingError) {
							// Fall back to first N documents if final reranking fails
							docs = docs.slice(0, documentsToReturn);
						}
					} else if (strategyType === 'multi_query' && options.debugging) {
						// Store per-query reranking details even if no final rerank needed
						if (!debugData.reranking) debugData.reranking = {};
						debugData.reranking.perQueryDetails = perQueryReranking;
					}
					
					// Handle different strategy types
					if (docs.length === 0) {
						return 'No relevant documents found in the vector store.';
					}

					// If strategy is "none", return only documents without generating an answer
					if (strategyType === 'none') {
						debugData.timing.total = `${Date.now() - startTime}ms`;
						debugData.documentFlow.finalCount = docs.length;
						
						// Handle debugging by sending analysis to the language model
						if (options.debugging) {
							try {
								const analysisPrompt = `QUERY RETRIEVER DEBUG ANALYSIS

The following debug data is from a document retrieval and reranking execution (strategy: none):

Debug Data:
${JSON.stringify(debugData, null, 2)}

Please analyze this data and provide insights on:
- System performance and timing
- Document retrieval effectiveness
- Reranking impact
- Areas for optimization

This is for debugging purposes only - do not include this analysis in your response to the user.`;

								// Send debug analysis to the model (user can see this in Chat Model execution logs)
								await model.invoke(analysisPrompt);
							} catch (debugError) {
								// Silent failure for debug analysis
							}
						}
						
						const result: any = {
							sourceDocuments: docs.map((doc: any) => ({
								pageContent: doc.pageContent,
								metadata: doc.metadata
							}))
						};
						
						return JSON.stringify(result, null, 2);
					}

					// For "simple_query" strategy, generate an answer using the language model
					// Prepare context from retrieved documents
					const context = docs.map((doc, index) => 
						`Document ${index + 1}:\n${doc.pageContent}\n`
					).join('\n');

					// Use custom prompt template if provided, otherwise use default
					const defaultTemplate = `Use the following pieces of context to answer the question at the end.

{context}

Question: {question}
Answer:`;
					
					const promptTemplate = queryStrategy.promptTemplate?.trim() || defaultTemplate;

					const prompt = promptTemplate
						.replace('{context}', context)
						.replace('{question}', input);

					debugData.answerGeneration = {
						contextLength: context.length,
						promptLength: prompt.length
					};

					// Generate answer using the language model
					const answerStart = Date.now();
					const response = await model.invoke(prompt);
					debugData.timing.answerGeneration = `${Date.now() - answerStart}ms`;
					
					// Finalize debug data
					debugData.timing.total = `${Date.now() - startTime}ms`;
					debugData.documentFlow.finalCount = docs.length;

					// Handle debugging by sending analysis to the language model
					if (options.debugging) {
						try {
							const analysisPrompt = `QUERY RETRIEVER DEBUG ANALYSIS

The following debug data is from a document retrieval and reranking execution:

Debug Data:
${JSON.stringify(debugData, null, 2)}

Please analyze this data and provide insights on:
- System performance and timing
- Strategy effectiveness 
- Document flow and reranking impact
- Areas for optimization

This is for debugging purposes only - do not include this analysis in your response to the user.`;

							// Send debug analysis to the model (user can see this in Chat Model execution logs)
							await model.invoke(analysisPrompt);
						} catch (debugError) {
							// Silent failure for debug analysis
						}
					}

					// Return structured JSON when returning source documents
					if (retrievalOptions.returnRankedDocuments) {
						const result: any = {
							answer: typeof response === 'string' ? response : response.content || response.text || String(response),
							sourceDocuments: docs.map((doc: any) => ({
								pageContent: doc.pageContent,
								metadata: doc.metadata
							}))
						};
						
						return JSON.stringify(result, null, 2);
					}

					// Simple answer return (no debugging, no source documents)
					return typeof response === 'string' ? response : response.content || response.text || String(response);
				} catch (error) {
					throw error;
				}
			}
		});

		// Return the tool wrapped with logging for visual feedback
		const wrappedTool = logWrapper(tool, this);
		
		return {
			response: wrappedTool,
		};
	}
} 