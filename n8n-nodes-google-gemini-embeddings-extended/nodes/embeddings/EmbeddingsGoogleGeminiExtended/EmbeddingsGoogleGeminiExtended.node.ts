import {
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { Embeddings } from '@langchain/core/embeddings';
import { logWrapper } from '../../utils/logWrapper';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';

// Custom GoogleGenerativeAIEmbeddings that properly supports outputDimensionality
class CustomGoogleGenerativeAIEmbeddings extends Embeddings {
	private apiKey: string;
	private baseUrl?: string;
	private model: string;
	private outputDimensionality?: number;
	private taskType?: string;
	private title?: string;
	private stripNewLines: boolean;

	constructor(config: {
		apiKey: string;
		baseUrl?: string;
		model: string;
		outputDimensionality?: number;
		taskType?: string;
		title?: string;
		stripNewLines?: boolean;
	}) {
		super({});
		this.apiKey = config.apiKey;
		this.baseUrl = config.baseUrl;
		this.model = config.model;
		this.outputDimensionality = config.outputDimensionality;
		this.taskType = config.taskType;
		this.title = config.title;
		this.stripNewLines = config.stripNewLines !== false;
	}

	private async makeApiCall(payload: any): Promise<any> {
		// Ensure model name doesn't have 'models/' prefix for the URL path
		const modelName = this.model.replace('models/', '');
		const url = `${this.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${modelName}:embedContent?key=${this.apiKey}`;
		
		console.log('CustomGoogleGenerativeAI: Making API call to:', url);
		console.log('CustomGoogleGenerativeAI: Model name used:', modelName);
		
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('CustomGoogleGenerativeAI: API Error Response:', errorText);
			throw new Error(`Google Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
		}

		return response.json();
	}

	async embedDocuments(documents: string[]): Promise<number[][]> {
		console.log('CustomGoogleGenerativeAI: embedDocuments called with', documents.length, 'documents');
		const results: number[][] = [];

		for (const document of documents) {
			const text = this.stripNewLines ? document.replace(/\n/g, ' ') : document;
			const payload: any = {
				content: { parts: [{ text }] },
			};

			// Add custom parameters that LangChain doesn't support
			if (this.outputDimensionality && this.outputDimensionality > 0) {
				payload.outputDimensionality = this.outputDimensionality;
				console.log('CustomGoogleGenerativeAI: Setting outputDimensionality to', this.outputDimensionality);
			}
			if (this.taskType) {
				payload.taskType = this.taskType;
			}
			if (this.title && this.taskType === 'RETRIEVAL_DOCUMENT') {
				payload.title = this.title;
			}

			console.log('CustomGoogleGenerativeAI: API payload:', JSON.stringify(payload, null, 2));

			try {
				const response = await this.makeApiCall(payload);
				const embedding = response.embedding?.values;
				
				if (!embedding || !Array.isArray(embedding)) {
					throw new Error('Invalid embedding response from Google Gemini API');
				}
				
				console.log('CustomGoogleGenerativeAI: Received embedding with', embedding.length, 'dimensions');
				results.push(embedding.map(Number));
			} catch (error) {
				console.error('CustomGoogleGenerativeAI: Error embedding document:', error);
				throw error;
			}
		}

		return results;
	}

	async embedQuery(query: string): Promise<number[]> {
		const results = await this.embedDocuments([query]);
		return results[0] || [];
	}
}

export class EmbeddingsGoogleGeminiExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings Google Gemini Extended',
		name: 'embeddingsGoogleGeminiExtended',
		group: ['transform'],
		version: 1,
		description: 'Use Google Gemini Embeddings with extended features like output dimensions support',
		defaults: {
			name: 'Embeddings Google Gemini Extended',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.embeddingsgooglegeminiai/',
					},
				],
			},
		},
		credentials: [
			{
				name: 'googlePalmApi',
				required: true,
			},
		],
		// This is a sub-node, it has no inputs
		inputs: [],
		// And it supplies data to the root node
		outputs: ['ai_embedding' as any],
		outputNames: ['Embeddings'],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: '={{ $credentials.host }}',
		},
		properties: [
			getConnectionHintNoticeField(['ai_vectorStore' as any]),
			{
				displayName: 'Each model is using different dimensional density for embeddings. Please make sure to use the same dimensionality for your vector store. The default model is using 768-dimensional embeddings.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Model',
				name: 'modelName',
				type: 'options',
				description: 'The model which will generate the embeddings. <a href="https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding">Learn more</a>.',
				typeOptions: {
					loadOptions: {
						routing: {
							request: {
								method: 'GET',
								url: '/v1beta/models',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'models',
										},
									},
									{
										type: 'filter',
										properties: {
											pass: "={{ $responseItem.name.includes('embedding') }}",
										},
									},
									{
										type: 'setKeyValue',
										properties: {
											name: '={{$responseItem.name}}',
											value: '={{$responseItem.name}}',
											description: '={{$responseItem.description}}',
										},
									},
									{
										type: 'sort',
										properties: {
											key: 'name',
										},
									},
								],
							},
						},
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'model',
					},
				},
				default: 'models/gemini-embedding-001',
			},
			{
				displayName: 'Output Dimensions',
				name: 'outputDimensions',
				type: 'number',
				default: 0,
				description: 'The number of dimensions for the output embeddings. Set to 0 to use the model default. Only supported by certain models like text-embedding-004 and gemini-embedding-001.',
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Task Type',
						name: 'taskType',
						type: 'options',
						default: 'RETRIEVAL_DOCUMENT',
						description: 'The type of task for which the embeddings will be used',
						options: [
							{
								name: 'Retrieval Document',
								value: 'RETRIEVAL_DOCUMENT',
							},
							{
								name: 'Retrieval Query',
								value: 'RETRIEVAL_QUERY',
							},
							{
								name: 'Semantic Similarity',
								value: 'SEMANTIC_SIMILARITY',
							},
							{
								name: 'Classification',
								value: 'CLASSIFICATION',
							},
							{
								name: 'Clustering',
								value: 'CLUSTERING',
							},
							{
								name: 'Question Answering',
								value: 'QUESTION_ANSWERING',
							},
							{
								name: 'Fact Verification',
								value: 'FACT_VERIFICATION',
							},
							{
								name: 'Code Retrieval Query',
								value: 'CODE_RETRIEVAL_QUERY',
							},
						],
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description: 'An optional title for the text. Only applicable when TaskType is RETRIEVAL_DOCUMENT.',
						displayOptions: {
							show: {
								taskType: ['RETRIEVAL_DOCUMENT'],
							},
						},
					},
					{
						displayName: 'Strip New Lines',
						name: 'stripNewLines',
						type: 'boolean',
						default: true,
						description: 'Whether to strip new lines from the input text',
					},
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						default: 100,
						description: 'Maximum number of texts to embed in a single request. Lower this value if you encounter rate limits.',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		this.logger.debug('Supply data for embeddings Google Gemini Extended');
		
		const modelName = this.getNodeParameter(
			'modelName',
			itemIndex,
			'models/gemini-embedding-001',
		) as string;
		const outputDimensions = this.getNodeParameter('outputDimensions', itemIndex, 0) as number;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			taskType?: string;
			title?: string;
			stripNewLines?: boolean;
			batchSize?: number;
		};

		const credentials = await this.getCredentials('googlePalmApi');

		// Debug logging
		this.logger.debug(`Model: ${modelName}, Output Dimensions: ${outputDimensions}`);
		console.log('GEMINI DEBUG - Model:', modelName, 'Output Dimensions:', outputDimensions, 'Type:', typeof outputDimensions);
		console.log('GEMINI DEBUG - Will set outputDimensionality:', outputDimensions > 0 ? outputDimensions : 'NO (using default)');

		// Create embeddings configuration
		const embeddingsConfig = {
			apiKey: credentials.apiKey as string,
			...(credentials.host && { baseUrl: credentials.host as string }),
			model: modelName,
			...(outputDimensions > 0 && { outputDimensionality: outputDimensions }),
			...(options.taskType && { taskType: options.taskType as any }),
			...(options.title && { title: options.title }),
			stripNewLines: options.stripNewLines !== false,
			maxConcurrency: 1,
			maxRetries: 3,
		};
		
		console.log('GEMINI DEBUG - Final config:', JSON.stringify(embeddingsConfig, null, 2));

		// Use custom implementation that properly supports outputDimensionality
		const embeddings = new CustomGoogleGenerativeAIEmbeddings(embeddingsConfig);

		// Return the embeddings instance wrapped with logging for visual feedback
		return {
			response: logWrapper(embeddings, this),
		};
	}
} 