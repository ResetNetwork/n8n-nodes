import {
    ISupplyDataFunctions,
    INodeType,
    INodeTypeDescription,
    SupplyData,
} from 'n8n-workflow';

import { DynamicTool } from '@langchain/core/tools';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { VectorStore } from '@langchain/core/vectorstores';
import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseMemory } from '@langchain/core/memory';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';
import { nodeNameToToolName } from '../../utils/helpers';
import { logWrapper } from '../../utils/logWrapper';

// Import the new modular strategy system
import { StrategyRegistry } from './strategies';
import type { StrategyContext, StrategyConfig } from './shared/types';

export class QueryRetrieverRerank implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Query Retriever with Rerank',
		name: 'queryRetrieverRerank',
		group: ['transform'],
		version: 1,
		description: 'Query retrieval tool with multi-query strategies, intelligent reranking, and comprehensive debugging',
		defaults: {
			name: 'Query Retriever with Rerank',
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
				displayName: 'Vector',
				maxConnections: 1,
                type: 'aiVectorStore' as any,
			},
			{
				displayName: 'LLM',
				maxConnections: 1,
                type: 'aiLanguageModel' as any,
			},
			{
				displayName: 'Embed',
				maxConnections: 1,
                type: 'aiEmbedding' as any,
				required: true,
			},
			{
				displayName: 'Debug',
				maxConnections: 1,
                type: 'aiMemory' as any,
				required: false,
			},
		],
        outputs: [
            {
                displayName: 'Tool',
                maxConnections: 1,
                type: 'aiTool' as any,
            },
        ],
		outputNames: ['Tool'],
		properties: [
            getConnectionHintNoticeField(['aiAgent']),
			{
				displayName: 'Tool Options',
				name: 'toolOptions',
				placeholder: 'Add Option',
				description: 'Configure the AI tool name and description',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Tool Name',
						name: 'toolName',
						type: 'string',
						default: '',
						placeholder: 'Leave empty to use node name automatically',
						description: 'Custom name for the AI tool. If empty, will use the node name from the interface (safer for API compatibility).',
					},
					{
						displayName: 'Tool Description',
						name: 'description',
						type: 'string',
						default: 'A tool for answering questions by searching through a vector store of documents',
						placeholder: 'Describe your data here, e.g. user information, knowledge base, etc.',
						description: 'Describe the data in vector store. This will be used to fill the tool description.',
						typeOptions: {
							rows: 3,
						},
					},
				],
			},
			{
				displayName: 'Retrieval Options',
				name: 'retrievalOptions',
				placeholder: 'Add Option',
				description: 'Configure document retrieval and reranking behavior',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Documents to Retrieve',
						name: 'documentsToRetrieve',
						type: 'number',
						default: 10,
						description: 'Number of documents to initially retrieve from the vector store before reranking.',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
					},
					{
						displayName: 'Documents to Return',
						name: 'documentsToReturn',
						type: 'number',
						default: 4,
						description: 'Number of top-ranked documents to use for answer generation and return in results.',
						typeOptions: {
							minValue: 1,
							maxValue: 50,
						},
					},
					{
						displayName: 'Return Ranked Documents',
						name: 'returnRankedDocuments',
						type: 'boolean',
						default: false,
						description: 'Whether to return the reranked documents along with the answer for debugging or citations.',
					},
				],
			},
			{
				displayName: 'Query Strategy Options',
				name: 'queryStrategy',
				placeholder: 'Add Option',
				description: 'Configure how to process and respond with retrieved documents',
				type: 'collection',
				default: {
					strategyType: 'simple_query'
				},
				options: [
					{
						displayName: 'Strategy Type',
						name: 'strategyType',
						type: 'options',
						default: 'simple_query',
						description: 'How to process the retrieved documents to generate a response',
						options: StrategyRegistry.getStrategyOptions(),
					},
					{
						displayName: 'Number of Query Variations',
						name: 'queryVariations',
						type: 'number',
						default: 3,
						description: 'Number of alternative queries to generate for multi-query retrieval',
						typeOptions: {
							minValue: 2,
							maxValue: 8,
						},
						displayOptions: {
							show: {
								strategyType: ['multi_query'],
							},
						},
					},
					{
						displayName: 'Include Original Query',
						name: 'includeOriginalQuery',
						type: 'boolean',
						default: true,
						description: 'Whether to include the original query in addition to the generated variations',
						displayOptions: {
							show: {
								strategyType: ['multi_query'],
							},
						},
					},
					{
						displayName: 'Max Reasoning Steps',
						name: 'maxSteps',
						type: 'number',
						default: 3,
						description: 'Maximum number of reasoning steps for multi-step query decomposition',
						typeOptions: {
							minValue: 1,
							maxValue: 8,
						},
						displayOptions: {
							show: {
								strategyType: ['multi_step_query'],
							},
						},
					},
					{
						displayName: 'Enable Early Stopping',
						name: 'enableEarlyStop',
						type: 'boolean',
						default: true,
						description: 'Stop reasoning early when sufficient information is gathered to answer the original question',
						displayOptions: {
							show: {
								strategyType: ['multi_step_query'],
							},
						},
					},
					{
						displayName: 'Query Prompt Template',
						name: 'promptTemplate',
						type: 'string',
						default: '',
						placeholder: 'Use the following pieces of context to answer the question: {context}\\n\\nQuestion: {question}\\nAnswer:',
						description: 'For Simple Query/Multi-Query: Answer generation template using {context} and {question}. For Multi-Query: Custom instructions for query generation using {count}.',
						typeOptions: {
							rows: 4,
						},
						displayOptions: {
							show: {
								strategyType: ['simple_query', 'multi_query'],
							},
						},
					},
				],
			},
			{
				displayName: 'Advanced Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Advanced configuration options for the vector store tool',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Debugging',
						name: 'debugging',
						type: 'boolean',
						default: false,
						description: 'Store detailed execution metrics in the connected memory node. Requires a memory node connection.',
					},
					{
						displayName: 'LLM Debug Analysis',
						name: 'llmDebugAnalysis',
						type: 'boolean',
						default: false,
						description: 'Generate AI-powered performance analysis using the connected language model. WARNING: This will significantly slow down query response times as it requires an additional LLM call to analyze debug data.',
						displayOptions: {
							show: {
								debugging: [true],
							},
						},
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const node = this.getNode();
		const toolOptions = this.getNodeParameter('toolOptions', itemIndex, {}) as {
			toolName?: string;
			description?: string;
		};
		
		// Use custom name if provided, otherwise fall back to node name
		const rawName = toolOptions.toolName?.trim() || node.name;
		// Always apply nodeNameToToolName sanitization to ensure API compatibility
		const name = nodeNameToToolName({ name: rawName } as any);
		const description = toolOptions.description || 'A tool for answering questions by searching through a vector store of documents';

		// Get parameters
		const retrievalOptions = this.getNodeParameter('retrievalOptions', itemIndex, {}) as {
			documentsToRetrieve?: number;
			documentsToReturn?: number;
			returnRankedDocuments?: boolean;
		};
		const queryStrategy = this.getNodeParameter('queryStrategy', itemIndex, { strategyType: 'simple_query' }) as {
			strategyType: string;
			promptTemplate?: string;
			queryVariations?: number;
			includeOriginalQuery?: boolean;
			maxSteps?: number;
			enableEarlyStop?: boolean;
		};
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			debugging?: boolean;
			llmDebugAnalysis?: boolean;
		};

		// Get the vector store and language model from input connections
        const vectorStore = (await this.getInputConnectionData('aiVectorStore' as any, itemIndex)) as VectorStore;
        const model = (await this.getInputConnectionData('aiLanguageModel' as any, 0)) as BaseLanguageModel;
        const rerankingEmbeddings = (await this.getInputConnectionData('aiEmbedding' as any, 0)) as Embeddings;
        const memory = (await this.getInputConnectionData('aiMemory' as any, 0)) as BaseMemory | null;

		if (!vectorStore) {
			throw new Error('Vector Store input is required');
		}

		if (!model) {
			throw new Error('Language Model input is required');
		}

		// Reranking embeddings are now required since we always rerank
		if (!rerankingEmbeddings) {
			throw new Error('Reranking Embeddings input is required for document reranking');
		}

		// Create strategy configuration
		const strategyConfig: StrategyConfig = {
			documentsToRetrieve: retrievalOptions.documentsToRetrieve || 10,
			documentsToReturn: retrievalOptions.documentsToReturn || 4,
			returnRankedDocuments: retrievalOptions.returnRankedDocuments || false,
			promptTemplate: queryStrategy.promptTemplate,
			queryVariations: queryStrategy.queryVariations,
			includeOriginalQuery: queryStrategy.includeOriginalQuery,
			maxSteps: queryStrategy.maxSteps,
			enableEarlyStop: queryStrategy.enableEarlyStop,
		};

		// Create strategy context
		const strategyContext: StrategyContext = {
			vectorStore,
			model,
			embeddings: rerankingEmbeddings,
			memory,
			config: strategyConfig,
			debugging: options.debugging || false,
			llmDebugAnalysis: options.llmDebugAnalysis || false,
		};

		// Create the enhanced description  
		const strategyType = queryStrategy.strategyType;
		const strategy = StrategyRegistry.getStrategy(strategyType);
		const enhancedDescription = `${description}. ${strategy.getDescription()}${
			retrievalOptions.returnRankedDocuments ? ' with ranked document citations' : ''
		}. Supports AI-controlled retrieval parameters.`;

		// Create the DynamicTool
		const tool = new DynamicTool({
			name,
			description: enhancedDescription,
			func: async (input: string) => {
				try {
					// Execute the strategy
					const result = await strategy.execute(input, strategyContext);
					
					if (result.error) {
						throw new Error(result.error);
					}

					// Handle different return formats
					if (result.sourceDocuments && !result.answer) {
						// Documents only (none strategy)
						return JSON.stringify({
							sourceDocuments: result.sourceDocuments
						}, null, 2);
					}

					if (result.sourceDocuments && result.answer) {
						// Answer with source documents
						return JSON.stringify({
							answer: result.answer,
							sourceDocuments: result.sourceDocuments
						}, null, 2);
					}

					// Simple answer return
					return result.answer || 'No result generated';

				} catch (error) {
					throw error;
				}
			}
		});

		// Return the tool wrapped with logging for visual feedback
		const wrappedTool = logWrapper(tool, this);
		
		return {
			response: wrappedTool,
		};
	}
}