import {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';

// Define connection types as constants to match runtime behavior
const NodeConnectionType = {
	AiLanguageModel: 'ai_languageModel',
	AiEmbedding: 'ai_embedding', 
	AiTextSplitter: 'ai_textSplitter',
} as const;

import { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseLanguageModel } from '@langchain/core/language_models/base';
import { TextSplitter } from '@langchain/textsplitters';
import { logWrapper } from '../../utils/logWrapper';

type Chunk = {
	text: string;
	startIdx: number; // inclusive sentence index
	endIdx: number; // inclusive sentence index
};

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
	private documentSummaryCache: Map<string, string> = new Map();

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

		console.log('SemanticSplitter: splitText called with text length:', text.length);
		const { chunks } = await this._splitTextWithChunks(text);
		console.log('SemanticSplitter: splitText returning', chunks.length, 'chunks');
		return chunks.map((c) => c.text);
	}

	private async _splitTextWithChunks(text: string): Promise<{ chunks: Chunk[]; sentences: string[] }> {
		const sentences = this._splitTextIntoSentences(text);
		if (sentences.length === 0) return { chunks: [], sentences };

		if (sentences.length === 1) {
			const singleSentence = sentences[0]!.trim();
			if (!singleSentence) return { chunks: [], sentences };
			if (this.maxChunkSize && singleSentence.length > this.maxChunkSize) {
				const words = singleSentence.split(/\s+/);
				const out: Chunk[] = [];
				let current = '';
				for (const word of words) {
					if ((current ? current.length + 1 : 0) + word.length <= (this.maxChunkSize ?? Infinity)) {
						current = current ? current + ' ' + word : word;
					} else {
						if (current) out.push({ text: current, startIdx: 0, endIdx: 0 });
						current = word;
					}
				}
				if (current) out.push({ text: current, startIdx: 0, endIdx: 0 });
				return { chunks: out, sentences };
			}
			return { chunks: [{ text: singleSentence, startIdx: 0, endIdx: 0 }], sentences };
		}

		const combinedSentences = await this._combineSentences(sentences);
		const embeddings = await this._embedSentences(combinedSentences);
		const distances = this._calculateDistances(embeddings);
		if (distances.length === 0) {
			const onlyChunk: Chunk = { text: sentences.join(' ').trim(), startIdx: 0, endIdx: sentences.length - 1 };
			return { chunks: onlyChunk.text ? [onlyChunk] : [], sentences };
		}
		const breakpoints = this._calculateBreakpoints(distances);
		let chunks = this._createChunks(sentences, breakpoints);
		chunks = await this._secondPassMerge(chunks);
		chunks = this._applySizeConstraints(chunks, sentences);
		return { chunks, sentences };
	}

	override async splitDocuments(documents: Document[]): Promise<Document[]> {
		console.log('SemanticSplitter: splitDocuments called with', documents.length, 'documents');
		const splitDocuments: Document[] = [];

		for (const document of documents) {
			console.log('SemanticSplitter: Processing document with content length:', document.pageContent.length);
			const chunks = await this.splitText(document.pageContent);
			console.log('SemanticSplitter: Got', chunks.length, 'chunks from splitText');
			
			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i]!;
				console.log(`SemanticSplitter: Processing chunk ${i + 1}/${chunks.length}, length:`, chunk.length);
				
				// Generate contextual description for this chunk
				const contextualContent = await this._generateContextualContent(
					document.pageContent,
					chunk
				);
				
				console.log(`SemanticSplitter: Generated contextual content for chunk ${i + 1}, final length:`, contextualContent.length);
				
				splitDocuments.push(
					new Document({
						pageContent: contextualContent,
						metadata: { ...document.metadata },
					})
				);
			}
		}

		console.log('SemanticSplitter: splitDocuments returning', splitDocuments.length, 'documents');
		return splitDocuments;
	}

	private async _generateContextualContent(wholeDocument: string, chunk: string): Promise<string> {
		try {
			// Skip context generation for tiny documents that don't need summarization
			if (wholeDocument.length < 100) {
				return this._formatContextualOutput('', chunk);
			}

			let context: string = '';
			const documentHash = this._hashDocument(wholeDocument);

			// Only use Global Summary for documents large enough to benefit from it
			if (this.useGlobalSummary && wholeDocument.length > 1000) {
				// Generate document summary once and cache it
				let globalSummary = this.documentSummaryCache.get(documentHash);
				
				if (!globalSummary) {
					// Generate global summary for this document
					const summaryPrompt = `${this.globalSummaryPrompt}\n\n<document>\n${wholeDocument}\n</document>`;
					
					// Validate summary prompt size
					if (summaryPrompt.length > 100_000) {
						throw new Error(`Document too large for global summary (${summaryPrompt.length} characters). Consider using smaller documents.`);
					}
					
					const summaryResponse = await this.chatModel.invoke(summaryPrompt);
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
					
					if (globalSummary) {
						// Cache the summary and limit cache size
						if (this.documentSummaryCache.size >= 5) {
							// Clear oldest entry
							const firstKey = this.documentSummaryCache.keys().next().value;
							if (firstKey) this.documentSummaryCache.delete(firstKey);
						}
						this.documentSummaryCache.set(documentHash, globalSummary);
					}
				}
				
				// Use global summary as context (no additional API call)
				context = globalSummary || 'Unable to generate document summary';
			} else {
				// Generate specific context for this chunk using full document
				const fullPrompt = `<document>\n${wholeDocument}\n</document>\nHere is the chunk we want to situate within the whole document\n<chunk>\n${chunk}\n</chunk>\n${this.contextPrompt}`;

				// Validate payload size to prevent PayloadTooLargeError
				if (fullPrompt.length > 100_000) {
					throw new Error(
						`Prompt too large for API call (${fullPrompt.length} characters). Enable Global Summary to reduce prompt size.`,
					);
				}

				const response = await this.chatModel.invoke(fullPrompt);
				if (typeof response === 'string') {
					context = response;
				} else if (response && typeof (response as any).content === 'string') {
					context = (response as any).content as string;
				} else if (response && Array.isArray((response as any).content)) {
					const blocks = (response as any).content as Array<any>;
					context = blocks
						.map((b) => (typeof b?.text === 'string' ? b.text : typeof b === 'string' ? b : ''))
						.filter(Boolean)
						.join('\n');
				}
			}
			
			// Combine context and chunk with selected format
			return this._formatContextualOutput(context, chunk);
		} catch (error) {
			console.error('Error generating contextual content:', error);
			// Fallback to just the chunk if context generation fails
			return chunk;
		}
	}

	private _hashDocument(document: string): string {
		// Simple hash function for document caching
		let hash = 0;
		for (let i = 0; i < document.length; i++) {
			const char = document.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32-bit integer
		}
		return hash.toString();
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

	private _createChunks(sentences: string[], breakpoints: number[]): Chunk[] {
		const chunks: Chunk[] = [];
		let start = 0;

		for (const breakpoint of breakpoints) {
			const text = sentences.slice(start, breakpoint).join(' ');
			if (text.trim()) {
				chunks.push({ text: text.trim(), startIdx: start, endIdx: breakpoint - 1 });
			}
			start = breakpoint;
		}

		// Add the last chunk
		if (start < sentences.length) {
			const text = sentences.slice(start).join(' ');
			if (text.trim()) {
				chunks.push({ text: text.trim(), startIdx: start, endIdx: sentences.length - 1 });
			}
		}

		return chunks;
	}

	private async _secondPassMerge(chunks: Chunk[]): Promise<Chunk[]> {
		if (chunks.length <= 1) return chunks;

		// Get embeddings for all chunks
		const chunkEmbeddings = await this.embeddings.embedDocuments(chunks.map((c) => c.text));

		// Calculate similarities between adjacent chunks
		const mergedChunks: Chunk[] = [];
		let currentChunk = chunks[0]!;
		let currentEmbedding = chunkEmbeddings[0]!;
		let needsEmbeddingUpdate = false;

		for (let i = 1; i < chunks.length; i++) {
			const similarity = 1 - this._cosineDistance(currentEmbedding, chunkEmbeddings[i]!);

			if (similarity >= this.secondPassThreshold) {
				// Merge chunks
				currentChunk = {
					text: currentChunk.text + ' ' + chunks[i]!.text,
					startIdx: currentChunk.startIdx,
					endIdx: chunks[i]!.endIdx,
				};
				needsEmbeddingUpdate = true;
			} else {
				// If we merged chunks, recalculate embedding for the final merged chunk
				if (needsEmbeddingUpdate) {
					const [newEmbedding] = await this.embeddings.embedDocuments([currentChunk.text]);
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
			const [newEmbedding] = await this.embeddings.embedDocuments([currentChunk.text]);
			currentEmbedding = newEmbedding!;
		}
		mergedChunks.push(currentChunk);

		return mergedChunks;
	}

	private _applySizeConstraints(chunks: Chunk[], sentences: string[]): Chunk[] {
		if (!this.minChunkSize && !this.maxChunkSize) return chunks;

		const splitLarge: Chunk[] = [];
		for (const chunk of chunks) {
			if (this.maxChunkSize && chunk.text.length > this.maxChunkSize) {
				let acc = '';
				let start = chunk.startIdx;
				for (let i = chunk.startIdx; i <= chunk.endIdx; i++) {
					const sentence = sentences[i]!;
					const nextLen = (acc ? acc.length + 1 : 0) + sentence.length;
					if (nextLen <= this.maxChunkSize!) {
						acc = acc ? acc + ' ' + sentence : sentence;
					} else {
						if (acc) splitLarge.push({ text: acc, startIdx: start, endIdx: i - 1 });
						acc = sentence;
						start = i;
					}
				}
				if (acc) splitLarge.push({ text: acc, startIdx: start, endIdx: chunk.endIdx });
			} else {
				splitLarge.push(chunk);
			}
		}

		if (!this.minChunkSize) return splitLarge;

		const mergedSmall: Chunk[] = [];
		let current: Chunk | null = null;
		for (const chunk of splitLarge) {
			if (!current) {
				current = { ...chunk };
				continue;
			}
			if (current.text.length < this.minChunkSize!) {
				current = {
					text: current.text + ' ' + chunk.text,
					startIdx: current.startIdx,
					endIdx: chunk.endIdx,
				};
			} else {
				mergedSmall.push(current);
				current = { ...chunk };
			}
		}
		if (current) {
			if (current.text.length < this.minChunkSize! && mergedSmall.length > 0) {
				const last = mergedSmall.pop()!;
				mergedSmall.push({
					text: last.text + ' ' + current.text,
					startIdx: last.startIdx,
					endIdx: current.endIdx,
				});
			} else {
				mergedSmall.push(current);
			}
		}

		return mergedSmall;
	}
}

export class SemanticSplitterWithContext implements INodeType {
	// Static cache to prevent memory leaks from repeated instance creation
	private static splitterCache = new Map<string, SemanticDoublePassMergingSplitterWithContext>();
	
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
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.textsplittercontextualsemantic/',
					},
				],
			},
		},
		inputs: [
			{
				displayName: 'Chat Model',
				maxConnections: 1,
				type: NodeConnectionType.AiLanguageModel,
				required: true,
			},
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
				displayName: 'Context Prompt',
				name: 'contextPrompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: `Please generate a short succinct context summary to situate this text chunk within the overall document to enhance search retrieval, two or three sentances max. The chunk contains merged content from different document sections, so focus on the main topics and concepts rather than sequential flow. Answer only with the succinct context and nothing else.`,
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
						description: 'Generate a single document summary and reuse it for all chunks (reduces API calls and handles large documents)',
					},
					{
						displayName: 'Global Summary Prompt',
						name: 'globalSummaryPrompt',
						type: 'string',
						typeOptions: {
							rows: 4,
						},
						default: 'Summarize the following document in 5-7 sentences, focusing on the main topics and concepts that would help retrieve relevant chunks.',
						description: 'Instructions for generating the global document summary',
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
			NodeConnectionType.AiLanguageModel,
			itemIndex,
		)) as BaseLanguageModel;

		const embeddings = (await this.getInputConnectionData(
			NodeConnectionType.AiEmbedding,
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

		// Create cache key based on configuration to prevent memory leaks
		const cacheKey = JSON.stringify({
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

		// Use cached instance if available to prevent memory leaks on retries
		let splitter = SemanticSplitterWithContext.splitterCache.get(cacheKey);
		if (!splitter) {
			splitter = new SemanticDoublePassMergingSplitterWithContext(embeddings, chatModel, {
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
			
			// Cache the instance but limit cache size to prevent unbounded growth
			if (SemanticSplitterWithContext.splitterCache.size >= 10) {
				// Clear oldest entry when cache is full
				const firstKey = SemanticSplitterWithContext.splitterCache.keys().next().value;
				if (firstKey) {
					SemanticSplitterWithContext.splitterCache.delete(firstKey);
				}
			}
			SemanticSplitterWithContext.splitterCache.set(cacheKey, splitter);
		}

		// Return the splitter instance wrapped with logging for visual feedback
		console.log('ContextualSemanticSplitter: About to wrap splitter with logWrapper');
		const wrappedSplitter = logWrapper(splitter, this);
		console.log('ContextualSemanticSplitter: Wrapped splitter created');
		
		return {
			response: wrappedSplitter,
		};
	}
} 