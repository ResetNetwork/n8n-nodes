import {
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
} from 'n8n-workflow';

// Define connection types as constants to match runtime behavior
const NodeConnectionType = {
	AiEmbedding: 'ai_embedding',
	AiVectorStore: 'ai_vectorStore',
} as const;

import { VertexAIEmbeddings } from '@langchain/google-vertexai';
import { logWrapper } from '../../utils/logWrapper';

export class EmbeddingsGoogleVertexExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings Google Vertex Extended',
		name: 'embeddingsGoogleVertexExtended',
		group: ['transform'],
		version: 1,
		description: 'Use Google Vertex AI Embeddings with output dimensions support',
		defaults: {
			name: 'Embeddings Google Vertex Extended',
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
		// This is a sub-node, it has no inputs
		inputs: [],
        // And it supplies data to the root node
        outputs: [NodeConnectionType.AiEmbedding],
		outputNames: ['Embeddings'],
		properties: [
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'options',
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getProjects',
				},
				description: 'The Google Cloud project ID',
				required: true,
			},
			{
				displayName: 'Model Name',
				name: 'model',
				type: 'string',
				description:
					'The model to use for generating embeddings. <a href="https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api">Learn more</a>.',
				default: 'gemini-embedding-001',
				placeholder: 'e.g. text-embedding-004, text-multilingual-embedding-002',
			},
			{
				displayName: 'Output Dimensions',
				name: 'outputDimensions',
				type: 'number',
				default: 0,
				description: 'The number of dimensions for the output embeddings. Set to 0 to use the model default. Only supported by certain models like text-embedding-004.',
			},
			{
				displayName: 'Batch Size',
				name: 'batchSize',
				type: 'number',
				default: 1,
				description: 'Number of documents to process per API request. Vertex AI currently requires batchSize=1 for embedDocuments.',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
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
						displayName: 'Region',
						name: 'region',
						type: 'string',
						default: 'us-central1',
						description: 'The region where the model is deployed',
					},
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

	methods = {
		loadOptions: {
			async getProjects(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('googleApi');
				const { GoogleAuth } = await import('google-auth-library');
				
				const email = credentials.email as string;
				const privateKey = (credentials.privateKey as string).replace(/\\n/g, '\n');
				
				const auth = new GoogleAuth({
					credentials: {
						client_email: email,
						private_key: privateKey,
					},
					scopes: ['https://www.googleapis.com/auth/cloud-platform'],
				});

				try {
					const client = await auth.getClient();
					const accessToken = await client.getAccessToken();
					
					const response = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects', {
						headers: {
							'Authorization': `Bearer ${accessToken.token}`,
						},
					});

					if (!response.ok) {
						throw new Error('Failed to fetch projects');
					}

					const data = await response.json() as any;
					const projects = data.projects || [];
					
					return projects.map((project: any) => ({
						name: project.name || project.projectId,
						value: project.projectId,
					}));
				} catch (error) {
					console.error('Error fetching projects:', error);
					return [];
				}
			},
		},
	};

	async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
		console.log('GoogleVertexEmbeddings: supplyData called!');
		
		const credentials = await this.getCredentials('googleApi');
		const projectId = this.getNodeParameter('projectId', 0) as string;
		const modelName = this.getNodeParameter('model', 0) as string;
		const outputDimensions = this.getNodeParameter('outputDimensions', 0, 0) as number;
		const batchSize = this.getNodeParameter('batchSize', 0, 1) as number;
		const options = this.getNodeParameter('options', 0, {}) as {
			region?: string;
			taskType?: string;
		};

		const region = options.region || 'us-central1';

		// Format private key like the official node does
		const privateKey = (credentials.privateKey as string).replace(/\\n/g, '\n');

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