import {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	NodeConnectionType,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IHttpRequestOptions,
} from 'n8n-workflow';

import { GoogleVertexAIEmbeddings } from '@langchain/community/embeddings/googlevertexai';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';
import { logWrapper } from '../../utils/logWrapper';

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
				try {
					const requestOptions: IHttpRequestOptions = {
						method: 'GET',
						url: 'https://cloudresourcemanager.googleapis.com/v1/projects',
						json: true,
					};

					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'googleApi',
						requestOptions,
					);

					const projects = response.projects || [];
					
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
		
		const projectId = this.getNodeParameter('projectId', 0) as string;
		const modelName = this.getNodeParameter('model', 0) as string;
		const outputDimensions = this.getNodeParameter('outputDimensions', 0, 0) as number;
		const options = this.getNodeParameter('options', 0, {}) as {
			region?: string;
			taskType?: string;
		};

		// Create embeddings instance using LangChain's GoogleVertexAIEmbeddings
		const embeddings = new GoogleVertexAIEmbeddings({
			model: modelName,
			...(outputDimensions > 0 && { outputDimensionality: outputDimensions }),
			...(options.taskType && { taskType: options.taskType as any }),
			authOptions: {
				projectId,
				// Will use the Google Cloud credentials from n8n
				scopes: ['https://www.googleapis.com/auth/cloud-platform'],
			},
		});

		// Return the embeddings instance wrapped with logging for visual feedback
		console.log('GoogleVertexEmbeddings: About to wrap embeddings with logWrapper');
		const wrappedEmbeddings = logWrapper(embeddings, this);
		console.log('GoogleVertexEmbeddings: Wrapped embeddings created');
		
		return {
			response: wrappedEmbeddings,
		};
	}
} 