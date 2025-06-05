import {
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';

import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { TextSplitter } from '@langchain/textsplitters';

// Custom implementation of Semantic Double-Pass Merging splitter
class SemanticDoublePassMergingSplitter extends TextSplitter {
	private embeddings: Embeddings;
	private bufferSize: number;
	private breakpointThresholdType: 'percentile' | 'standard_deviation' | 'interquartile' | 'gradient';
	private breakpointThresholdAmount?: number;
	private numberOfChunks?: number;
	private sentenceSplitRegex: RegExp;
	private minChunkSize?: number;
	private maxChunkSize?: number;
	private secondPassThreshold: number;

	constructor(
		embeddings: Embeddings,
		options: {
			bufferSize?: number;
			breakpointThresholdType?: 'percentile' | 'standard_deviation' | 'interquartile' | 'gradient';
			breakpointThresholdAmount?: number;
			numberOfChunks?: number;
			sentenceSplitRegex?: string;
			minChunkSize?: number;
			maxChunkSize?: number;
			secondPassThreshold?: number;
		} = {},
	) {
		super();
		this.embeddings = embeddings;
		this.bufferSize = options.bufferSize ?? 1;
		this.breakpointThresholdType = options.breakpointThresholdType ?? 'percentile';
		this.breakpointThresholdAmount = options.breakpointThresholdAmount;
		this.numberOfChunks = options.numberOfChunks;
		this.sentenceSplitRegex = new RegExp(options.sentenceSplitRegex ?? '(?<=[.?!])\\s+');
		this.minChunkSize = options.minChunkSize;
		this.maxChunkSize = options.maxChunkSize;
		this.secondPassThreshold = options.secondPassThreshold ?? 0.8;
	}

	async splitText(text: string): Promise<string[]> {
		// Handle empty or whitespace-only text
		if (!text || text.trim().length === 0) return [];

		// Split text into sentences
		const sentences = this._splitTextIntoSentences(text);
		if (sentences.length === 0) return [];
		
		// Handle single sentence case
		if (sentences.length === 1) {
			const singleSentence = sentences[0]!.trim();
			if (!singleSentence) return [];
			
			// Apply size constraints to single sentence
			if (this.maxChunkSize && singleSentence.length > this.maxChunkSize) {
				// Split by words if sentence is too long
				const words = singleSentence.split(/\s+/);
				const chunks: string[] = [];
				let currentChunk = '';
				
				for (const word of words) {
					if (currentChunk.length + word.length + 1 <= this.maxChunkSize) {
						currentChunk = currentChunk ? currentChunk + ' ' + word : word;
					} else {
						if (currentChunk) chunks.push(currentChunk);
						currentChunk = word;
					}
				}
				if (currentChunk) chunks.push(currentChunk);
				return chunks;
			}
			
			return [singleSentence];
		}

		// Combine sentences for embedding
		const combinedSentences = await this._combineSentences(sentences);

		// Calculate embeddings
		const embeddings = await this._embedSentences(combinedSentences);

		// Calculate distances between consecutive embeddings
		const distances = this._calculateDistances(embeddings);

		// Handle case where we have no distances (shouldn't happen with multiple sentences, but safety check)
		if (distances.length === 0) {
			return sentences.map(s => s.trim()).filter(s => s.length > 0);
		}

		// Determine breakpoints based on threshold
		const breakpoints = this._calculateBreakpoints(distances);

		// Create initial chunks
		let chunks = this._createChunks(sentences, breakpoints);

		// Second pass: merge similar adjacent chunks
		chunks = await this._secondPassMerge(chunks);

		// Apply size constraints
		chunks = this._applySizeConstraints(chunks);

		return chunks;
	}

	async splitDocuments(documents: Document[]): Promise<Document[]> {
		const splitDocuments: Document[] = [];

		for (const document of documents) {
			const chunks = await this.splitText(document.pageContent);
			
			for (const chunk of chunks) {
				splitDocuments.push(
					new Document({
						pageContent: chunk,
						metadata: { ...document.metadata },
					})
				);
			}
		}

		return splitDocuments;
	}

	private _splitTextIntoSentences(text: string): string[] {
		const sentences = text.split(this.sentenceSplitRegex).filter((s) => s.trim().length > 0);
		return sentences;
	}

	private async _combineSentences(sentences: string[]): Promise<string[]> {
		const combined: string[] = [];
		const bufferSize = Math.min(this.bufferSize, sentences.length);

		for (let i = 0; i < sentences.length; i++) {
			const start = Math.max(0, i - bufferSize);
			const end = Math.min(sentences.length, i + bufferSize + 1);
			const combinedText = sentences.slice(start, end).join(' ');
			combined.push(combinedText);
		}

		return combined;
	}

	private async _embedSentences(sentences: string[]): Promise<number[][]> {
		const embeddings = await this.embeddings.embedDocuments(sentences);
		return embeddings;
	}

	private _calculateDistances(embeddings: number[][]): number[] {
		const distances: number[] = [];
		for (let i = 0; i < embeddings.length - 1; i++) {
			const distance = this._cosineDistance(embeddings[i]!, embeddings[i + 1]!);
			distances.push(distance);
		}
		return distances;
	}

	private _cosineDistance(vec1: number[], vec2: number[]): number {
		const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i]!, 0);
		const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
		const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
		
		// Handle edge cases where vectors might have zero magnitude
		if (magnitude1 === 0 || magnitude2 === 0) {
			return 1; // Maximum distance for zero vectors
		}
		
		const similarity = dotProduct / (magnitude1 * magnitude2);
		// Clamp similarity to [-1, 1] to handle floating point errors
		const clampedSimilarity = Math.max(-1, Math.min(1, similarity));
		return 1 - clampedSimilarity;
	}

	private _calculateBreakpoints(distances: number[]): number[] {
		if (distances.length === 0) return [];

		let threshold: number;

		if (this.numberOfChunks) {
			// If number of chunks is specified, find threshold that creates that many chunks
			const sortedDistances = [...distances].sort((a, b) => b - a);
			const index = Math.min(this.numberOfChunks - 1, sortedDistances.length - 1);
			threshold = sortedDistances[index]!;
		} else if (this.breakpointThresholdAmount !== undefined) {
			threshold = this.breakpointThresholdAmount;
		} else {
			// Calculate threshold based on type
			switch (this.breakpointThresholdType) {
				case 'percentile':
					const percentile = 0.95;
					const sortedDist = [...distances].sort((a, b) => a - b);
					const index = Math.floor(sortedDist.length * percentile);
					// Ensure index is within bounds
					const safeIndex = Math.min(index, sortedDist.length - 1);
					threshold = sortedDist[safeIndex]!;
					break;
				case 'standard_deviation':
					const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
					const variance = distances.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / distances.length;
					const stdDev = Math.sqrt(variance);
					threshold = mean + stdDev;
					break;
				case 'interquartile':
					const sorted = [...distances].sort((a, b) => a - b);
					const q1Index = Math.floor(sorted.length * 0.25);
					const q3Index = Math.floor(sorted.length * 0.75);
					// Ensure indices are within bounds
					const safeQ1Index = Math.min(q1Index, sorted.length - 1);
					const safeQ3Index = Math.min(q3Index, sorted.length - 1);
					const q1 = sorted[safeQ1Index]!;
					const q3 = sorted[safeQ3Index]!;
					const iqr = q3 - q1;
					threshold = q3 + 1.5 * iqr;
					break;
				case 'gradient':
					// Find the point with maximum gradient change
					const gradients: number[] = [];
					for (let i = 1; i < distances.length; i++) {
						gradients.push(Math.abs(distances[i]! - distances[i - 1]!));
					}
					if (gradients.length > 0) {
						const maxGradientIndex = gradients.indexOf(Math.max(...gradients));
						// Ensure we don't go out of bounds
						const thresholdIndex = Math.min(maxGradientIndex + 1, distances.length - 1);
						threshold = distances[thresholdIndex]!;
					} else {
						threshold = 0.5; // Fallback for single distance
					}
					break;
				default:
					threshold = 0.5;
			}
		}

		const breakpoints: number[] = [];
		for (let i = 0; i < distances.length; i++) {
			if (distances[i]! > threshold) {
				breakpoints.push(i + 1);
			}
		}

		return breakpoints;
	}

	private _createChunks(sentences: string[], breakpoints: number[]): string[] {
		const chunks: string[] = [];
		let start = 0;

		for (const breakpoint of breakpoints) {
			const chunk = sentences.slice(start, breakpoint).join(' ');
			if (chunk.trim()) {
				chunks.push(chunk.trim());
			}
			start = breakpoint;
		}

		// Add the last chunk
		if (start < sentences.length) {
			const chunk = sentences.slice(start).join(' ');
			if (chunk.trim()) {
				chunks.push(chunk.trim());
			}
		}

		return chunks;
	}

	private async _secondPassMerge(chunks: string[]): Promise<string[]> {
		if (chunks.length <= 1) return chunks;

		// Get embeddings for all chunks
		const chunkEmbeddings = await this.embeddings.embedDocuments(chunks);

		// Calculate similarities between adjacent chunks
		const mergedChunks: string[] = [];
		let currentChunk = chunks[0]!;
		let currentEmbedding = chunkEmbeddings[0]!;
		let needsEmbeddingUpdate = false;

		for (let i = 1; i < chunks.length; i++) {
			const similarity = 1 - this._cosineDistance(currentEmbedding, chunkEmbeddings[i]!);

			if (similarity >= this.secondPassThreshold) {
				// Merge chunks
				currentChunk = currentChunk + ' ' + chunks[i];
				needsEmbeddingUpdate = true;
			} else {
				// If we merged chunks, recalculate embedding for the final merged chunk
				if (needsEmbeddingUpdate) {
					const [newEmbedding] = await this.embeddings.embedDocuments([currentChunk]);
					currentEmbedding = newEmbedding!;
					needsEmbeddingUpdate = false;
				}
				
				// Save current chunk and start new one
				mergedChunks.push(currentChunk);
				currentChunk = chunks[i]!;
				currentEmbedding = chunkEmbeddings[i]!;
			}
		}

		// Add the last chunk (recalculate embedding if needed)
		if (needsEmbeddingUpdate) {
			const [newEmbedding] = await this.embeddings.embedDocuments([currentChunk]);
			currentEmbedding = newEmbedding!;
		}
		mergedChunks.push(currentChunk);

		return mergedChunks;
	}

	private _applySizeConstraints(chunks: string[]): string[] {
		if (!this.minChunkSize && !this.maxChunkSize) return chunks;

		const constrainedChunks: string[] = [];
		let currentChunk = '';

		for (const chunk of chunks) {
			const chunkLength = chunk.length;

			if (this.maxChunkSize && chunkLength > this.maxChunkSize) {
				// Split large chunks
				const sentences = this._splitTextIntoSentences(chunk);
				let tempChunk = '';

				for (const sentence of sentences) {
					if (tempChunk.length + sentence.length + 1 <= this.maxChunkSize) {
						tempChunk = tempChunk ? tempChunk + ' ' + sentence : sentence;
					} else {
						// Save current tempChunk if it meets minimum size
						if (tempChunk && (!this.minChunkSize || tempChunk.length >= this.minChunkSize)) {
							constrainedChunks.push(tempChunk);
							tempChunk = sentence;
						} else {
							// tempChunk is too small, merge with currentChunk or start new sentence
							if (currentChunk) {
								currentChunk = currentChunk + ' ' + tempChunk + ' ' + sentence;
							} else {
								tempChunk = tempChunk ? tempChunk + ' ' + sentence : sentence;
							}
						}
					}
				}

				// Handle remaining tempChunk
				if (tempChunk) {
					if (!this.minChunkSize || tempChunk.length >= this.minChunkSize) {
						constrainedChunks.push(tempChunk);
					} else {
						// tempChunk is too small, add to currentChunk
						if (currentChunk) {
							currentChunk = currentChunk + ' ' + tempChunk;
						} else {
							currentChunk = tempChunk;
						}
					}
				}
			} else if (this.minChunkSize && chunkLength < this.minChunkSize) {
				// Merge small chunks
				if (currentChunk) {
					currentChunk = currentChunk + ' ' + chunk;
				} else {
					currentChunk = chunk;
				}

				if (currentChunk.length >= this.minChunkSize) {
					constrainedChunks.push(currentChunk);
					currentChunk = '';
				}
			} else {
				// Chunk is within acceptable size range
				if (currentChunk) {
					// Check if we should merge currentChunk with this chunk
					if (!this.minChunkSize || currentChunk.length >= this.minChunkSize) {
						constrainedChunks.push(currentChunk);
						currentChunk = '';
						constrainedChunks.push(chunk);
					} else {
						// currentChunk is too small, merge with this chunk
						currentChunk = currentChunk + ' ' + chunk;
						if (currentChunk.length >= this.minChunkSize) {
							constrainedChunks.push(currentChunk);
							currentChunk = '';
						}
					}
				} else {
					constrainedChunks.push(chunk);
				}
			}
		}

		// Handle any remaining currentChunk
		if (currentChunk) {
			if (!this.minChunkSize || currentChunk.length >= this.minChunkSize) {
				constrainedChunks.push(currentChunk);
			} else {
				// currentChunk is too small, try to merge with last chunk if possible
				if (constrainedChunks.length > 0) {
					const lastChunk = constrainedChunks.pop()!;
					const mergedChunk = lastChunk + ' ' + currentChunk;
					constrainedChunks.push(mergedChunk);
				} else {
					// No chunks to merge with, but we have content - add it anyway to avoid losing data
					// This is a rare edge case where all content is smaller than minChunkSize
					constrainedChunks.push(currentChunk);
				}
			}
		}

		return constrainedChunks;
	}
}

