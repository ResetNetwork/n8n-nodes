import {
	ILoadOptionsFunctions,
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';

import { VertexAIEmbeddings } from '@langchain/google-vertexai';
import { logWrapper } from '../../utils/logWrapper';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';

export class EmbeddingsGoogleVertexExtended implements INodeType {

	description: INodeTypeDescription = {
		displayName: 'Embeddings Google Vertex Extended',
		name: 'embeddingsGoogleVertexExtended',
		icon: 'file:google.svg',
		group: ['transform'],
		version: 1,
		description: 'Use Google Vertex Embeddings with extended features like output dimensions support',
		defaults: {
			name: 'Embeddings Google Vertex Extended',
		},
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: '={{ $credentials.host }}',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.embeddingsgooglevertex/',
					},
				],
			},
		},
		credentials: [
			{
				name: 'googleApi',
				required: true,
			},
		],
		inputs: [],
		outputs: ['aiEmbedding' as any],
		outputNames: ['Embeddings'],
		properties: [
			getConnectionHintNoticeField(['aiVectorStore' as any]),
			{
				displayName: 'Each model is using different dimensional density for embeddings. Please make sure to use the same dimensionality for your vector store. The default model is using 768-dimensional embeddings. <a href="https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api">You can find available models here</a>.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'string',
				default: '',
				required: true,
				description: 'Your Google Cloud project ID',
			},
			{
				displayName: 'Model Name',
				name: 'modelName',
				type: 'string',
				description: 'The model which will generate the embeddings. <a href="https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api">Learn more</a>.',
				default: 'gemini-embedding-001',
			},
			{
				displayName: 'Output Dimensions',
				name: 'outputDimensions',
				type: 'number',
				default: 0,
				description: 'The number of dimensions for the output embeddings. Set to 0 to use the model default. Only supported by certain models like text-embedding-004 and text-embedding-005.',
			},
			{
				displayName: 'Batch Size',
				name: 'batchSize',
				type: 'number',
				default: 32,
				description: 'Number of documents to process per API request. Higher values can improve throughput but may hit rate limits.',
				typeOptions: {
					minValue: 1,
					maxValue: 250,
				},
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
						],
					},
				],
			},
		],
	};


	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		this.logger.debug('Supply data for embeddings Google Vertex Extended');
		
		const credentials = await this.getCredentials('googleApi');
		const privateKey = (credentials.privateKey as string).replace(/\\n/g, '\n');
		const email = (credentials.email as string).trim();
		const region = (credentials.region as string) || 'us-central1';
		const modelName = this.getNodeParameter('modelName', itemIndex) as string;
		const projectId = this.getNodeParameter('projectId', itemIndex) as string;
		const outputDimensions = this.getNodeParameter('outputDimensions', itemIndex, 0) as number;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			taskType?: string;
		};

		// Debug logging
		this.logger.debug(`Model: ${modelName}, Output Dimensions: ${outputDimensions}, Project: ${projectId}`);

		// Create embeddings instance using LangChain's VertexAIEmbeddings
		const embeddings = new VertexAIEmbeddings({
			authOptions: {
				projectId,
				credentials: {
					client_email: email,
					private_key: privateKey,
				},
			},
			location: region,
			model: modelName,
			...(outputDimensions > 0 && { outputDimensionality: outputDimensions }),
			...(options.taskType && { taskType: options.taskType as any }),
		});

		// Return the embeddings instance wrapped with logging for visual feedback
		return {
			response: logWrapper(embeddings, this),
		};
	}
} 