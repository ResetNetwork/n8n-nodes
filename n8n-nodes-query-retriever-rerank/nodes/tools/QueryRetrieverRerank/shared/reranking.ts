import type { Embeddings } from '@langchain/core/embeddings';
import type { RerankingContext, RerankingResult } from './types';

export class RerankingManager {
	// Modular reranking function for use across all strategies
	static async performReranking(
		docs: any[],
		query: string,
		embeddings: Embeddings,
		topK: number,
		context: RerankingContext,
		debugging: boolean = false
	): Promise<RerankingResult> {
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
	}
}