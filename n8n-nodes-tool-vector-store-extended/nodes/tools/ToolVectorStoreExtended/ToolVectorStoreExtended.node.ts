import {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
	NodeConnectionType,
} from 'n8n-workflow';

import { DynamicTool } from '@langchain/core/tools';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { VectorStore } from '@langchain/core/vectorstores';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';
import { logWrapper } from '../../utils/logWrapper';

export class ToolVectorStoreExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vector Store Question Answer Tool Extended',
		name: 'toolVectorStoreExtended',
		icon: 'file:database.svg',
		group: ['transform'],
		version: 1,
		description: 'Generate a Vector Store Question Answer Tool with extended features and visual feedback',
		defaults: {
			name: 'Vector Store Question Answer Tool Extended',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.toolvectorstore/',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [
			{
				displayName: 'Vector Store',
				maxConnections: 1,
				type: NodeConnectionType.AiVectorStore,
			},
			{
				displayName: 'Language Model',
				maxConnections: 1,
				type: NodeConnectionType.AiLanguageModel,
			},
		],
		outputs: [NodeConnectionType.AiTool],
		outputNames: ['Tool'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionType.AiAgent]),
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: 'vector-store-qa',
				placeholder: 'e.g. knowledge-base, documents-qa, search-tool',
				description: 'The name of the tool. This will be used by the AI agent to identify and call this tool.',
				required: true,
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: 'A tool for answering questions by searching through a vector store of documents',
				placeholder: 'e.g. Search through our knowledge base to answer user questions',
				description: 'A description of what this tool does. This helps the AI agent understand when to use this tool.',
				typeOptions: {
					rows: 3,
				},
				required: true,
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options for the vector store tool',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Max Results',
						name: 'topK',
						type: 'number',
						default: 4,
						description: 'Maximum number of results to return from the vector store search. Higher values provide more context but may exceed token limits.',
						typeOptions: {
							minValue: 1,
							maxValue: 50,
						},
					},
					{
						displayName: 'Return Source Documents',
						name: 'returnSourceDocuments',
						type: 'boolean',
						default: false,
						description: 'Whether to return the source documents along with the answer. Useful for debugging or providing citations.',
					},
					{
						displayName: 'Chain Type',
						name: 'chainType',
						type: 'options',
						default: 'stuff',
						description: 'The type of chain to use for combining documents',
						options: [
							{
								name: 'Stuff',
								value: 'stuff',
								description: 'Stuff all documents into a single prompt (fastest, but limited by token length)',
							},
							{
								name: 'Map Reduce',
								value: 'map_reduce',
								description: 'Summarize each document first, then combine summaries (slower but handles more documents)',
							},
							{
								name: 'Refine',
								value: 'refine',
								description: 'Iteratively refine the answer by processing documents one by one',
							},
						],
					},
					{
						displayName: 'Custom Prompt Template',
						name: 'promptTemplate',
						type: 'string',
						default: '',
						placeholder: 'Use the following pieces of context to answer the question: {context}\n\nQuestion: {question}\nAnswer:',
						description: 'Custom prompt template for the QA chain. Use {context} for document content and {question} for the user question.',
						typeOptions: {
							rows: 4,
						},
					},
					{
						displayName: 'Verbose Logging',
						name: 'verbose',
						type: 'boolean',
						default: false,
						description: 'Enable verbose logging for debugging the chain execution',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
		console.log('ToolVectorStoreExtended: supplyData called!');
		
		const name = this.getNodeParameter('name', 0) as string;
		const description = this.getNodeParameter('description', 0) as string;
		const options = this.getNodeParameter('options', 0, {}) as {
			topK?: number;
			returnSourceDocuments?: boolean;
			chainType?: string;
			promptTemplate?: string;
			verbose?: boolean;
		};

		// Get the vector store and language model from input connections
		const vectorStore = (await this.getInputConnectionData(NodeConnectionType.AiVectorStore, 0)) as VectorStore;
		const model = (await this.getInputConnectionData(NodeConnectionType.AiLanguageModel, 0)) as BaseLanguageModel;

		if (!vectorStore) {
			throw new Error('Vector Store input is required');
		}

		if (!model) {
			throw new Error('Language Model input is required');
		}

		// Create the enhanced description
		const enhancedDescription = `${description}. Returns up to ${options.topK || 4} relevant results${
			options.returnSourceDocuments ? ' with source document citations' : ''
		}.`;

		// Create the DynamicTool (like the working example)
		const tool = new DynamicTool({
			name,
			description: enhancedDescription,
			func: async (input: string) => {
				try {
					console.log('ToolVectorStoreExtended: Tool function called with input:', input?.length || 0, 'characters');
					console.log('ToolVectorStoreExtended: Options:', JSON.stringify(options, null, 2));

					// Perform similarity search on the vector store
					let docs;
					try {
						docs = await vectorStore.similaritySearch(input, options.topK || 4);
						console.log('ToolVectorStoreExtended: Found', docs.length, 'documents');
					} catch (searchError) {
						console.error('ToolVectorStoreExtended: Error searching vector store:', searchError);
						
						// Try alternative search methods if the main one fails
						try {
							console.log('ToolVectorStoreExtended: Trying alternative search method...');
							// Try with different parameters or method
							docs = await vectorStore.similaritySearch(input, options.topK || 4, {});
						} catch (altSearchError) {
							console.error('ToolVectorStoreExtended: Alternative search also failed:', altSearchError);
							const errorMessage = searchError instanceof Error ? searchError.message : String(searchError);
							return `Error searching for documents: ${errorMessage}. This might be due to vector store schema mismatch. Please check that the vector store is properly configured and the data types match the expected schema.`;
						}
					}
					
					// If we have documents, use the language model to generate an answer
					if (docs.length === 0) {
						return 'No relevant documents found in the vector store.';
					}

					// Prepare context from retrieved documents
					const context = docs.map((doc, index) => 
						`Document ${index + 1}:\n${doc.pageContent}\n`
					).join('\n');

					// Use custom prompt template if provided, otherwise use default
					const defaultTemplate = `Use the following pieces of context to answer the question at the end.

{context}

Question: {question}
Answer:`;
					
					const promptTemplate = (options.promptTemplate && options.promptTemplate.trim()) 
						? options.promptTemplate
						: defaultTemplate;

					const prompt = promptTemplate
						.replace('{context}', context)
						.replace('{question}', input);

					console.log('ToolVectorStoreExtended: Generated prompt length:', prompt.length);

					// Generate answer using the language model
					const response = await model.invoke(prompt);
					console.log('ToolVectorStoreExtended: LLM response received');
					
					// Return source documents if requested
					if (options.returnSourceDocuments) {
						const result = {
							answer: typeof response === 'string' ? response : response.content || response.text || String(response),
							sourceDocuments: docs.map(doc => ({
								pageContent: doc.pageContent,
								metadata: doc.metadata
							}))
						};
						return JSON.stringify(result, null, 2);
					}

					return typeof response === 'string' ? response : response.content || response.text || String(response);
				} catch (error) {
					console.error('ToolVectorStoreExtended: Error in tool function:', error);
					throw error;
				}
			}
		});

		// Return the tool wrapped with logging for visual feedback
		console.log('ToolVectorStoreExtended: About to wrap tool with logWrapper');
		const wrappedTool = logWrapper(tool, this);
		console.log('ToolVectorStoreExtended: Wrapped tool created');
		
		return {
			response: wrappedTool,
		};
	}
} 