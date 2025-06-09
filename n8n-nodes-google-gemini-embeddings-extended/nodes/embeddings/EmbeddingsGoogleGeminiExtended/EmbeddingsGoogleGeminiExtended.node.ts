import {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	NodeConnectionType,
} from 'n8n-workflow';

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { logWrapper } from '../../utils/logWrapper';

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
		outputs: [NodeConnectionType.AiEmbedding],
		outputNames: ['Embeddings'],
		properties: [
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
		console.log('GoogleGeminiEmbeddings: supplyData called!');
		
		const credentials = await this.getCredentials('googlePalmApi');
		const modelName = this.getNodeParameter('model', 0) as string;
		const outputDimensions = this.getNodeParameter('outputDimensions', 0, 0) as number;
		const options = this.getNodeParameter('options', 0, {}) as {
			taskType?: string;
			title?: string;
			stripNewLines?: boolean;
			batchSize?: number;
		};

		// Create embeddings instance using LangChain's GoogleGenerativeAIEmbeddings
		const embeddings = new GoogleGenerativeAIEmbeddings({
			apiKey: credentials.apiKey as string,
			modelName: modelName,
			...(outputDimensions > 0 && { outputDimensionality: outputDimensions }),
			...(options.taskType && { taskType: options.taskType as any }),
			...(options.title && { title: options.title }),
			stripNewLines: options.stripNewLines !== false,
			maxConcurrency: 1,
			maxRetries: 3,
		});

		// Return the embeddings instance wrapped with logging for visual feedback
		console.log('GoogleGeminiEmbeddings: About to wrap embeddings with logWrapper');
		const wrappedEmbeddings = logWrapper(embeddings, this);
		console.log('GoogleGeminiEmbeddings: Wrapped embeddings created');
		
		return {
			response: wrappedEmbeddings,
		};
	}
} 