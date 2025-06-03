import {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	NodeConnectionType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';

import { GoogleAuth } from 'google-auth-library';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';

export class EmbeddingsGoogleVertexExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings Google Vertex Extended',
		name: 'embeddingsGoogleVertexExtended',
		icon: 'file:GoogleVertexAI.svg',
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
			getConnectionHintNoticeField([NodeConnectionType.AiVectorStore]),
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
				default: 'text-embedding-004',
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
		const credentials = await this.getCredentials('googleApi');
		
		const projectId = this.getNodeParameter('projectId', 0) as string;
		const modelName = this.getNodeParameter('model', 0) as string;
		const outputDimensions = this.getNodeParameter('outputDimensions', 0, 0) as number;
		const options = this.getNodeParameter('options', 0, {}) as {
			region?: string;
			taskType?: string;
		};

		const email = credentials.email as string;
		const privateKey = (credentials.privateKey as string).replace(/\\n/g, '\n');
		const region = options.region || 'us-central1';

		const auth = new GoogleAuth({
			credentials: {
				client_email: email,
				private_key: privateKey,
			},
			scopes: ['https://www.googleapis.com/auth/cloud-platform'],
		});

		// Create a custom embeddings class that matches the LangChain interface
		class GoogleVertexAIEmbeddings {
			private auth: GoogleAuth;
			private projectId: string;
			private region: string;
			private modelName: string;
			private outputDimensions: number;
			private taskType?: string;

			constructor(config: {
				auth: GoogleAuth;
				projectId: string;
				region: string;
				modelName: string;
				outputDimensions: number;
				taskType?: string;
			}) {
				this.auth = config.auth;
				this.projectId = config.projectId;
				this.region = config.region;
				this.modelName = config.modelName;
				this.outputDimensions = config.outputDimensions;
				this.taskType = config.taskType;
			}

			async embedDocuments(texts: string[]): Promise<number[][]> {
				const client = await this.auth.getClient();
				const accessToken = await client.getAccessToken();
				
				const endpoint = `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.region}/publishers/google/models/${this.modelName}:predict`;

				const embeddings: number[][] = [];

				// Special handling for gemini-embedding-001 which only supports one input at a time
				if (this.modelName === 'gemini-embedding-001') {
					for (const text of texts) {
						const requestBody: any = {
							instances: [{
								content: text,
								...(this.taskType && { task_type: this.taskType }),
							}],
							parameters: {
								...(this.outputDimensions > 0 && { outputDimensionality: this.outputDimensions }),
							},
						};

						const response = await fetch(endpoint, {
							method: 'POST',
							headers: {
								'Authorization': `Bearer ${accessToken.token}`,
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(requestBody),
						});

						if (!response.ok) {
							const errorText = await response.text();
							throw new Error(`Google Vertex AI API error: ${response.statusText} - ${errorText}`);
						}

						const data = await response.json() as any;
						
						if (data.predictions && data.predictions[0]) {
							const embedding = data.predictions[0].embeddings?.values || data.predictions[0].embeddings;
							if (embedding) {
								embeddings.push(embedding);
							}
						}
					}
				} else {
					// Process in batches for other models
					const batchSize = 5;
					for (let i = 0; i < texts.length; i += batchSize) {
						const batch = texts.slice(i, i + batchSize);
						
						const requestBody: any = {
							instances: batch.map(text => ({
								content: text,
								...(this.taskType && { task_type: this.taskType }),
							})),
							parameters: {
								...(this.outputDimensions > 0 && { outputDimensionality: this.outputDimensions }),
							},
						};

						const response = await fetch(endpoint, {
							method: 'POST',
							headers: {
								'Authorization': `Bearer ${accessToken.token}`,
								'Content-Type': 'application/json',
							},
							body: JSON.stringify(requestBody),
						});

						if (!response.ok) {
							const errorText = await response.text();
							throw new Error(`Google Vertex AI API error: ${response.statusText} - ${errorText}`);
						}

						const data = await response.json() as any;
						
						if (data.predictions) {
							for (const prediction of data.predictions) {
								const embedding = prediction.embeddings?.values || prediction.embeddings;
								if (embedding) {
									embeddings.push(embedding);
								}
							}
						}
					}
				}

				return embeddings;
			}

			async embedQuery(text: string): Promise<number[]> {
				const embeddings = await this.embedDocuments([text]);
				return embeddings[0];
			}
		}

		const embeddings = new GoogleVertexAIEmbeddings({
			auth,
			projectId,
			region,
			modelName,
			outputDimensions,
			taskType: options.taskType,
		});

		return {
			response: embeddings,
		};
	}
} 