import { BaseStrategy } from './BaseStrategy';
import { RerankingManager } from '../shared/reranking';
import type { StrategyContext, StrategyResult } from '../shared/types';

export class SimpleQueryStrategy extends BaseStrategy {
	getName(): string {
		return 'simple_query';
	}

	getDescription(): string {
		return 'Generate an answer using all retrieved documents in a single prompt';
	}

	async execute(input: string, context: StrategyContext): Promise<StrategyResult> {
		try {
			// Initialize debug manager
			this.initializeDebugManager('simple_query', context.config);

			const retrievalStart = Date.now();
			
			try {
				// Perform initial document retrieval
				const rawDocs = await context.vectorStore.similaritySearch(input, context.config.documentsToRetrieve);
				this.debugManager.setDocumentFlow({ totalRetrieved: rawDocs.length });

				// Use modular reranking function
				const rerankResult = await RerankingManager.performReranking(
					rawDocs,
					input,
					context.embeddings,
					context.config.documentsToReturn,
					{
						strategyType: 'simple_query',
						label: 'simple query'
					},
					context.debugging
				);

				const docs = rerankResult.docs;

				// Store debug information
				if (context.debugging && rerankResult.debugInfo) {
					this.debugManager.setRerankingData({
						simpleQuery: rerankResult.debugInfo
					});
				}

				this.debugManager.addTiming('documentRetrieval', retrievalStart);
				this.debugManager.setDocumentFlow({ finalCount: docs.length });

				// Generate answer
				const answer = await this.generateAnswer(docs, input, context);

				// Handle debugging
				await this.handleDebugging(input, context);

				// Format and return result
				return this.formatResult(answer, docs, context);

			} catch (searchError) {
				// Try alternative search methods if the main one fails
				try {
					const rawDocs = await context.vectorStore.similaritySearch(input, context.config.documentsToRetrieve, {});
					// Apply same reranking logic to fallback results
					const docs = rawDocs.slice(0, context.config.documentsToReturn);
					const answer = await this.generateAnswer(docs, input, context);
					return this.formatResult(answer, docs, context);
				} catch (altSearchError) {
					const errorMessage = searchError instanceof Error ? searchError.message : String(searchError);
					return {
						error: `Error searching for documents: ${errorMessage}. This might be due to vector store schema mismatch. Please check that the vector store is properly configured and the data types match the expected schema.`
					};
				}
			}

		} catch (error) {
			return {
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
}