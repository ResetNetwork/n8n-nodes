import {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	NodeConnectionType,
} from 'n8n-workflow';

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';

export class EmbeddingsGoogleGeminiExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings Google Gemini Extended',
		name: 'embeddingsGoogleGeminiExtended',
		icon: 'file:GoogleGemini.svg',
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
		outputs: [NodeConnectionType.AiEmbedding],
		outputNames: ['Embeddings'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionType.AiVectorStore]),
			{
				displayName: 'Model Name',
				name: 'model',
				type: 'string',
				description:
					'The model to use for generating embeddings. <a href="https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding">Learn more</a>.',
				default: 'text-embedding-004',
				placeholder: 'e.g. text-embedding-004, embedding-001, gemini-embedding-001',
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

	async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
		const credentials = await this.getCredentials('googlePalmApi');
		
		const modelName = this.getNodeParameter('model', 0) as string;
		const outputDimensions = this.getNodeParameter('outputDimensions', 0, 0) as number;
		const options = this.getNodeParameter('options', 0, {}) as {
			taskType?: string;
			title?: string;
			stripNewLines?: boolean;
			batchSize?: number;
		};

		// Create a custom embeddings class that extends GoogleGenerativeAIEmbeddings
		class GoogleGeminiEmbeddingsExtended extends GoogleGenerativeAIEmbeddings {
			private outputDimensions: number;
			private customTaskType?: string;
			private customTitle?: string;
			private customBatchSize: number;

			constructor(config: any) {
				super(config);
				this.outputDimensions = config.outputDimensions || 0;
				this.customTaskType = config.taskType;
				this.customTitle = config.title;
				this.customBatchSize = config.batchSize || 100;
			}

			async embedDocuments(texts: string[]): Promise<number[][]> {
				const embeddings: number[][] = [];
				
				// Special handling for gemini-embedding-001 which only supports one input at a time
				if (this.model === 'gemini-embedding-001') {
					for (const text of texts) {
						const result = await this._embed([text]);
						embeddings.push(...result);
					}
				} else {
					// Process in batches for other models
					for (let i = 0; i < texts.length; i += this.customBatchSize) {
						const batch = texts.slice(i, i + this.customBatchSize);
						const batchResults = await this._embed(batch);
						embeddings.push(...batchResults);
					}
				}
				
				return embeddings;
			}

			private async _embed(texts: string[]): Promise<number[][]> {
				const apiKey = this.apiKey;
				const model = this.model;
				
				// Construct the API endpoint
				const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`;
				
				const embeddings: number[][] = [];
				
				for (const text of texts) {
					const requestBody: any = {
						model: `models/${model}`,
						content: {
							parts: [{
								text: this.stripNewLines ? text.replace(/\n/g, ' ') : text,
							}],
						},
					};
					
					// Add task type if specified
					if (this.customTaskType) {
						requestBody.taskType = this.customTaskType;
					}
					
					// Add title if specified and task type is RETRIEVAL_DOCUMENT
					if (this.customTitle && this.customTaskType === 'RETRIEVAL_DOCUMENT') {
						requestBody.title = this.customTitle;
					}
					
					// Add output dimensions if specified and greater than 0
					if (this.outputDimensions > 0) {
						requestBody.outputDimensionality = this.outputDimensions;
					}
					
					const response = await fetch(`${apiEndpoint}?key=${apiKey}`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(requestBody),
					});
					
					if (!response.ok) {
						const errorText = await response.text();
						throw new Error(`Google Gemini API error: ${response.statusText} - ${errorText}`);
					}
					
					const data = await response.json() as any;
					
					if (data.embedding && data.embedding.values) {
						embeddings.push(data.embedding.values);
					}
				}
				
				return embeddings;
			}
		}

		const embeddings = new GoogleGeminiEmbeddingsExtended({
			apiKey: credentials.apiKey as string,
			model: modelName,
			outputDimensions: outputDimensions,
			taskType: options.taskType,
			title: options.title,
			stripNewLines: options.stripNewLines !== false,
			batchSize: options.batchSize,
		});

		return {
			response: embeddings,
		};
	}
} 