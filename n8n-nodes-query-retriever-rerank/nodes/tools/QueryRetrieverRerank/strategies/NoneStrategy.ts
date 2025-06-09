import { BaseStrategy } from './BaseStrategy';
import { RerankingManager } from '../shared/reranking';
import type { StrategyContext, StrategyResult } from '../shared/types';

export class NoneStrategy extends BaseStrategy {
	getName(): string {
		return 'none';
	}

	getDescription(): string {
		return 'Return only the retrieved documents without generating an answer';
	}

	async execute(input: string, context: StrategyContext): Promise<StrategyResult> {
		try {
			// Initialize debug manager
			this.initializeDebugManager('none', context.config);

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
						strategyType: 'none',
						label: 'none strategy'
					},
					context.debugging
				);

				const docs = rerankResult.docs;

				// Store debug information
				if (context.debugging && rerankResult.debugInfo) {
					this.debugManager.setRerankingData({
						noneStrategy: rerankResult.debugInfo
					});
				}

				this.debugManager.addTiming('documentRetrieval', retrievalStart);
				this.debugManager.setDocumentFlow({ finalCount: docs.length });

				// Handle debugging
				await this.handleDebugging(input, context);

				// Return only documents (no answer generation)
				return this.formatResult(null, docs, context);

			} catch (searchError) {
				// Try alternative search methods if the main one fails
				try {
					const rawDocs = await context.vectorStore.similaritySearch(input, context.config.documentsToRetrieve, {});
					const docs = rawDocs.slice(0, context.config.documentsToReturn);
					return this.formatResult(null, docs, context);
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