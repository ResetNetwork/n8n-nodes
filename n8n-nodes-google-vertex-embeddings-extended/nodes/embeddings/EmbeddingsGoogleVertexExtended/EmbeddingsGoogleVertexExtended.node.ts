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
		const credentials = await this.getCredentials('googleApi');
		const privateKey = (credentials.privateKey as string).replace(/\\n/g, '\n');
		const email = (credentials.email as string).trim();
		const region = (credentials.region as string) || 'us-central1';
		const modelName = this.getNodeParameter('modelName', itemIndex) as string;
		const projectId = this.getNodeParameter('projectId', itemIndex) as string;
		const outputDimensions = this.getNodeParameter('outputDimensions', itemIndex, 0) as number;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			taskType?: string;
			batchSize?: number;
		};

		// Create base embeddings instance using LangChain's VertexAIEmbeddings (like official node)
		const baseEmbeddings = new VertexAIEmbeddings({
			authOptions: {
				projectId,
				credentials: {
					client_email: credentials.email as string,
					private_key: privateKey,
				},
			},
			location: region,
			model: modelName,
			...(outputDimensions > 0 && { outputDimensionality: outputDimensions }),
			...(options.taskType && { taskType: options.taskType as any }),
		});

		// Create wrapper that handles configurable batch size
		// LangChain assumes Vertex AI supports batch size 5, but it actually only supports 1
		class BatchAwareVertexAIEmbeddings {
			private baseEmbeddings: VertexAIEmbeddings;
			private batchSize: number;

			constructor(baseEmbeddings: VertexAIEmbeddings, batchSize: number) {
				this.baseEmbeddings = baseEmbeddings;
				this.batchSize = batchSize;
			}

			// Delegate embedQuery to base embeddings
			async embedQuery(document: string): Promise<number[]> {
				return this.baseEmbeddings.embedQuery(document);
			}

			async embedDocuments(documents: string[]): Promise<number[][]> {
				// If batch size is 1, use individual embedQuery calls (current Vertex AI requirement)
				if (this.batchSize === 1) {
					const embeddings: number[][] = [];
					for (const doc of documents) {
						const embedding = await this.baseEmbeddings.embedQuery(doc);
						embeddings.push(embedding);
					}
					return embeddings;
				} else {
					// For larger batch sizes, try the base implementation but with error handling
					try {
						return await this.baseEmbeddings.embedDocuments(documents);
					} catch (error) {
						// If batch fails, fall back to single document processing
						console.warn('Batch processing failed, falling back to single document processing:', error);
						const embeddings: number[][] = [];
						for (const doc of documents) {
							const embedding = await this.baseEmbeddings.embedQuery(doc);
							embeddings.push(embedding);
						}
						return embeddings;
					}
				}
			}

			// Delegate other commonly used properties/methods
			get modelName(): string {
				return (this.baseEmbeddings as any).modelName || 'google-vertex-ai';
			}
		}

		// Create embeddings instance with configurable batch size
		const batchSize = options.batchSize || 32;
		const embeddings = new BatchAwareVertexAIEmbeddings(baseEmbeddings, batchSize);

		// Return the embeddings instance wrapped with logging for visual feedback
		console.log('GoogleVertexEmbeddings: About to wrap embeddings with logWrapper');
		const wrappedEmbeddings = logWrapper(embeddings, this);
		console.log('GoogleVertexEmbeddings: Wrapped embeddings created');
		
		return {
			response: wrappedEmbeddings,
		};
	}
} 