import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { BaseMemory } from '@langchain/core/memory';

import { RecursiveLmExecutor } from './RecursiveLmExecutor';
import type { RlmConfig, RlmContext } from './types';

export class RecursiveLanguageModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Recursive Language Model Agent',
		name: 'recursiveLanguageModelAgent',
		icon: 'fa:code-branch',
		group: ['transform'],
		version: 1,
		description: 'AI agent that processes unbounded context through recursive LM calls in a REPL environment',
		defaults: {
			name: 'RLM Agent',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Agents', 'Chains'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://alexzhang13.github.io/blog/2025/rlm/',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [
			{
				displayName: 'LLM',
				maxConnections: 1,
				type: NodeConnectionType.AiLanguageModel,
				required: true,
			},
			{
				displayName: 'Tools',
				maxConnections: undefined, // Allow multiple tool connections
				type: NodeConnectionType.AiTool,
				required: false,
			},
			{
				displayName: 'Memory',
				maxConnections: 1,
				type: NodeConnectionType.AiMemory,
				required: false,
			},
			NodeConnectionType.Main,
		],
		outputs: [NodeConnectionType.Main],
		outputNames: ['Response'],
		properties: [
			{
				displayName: 'This node implements Recursive Language Models (RLM) - an AI agent that processes large contexts by recursively calling itself within a REPL environment. Can be called from other agents via Execute Sub-workflow. Read more at https://alexzhang13.github.io/blog/2025/rlm/',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'REPL Options',
				name: 'replOptions',
				placeholder: 'Add Option',
				description: 'Configure the REPL execution environment',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Max Iterations',
						name: 'maxIterations',
						type: 'number',
						default: 20,
						description: 'Maximum number of code execution iterations before stopping',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
					},
					{
						displayName: 'Output Truncation Length',
						name: 'outputTruncationLength',
						type: 'number',
						default: 5000,
						description: 'Maximum length of code execution output returned to LM (characters)',
						typeOptions: {
							minValue: 100,
							maxValue: 50000,
						},
					},
					{
						displayName: 'Iteration Timeout',
						name: 'iterationTimeout',
						type: 'number',
						default: 60000,
						description: 'Timeout for each code execution iteration (milliseconds)',
						typeOptions: {
							minValue: 1000,
							maxValue: 300000,
						},
					},
				],
			},
			{
				displayName: 'Recursion Options',
				name: 'recursionOptions',
				placeholder: 'Add Option',
				description: 'Configure recursive LM call behavior',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Max Recursion Depth',
						name: 'maxDepth',
						type: 'number',
						default: 1,
						description: 'Maximum depth of recursive rlm() calls (0 = root only, 1 = root + 1 level)',
						typeOptions: {
							minValue: 0,
							maxValue: 3,
						},
					},
				],
			},
			{
				displayName: 'Context Options',
				name: 'contextOptions',
				placeholder: 'Add Option',
				description: 'Configure context loading and management',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Max Context Size',
						name: 'maxContextSize',
						type: 'number',
						default: 10000000,
						description: 'Maximum size of pre-loaded context in characters (10M default)',
						typeOptions: {
							minValue: 1000,
							maxValue: 100000000,
						},
					},
					{
						displayName: 'Context Variable Name',
						name: 'contextVarName',
						type: 'string',
						default: 'context',
						description: 'Name of the variable holding pre-loaded context in REPL',
					},
				],
			},
			{
				displayName: 'Advanced Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Advanced configuration options',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Enable Debugging',
						name: 'debugging',
						type: 'boolean',
						default: false,
						description: 'Store execution trace in connected memory node. Requires memory connection.',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		// Get parameters (same for all items)
		const replOptions = this.getNodeParameter('replOptions', 0, {}) as {
			maxIterations?: number;
			outputTruncationLength?: number;
			iterationTimeout?: number;
		};
		const recursionOptions = this.getNodeParameter('recursionOptions', 0, {}) as {
			maxDepth?: number;
		};
		const contextOptions = this.getNodeParameter('contextOptions', 0, {}) as {
			maxContextSize?: number;
			contextVarName?: string;
		};
		const options = this.getNodeParameter('options', 0, {}) as {
			debugging?: boolean;
		};

		// Get connected inputs
		const model = (await this.getInputConnectionData(
			NodeConnectionType.AiLanguageModel,
			0,
		)) as BaseLanguageModel;
		
		if (!model) {
			throw new Error('Language Model connection is required');
		}

		// Get connected tools (can be multiple)
		const tools: StructuredToolInterface[] = [];
		let toolIndex = 0;
		try {
			while (true) {
				const tool = (await this.getInputConnectionData(
					NodeConnectionType.AiTool,
					toolIndex,
				)) as StructuredToolInterface | null;
				if (!tool) break;
				tools.push(tool);
				toolIndex++;
			}
		} catch (e) {
			// No more tools
		}

		// Get memory if connected
		const memory = (await this.getInputConnectionData(
			NodeConnectionType.AiMemory,
			0,
		)) as BaseMemory | null;

		// Build configuration
		const config: RlmConfig = {
			maxIterations: replOptions.maxIterations || 20,
			maxDepth: recursionOptions.maxDepth ?? 1,
			maxContextSize: contextOptions.maxContextSize || 10000000,
			outputTruncationLength: replOptions.outputTruncationLength || 5000,
			iterationTimeout: replOptions.iterationTimeout || 60000,
			debugging: options.debugging || false,
			toolName: 'rlm_agent',
			toolDescription: 'Recursive Language Model Agent',
		};

		// Process each item
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const item = items[itemIndex];
				
				// Extract query from item
				// Expected format: { query: "question...", context: optional }
				const query = item.json.query as string || item.json.input as string || JSON.stringify(item.json);
				
				// Get pre-loaded context from item if provided
				let preloadedContext: any = undefined;
				if (item.json.context) {
					preloadedContext = item.json.context;
				} else if (Object.keys(item.json).length > 0) {
					// Use entire item json as context (excluding query/input)
					const { query: _, input: __, ...rest } = item.json;
					if (Object.keys(rest).length > 0) {
						preloadedContext = rest;
					}
				}

				// Build RLM context for this item
				const rlmContext: RlmContext = {
					model,
					tools: tools.length > 0 ? tools : undefined,
					memory: memory || undefined,
					config,
					preloadedContext,
				};

				// Create executor and execute
				const executor = new RecursiveLmExecutor(rlmContext);
				const result = await executor.execute(query);

				// Build output item
				const outputItem: INodeExecutionData = {
					json: {
						query,
						answer: result.answer,
						metadata: {
							iterations: result.metadata.iterations,
							recursiveCalls: result.metadata.recursiveCalls,
							totalTime: result.metadata.totalTime,
							hitLimit: result.metadata.hitLimit,
						},
					},
					pairedItem: {
						item: itemIndex,
					},
				};

				// Add execution history if debugging
				if (config.debugging && result.metadata.executionHistory) {
					outputItem.json.executionHistory = result.metadata.executionHistory;
				}

				returnData.push(outputItem);

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