export class TextSplitterSemanticDoublePass implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Semantic Double-Pass Merging Text Splitter',
		name: 'textSplitterSemanticDoublePass',
		icon: 'fa:cut',
		group: ['transform'],
		version: 1,
		description: 'Split text using semantic similarity with double-pass merging for optimal chunking',
		defaults: {
			name: 'Semantic Double-Pass Merging Text Splitter',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Text Splitters'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.textsplittersemanticdoublepass/',
					},
				],
			},
		},
		inputs: [
			{
				displayName: 'Embeddings',
				maxConnections: 1,
				type: NodeConnectionType.AiEmbedding,
				required: true,
			},
		],
		outputs: [
			{
				displayName: 'Text Splitter',
				maxConnections: 1,
				type: NodeConnectionType.AiTextSplitter,
			},
		],
		properties: [
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				default: {},
				placeholder: 'Add Option',
				options: [
					{
						displayName: 'Buffer Size',
						name: 'bufferSize',
						type: 'number',
						default: 1,
						description: 'Number of sentences to combine for context when creating embeddings',
					},
					{
						displayName: 'Breakpoint Threshold Type',
						name: 'breakpointThresholdType',
						type: 'options',
						default: 'percentile',
						options: [
							{
								name: 'Percentile',
								value: 'percentile',
								description: 'Use percentile of distances as threshold',
							},
							{
								name: 'Standard Deviation',
								value: 'standard_deviation',
								description: 'Use mean + standard deviation as threshold',
							},
							{
								name: 'Interquartile',
								value: 'interquartile',
								description: 'Use interquartile range method',
							},
							{
								name: 'Gradient',
								value: 'gradient',
								description: 'Use maximum gradient change as threshold',
							},
						],
					},
					{
						displayName: 'Breakpoint Threshold Amount',
						name: 'breakpointThresholdAmount',
						type: 'number',
						default: 0.5,
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberStepSize: 0.01,
						},
						description: 'Manual threshold for determining chunk boundaries (0-1). If set, overrides threshold type.',
						displayOptions: {
							show: {
								'/breakpointThresholdType': ['percentile', 'standard_deviation', 'interquartile', 'gradient'],
							},
						},
					},
					{
						displayName: 'Number of Chunks',
						name: 'numberOfChunks',
						type: 'number',
						default: 0,
						description: 'Target number of chunks to create. If set, overrides threshold settings. Set to 0 to use threshold.',
					},
					{
						displayName: 'Second Pass Threshold',
						name: 'secondPassThreshold',
						type: 'number',
						default: 0.8,
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberStepSize: 0.01,
						},
						description: 'Similarity threshold for merging chunks in the second pass (0-1). Higher values require more similarity to merge.',
					},
					{
						displayName: 'Min Chunk Size',
						name: 'minChunkSize',
						type: 'number',
						default: 100,
						description: 'Minimum number of characters per chunk',
					},
					{
						displayName: 'Max Chunk Size',
						name: 'maxChunkSize',
						type: 'number',
						default: 2000,
						description: 'Maximum number of characters per chunk',
					},
					{
						displayName: 'Sentence Split Regex',
						name: 'sentenceSplitRegex',
						type: 'string',
						default: '(?<=[.?!])\\s+',
						description: 'Regular expression to split text into sentences',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const embeddings = (await this.getInputConnectionData(
			NodeConnectionType.AiEmbedding,
			itemIndex,
		)) as Embeddings;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			bufferSize?: number;
			breakpointThresholdType?: 'percentile' | 'standard_deviation' | 'interquartile' | 'gradient';
			breakpointThresholdAmount?: number;
			numberOfChunks?: number;
			secondPassThreshold?: number;
			minChunkSize?: number;
			maxChunkSize?: number;
			sentenceSplitRegex?: string;
		};

		const splitter = new SemanticDoublePassMergingSplitter(embeddings, {
			bufferSize: options.bufferSize,
			breakpointThresholdType: options.breakpointThresholdType,
			breakpointThresholdAmount: options.breakpointThresholdAmount,
			numberOfChunks: options.numberOfChunks,
			secondPassThreshold: options.secondPassThreshold,
			minChunkSize: options.minChunkSize,
			maxChunkSize: options.maxChunkSize,
			sentenceSplitRegex: options.sentenceSplitRegex,
		});

		// Return the splitter instance directly
		return {
			response: splitter,
		};
	}
} 