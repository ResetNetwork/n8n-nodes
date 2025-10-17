import {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';

import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { TextSplitter } from '@langchain/textsplitters';
import { logWrapper } from '../../utils/logWrapper';

// Custom implementation of Semantic Double-Pass Merging splitter with context
class SemanticDoublePassMergingSplitterWithContext extends TextSplitter {
	private embeddings: Embeddings;
	private chatModel: BaseLanguageModel;
	private bufferSize: number;
	private breakpointThresholdType: 'percentile' | 'standard_deviation' | 'interquartile' | 'gradient';
	private breakpointThresholdAmount?: number;
	private numberOfChunks?: number;
	private sentenceSplitRegex: RegExp;
	private minChunkSize?: number;
	private maxChunkSize?: number;
	private secondPassThreshold: number;
	private contextPrompt: string;
	private includeLabels: boolean;
	private useGlobalSummary: boolean;
	private globalSummaryPrompt: string;

	constructor(
		embeddings: Embeddings,
		chatModel: BaseLanguageModel,
		options: {
			bufferSize?: number;
			breakpointThresholdType?: 'percentile' | 'standard_deviation' | 'interquartile' | 'gradient';
			breakpointThresholdAmount?: number;
			numberOfChunks?: number;
			sentenceSplitRegex?: string;
			minChunkSize?: number;
			maxChunkSize?: number;
			secondPassThreshold?: number;
			contextPrompt?: string;
			includeLabels?: boolean;
			useGlobalSummary?: boolean;
			globalSummaryPrompt?: string;
		} = {},
	) {
		super();
		this.embeddings = embeddings;
		this.chatModel = chatModel;
		this.bufferSize = options.bufferSize ?? 1;
		this.breakpointThresholdType = options.breakpointThresholdType ?? 'percentile';
		this.breakpointThresholdAmount = options.breakpointThresholdAmount;
		this.numberOfChunks = options.numberOfChunks;
		try {
			this.sentenceSplitRegex = new RegExp(options.sentenceSplitRegex ?? '(?<=[.?!])\\s+');
		} catch {
			// Fallback to default if user provided invalid regex
			this.sentenceSplitRegex = new RegExp('(?<=[.?!])\\s+');
		}
		this.minChunkSize = options.minChunkSize;
		this.maxChunkSize = options.maxChunkSize;
		this.secondPassThreshold = options.secondPassThreshold ?? 0.8;
		this.contextPrompt = options.contextPrompt ?? `Generate a brief contextual summary for this text chunk to enhance search retrieval, two to three short sentences max. The chunk contains merged content from different document sections, so focus on the main topics and concepts rather than the sequential flow. Answer only with the succinct context and nothing else.`;
		this.includeLabels = options.includeLabels ?? false;
		this.useGlobalSummary = options.useGlobalSummary ?? false;
		this.globalSummaryPrompt = options.globalSummaryPrompt ?? `Summarize the following document in 5-7 sentences, focusing on the main topics and concepts that would help retrieve relevant chunks.`;
	}

	async splitText(text: string): Promise<string[]> {
		// Handle empty or whitespace-only text
		if (!text || text.trim().length === 0) return [];

		const MAX_TEXT_LENGTH = 10_000_000; // 10 MB
		if (text.length > MAX_TEXT_LENGTH) {
			throw new Error(
				`Input text is too large (${text.length} characters). Maximum allowed is ${MAX_TEXT_LENGTH} characters.`,
			);
		}

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

	override async splitDocuments(documents: Document[]): Promise<Document[]> {
		const splitDocuments: Document[] = [];

		for (const document of documents) {
			const chunks = await this.splitText(document.pageContent);
			let globalSummary: string | undefined;
			if (this.useGlobalSummary) {
				try {
					const summaryResponse = await this.chatModel.invoke(`${this.globalSummaryPrompt}\n\n<document>\n${document.pageContent}\n</document>`);
					if (typeof summaryResponse === 'string') {
						globalSummary = summaryResponse;
					} else if (summaryResponse && typeof (summaryResponse as any).content === 'string') {
						globalSummary = (summaryResponse as any).content as string;
					} else if (summaryResponse && Array.isArray((summaryResponse as any).content)) {
						const blocks = (summaryResponse as any).content as Array<any>;
						globalSummary = blocks
							.map((b) => (typeof b?.text === 'string' ? b.text : typeof b === 'string' ? b : ''))
							.filter(Boolean)
							.join('\n');
					}
				} catch {
					globalSummary = undefined;
				}
			}
			
			for (const chunk of chunks) {
				// Generate contextual description for this chunk
				const contextualContent = await this._generateContextualContent(
					document.pageContent,
					chunk,
					globalSummary,
				);
				
				splitDocuments.push(
					new Document({
						pageContent: contextualContent,
						metadata: { ...document.metadata },
					})
				);
			}
		}

		return splitDocuments;
	}

	private async _generateContextualContent(wholeDocument: string, chunk: string, globalSummary?: string): Promise<string> {
		try {
			// Build the full prompt with hardcoded structure
			const fullPrompt = globalSummary
				? `<document_summary>\n${globalSummary}\n</document_summary>\nHere is the chunk we want to situate within the document\n<chunk>\n${chunk}\n</chunk>\n${this.contextPrompt}`
				: `<document>\n${wholeDocument}\n</document>\nHere is the chunk we want to situate within the whole document\n<chunk>\n${chunk}\n</chunk>\n${this.contextPrompt}`;

			// Generate context using the chat model
			const response = await this.chatModel.invoke(fullPrompt);
			let context: string = '';
			if (typeof response === 'string') {
				context = response;
			} else if (response && typeof (response as any).content === 'string') {
				context = (response as any).content as string;
			} else if (response && Array.isArray((response as any).content)) {
				// Join text portions of content blocks if present
				const blocks = (response as any).content as Array<any>;
				context = blocks
					.map((b) => (typeof b?.text === 'string' ? b.text : typeof b === 'string' ? b : ''))
					.filter(Boolean)
					.join('\n');
			}
			
			// Combine context and chunk with selected format
			return this._formatContextualOutput(context, chunk);
		} catch (error) {
			console.error('Error generating contextual content:', error);
			// Fallback to just the chunk if context generation fails
			return chunk;
		}
	}

	private _formatContextualOutput(context: string, chunk: string): string {
		if (this.includeLabels) {
			return `Context: ${context}\n\nChunk: ${chunk}`;
		} else {
			return `${context}\n\n${chunk}`;
		}
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
				case 'percentile': {
					const percentile = 0.95;
					const sortedDist = [...distances].sort((a, b) => a - b);
					const index = Math.floor(sortedDist.length * percentile);
					// Ensure index is within bounds
					const safeIndex = Math.min(index, sortedDist.length - 1);
					threshold = sortedDist[safeIndex]!;
					break;
				}
				case 'standard_deviation': {
					const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
					const variance = distances.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / distances.length;
					const stdDev = Math.sqrt(variance);
					threshold = mean + stdDev;
					break;
				}
				case 'interquartile': {
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
				}
				case 'gradient': {
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
				}
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

export class SemanticSplitterWithContext implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Semantic Splitter with Context',
		name: 'contextualSemanticTextSplitterWithContext',
		icon: 'fa:cut',
		group: ['transform'],
		version: 1,
		description: 'Split text using semantic similarity with contextual enhancement for improved retrieval',
		defaults: {
			name: 'Semantic Splitter with Context',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Text Splitters'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://github.com/ResetNetwork/n8n-nodes/tree/main/n8n-nodes-semantic-splitter-with-context#readme',
					},
				],
			},
		},
		inputs: [
			{
				displayName: 'Chat Model',
				maxConnections: 1,
				type: 'aiLanguageModel' as any,
				required: true,
			},
			{
				displayName: 'Embeddings',
				maxConnections: 1,
				type: 'aiEmbedding' as any,
				required: true,
			},
		],
		outputs: [
			{
				displayName: 'Text Splitter',
				maxConnections: 1,
				type: 'aiTextSplitter' as any,
			},
		],
		properties: [
			{
				displayName: 'Context Prompt',
				name: 'contextPrompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: `Please generate a short succinct context summary to situate this text chunk within the overall document to enhance search retrieval, two or three sentences max. The chunk contains merged content from different document sections, so focus on the main topics and concepts rather than sequential flow. Answer only with the succinct context and nothing else.`,
				description: 'Instructions for the AI model on how to generate contextual descriptions. The document and chunk will be automatically provided in the prompt structure.',
			},
			{
				displayName: 'Include Labels in Output',
				name: 'includeLabels',
				type: 'boolean',
				default: false,
				description: 'Whether to include "Context:" and "Chunk:" labels in the output. When disabled, only the context and chunk content are included without labels.',
			},
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
					{
						displayName: 'Use Global Summary',
						name: 'useGlobalSummary',
						type: 'boolean',
						default: false,
						description: 'Generate a single document summary and use it to contextualize each chunk instead of including the entire document in every prompt',
					},
					{
						displayName: 'Global Summary Prompt',
						name: 'globalSummaryPrompt',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: 'Summarize the following document in 5-7 sentences, focusing on the main topics and concepts that would help retrieve relevant chunks.',
						description: 'Instructions for generating the global document summary when enabled',
						displayOptions: {
							show: {
								'/useGlobalSummary': [true],
							},
						},
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		console.log('ContextualSemanticSplitter: supplyData called!');
		
		const chatModel = (await this.getInputConnectionData(
			'aiLanguageModel' as any,
			itemIndex,
		)) as BaseLanguageModel;

		const embeddings = (await this.getInputConnectionData(
			'aiEmbedding' as any,
			itemIndex,
		)) as Embeddings;

		const contextPrompt = this.getNodeParameter('contextPrompt', itemIndex, '') as string;
		const includeLabels = this.getNodeParameter('includeLabels', itemIndex, false) as boolean;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			bufferSize?: number;
			breakpointThresholdType?: 'percentile' | 'standard_deviation' | 'interquartile' | 'gradient';
			breakpointThresholdAmount?: number;
			numberOfChunks?: number;
			secondPassThreshold?: number;
			minChunkSize?: number;
			maxChunkSize?: number;
			sentenceSplitRegex?: string;
			useGlobalSummary?: boolean;
			globalSummaryPrompt?: string;
		};

		const splitter = new SemanticDoublePassMergingSplitterWithContext(embeddings, chatModel, {
			bufferSize: options.bufferSize,
			breakpointThresholdType: options.breakpointThresholdType,
			breakpointThresholdAmount: options.breakpointThresholdAmount,
			numberOfChunks: options.numberOfChunks,
			secondPassThreshold: options.secondPassThreshold,
			minChunkSize: options.minChunkSize,
			maxChunkSize: options.maxChunkSize,
			sentenceSplitRegex: options.sentenceSplitRegex,
			contextPrompt,
			includeLabels,
			useGlobalSummary: options.useGlobalSummary,
			globalSummaryPrompt: options.globalSummaryPrompt,
		});

		// Return the splitter instance wrapped with logging for visual feedback
		console.log('ContextualSemanticSplitter: About to wrap splitter with logWrapper');
		const wrappedSplitter = logWrapper(splitter, this);
		console.log('ContextualSemanticSplitter: Wrapped splitter created');
		
		return {
			response: wrappedSplitter,
		};
	}
} 
