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
		// Split text into sentences
		const sentences = this._splitTextIntoSentences(text);
		if (sentences.length === 0) return [];

		// Combine sentences for embedding
		const combinedSentences = await this._combineSentences(sentences);

		// Calculate embeddings
		const embeddings = await this._embedSentences(combinedSentences);

		// Calculate distances between consecutive embeddings
		const distances = this._calculateDistances(embeddings);

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

	override async splitDocuments(documents: Document[]): Promise<Document[]> {
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
		const similarity = dotProduct / (magnitude1 * magnitude2);
		return 1 - similarity;
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
					threshold = sortedDist[index]!;
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
					const q1 = sorted[q1Index]!;
					const q3 = sorted[q3Index]!;
					const iqr = q3 - q1;
					threshold = q3 + 1.5 * iqr;
					break;
				case 'gradient':
					// Find the point with maximum gradient change
					const gradients: number[] = [];
					for (let i = 1; i < distances.length; i++) {
						gradients.push(Math.abs(distances[i]! - distances[i - 1]!));
					}
					const maxGradientIndex = gradients.indexOf(Math.max(...gradients));
					threshold = distances[maxGradientIndex + 1]!;
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

		for (let i = 1; i < chunks.length; i++) {
			const similarity = 1 - this._cosineDistance(currentEmbedding, chunkEmbeddings[i]!);

			if (similarity >= this.secondPassThreshold) {
				// Merge chunks
				currentChunk = currentChunk + ' ' + chunks[i];
				// Recalculate embedding for merged chunk
				const [newEmbedding] = await this.embeddings.embedDocuments([currentChunk]);
				currentEmbedding = newEmbedding!;
			} else {
				// Save current chunk and start new one
				mergedChunks.push(currentChunk);
				currentChunk = chunks[i]!;
				currentEmbedding = chunkEmbeddings[i]!;
			}
		}

		// Add the last chunk
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
						if (tempChunk && (!this.minChunkSize || tempChunk.length >= this.minChunkSize)) {
							constrainedChunks.push(tempChunk);
						}
						tempChunk = sentence;
					}
				}

				if (tempChunk) {
					if (!this.minChunkSize || tempChunk.length >= this.minChunkSize) {
						constrainedChunks.push(tempChunk);
					} else if (currentChunk) {
						currentChunk = currentChunk + ' ' + tempChunk;
					} else {
						currentChunk = tempChunk;
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
				if (currentChunk) {
					constrainedChunks.push(currentChunk);
					currentChunk = '';
				}
				constrainedChunks.push(chunk);
			}
		}

		// Add any remaining chunk
		if (currentChunk) {
			constrainedChunks.push(currentChunk);
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