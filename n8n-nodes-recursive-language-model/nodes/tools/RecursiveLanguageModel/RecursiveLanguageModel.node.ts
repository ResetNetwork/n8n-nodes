import {
	ISupplyDataFunctions,
	INodeType,
	INodeTypeDescription,
	SupplyData,
} from 'n8n-workflow';

// Define connection types as constants to match runtime behavior
const NodeConnectionType = {
	AiLanguageModel: 'ai_languageModel',
	AiTool: 'ai_tool',
	AiMemory: 'ai_memory',
	Main: 'main',
} as const;

import { DynamicTool } from '@langchain/core/tools';
import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type { BaseMemory } from '@langchain/core/memory';

import { RecursiveLmExecutor } from './RecursiveLmExecutor';
import type { RlmConfig, RlmContext } from './types';

export class RecursiveLanguageModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Recursive Language Model',
		name: 'recursiveLanguageModel',
		group: ['transform'],
		version: 1,
		description: 'AI tool that processes unbounded context through recursive LM calls in a REPL environment',
		defaults: {
			name: 'Recursive Language Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
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
			{
				displayName: 'Context',
				maxConnections: 1,
				type: NodeConnectionType.Main,
				required: false,
			},
		],
		outputs: [NodeConnectionType.AiTool],
		outputNames: ['Tool'],
		properties: [
			{
				displayName: 'This node implements Recursive Language Models (RLM) - a pattern where LLMs process large contexts by recursively calling themselves within a REPL environment. Read more at https://alexzhang13.github.io/blog/2025/rlm/',
				name: 'notice',
				type: 'notice',
				default: '',
			},
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
						default: 'recursive_context_processor',
						placeholder: 'e.g., document_analyzer',
						description: 'Name for the AI tool. Must be valid identifier (lowercase, underscores).',
					},
					{
						displayName: 'Tool Description',
						name: 'description',
						type: 'string',
						default: 'Process and answer questions about large contexts using recursive analysis',
						placeholder: 'Describe what this tool does...',
						description: 'Description shown to the AI agent. Be specific about what data/context this tool processes.',
						typeOptions: {
							rows: 3,
						},
					},
				],
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

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		// Get parameters
		const toolOptions = this.getNodeParameter('toolOptions', itemIndex, {}) as {
			toolName?: string;
			description?: string;
		};
		const replOptions = this.getNodeParameter('replOptions', itemIndex, {}) as {
			maxIterations?: number;
			outputTruncationLength?: number;
			iterationTimeout?: number;
		};
		const recursionOptions = this.getNodeParameter('recursionOptions', itemIndex, {}) as {
			maxDepth?: number;
		};
		const contextOptions = this.getNodeParameter('contextOptions', itemIndex, {}) as {
			maxContextSize?: number;
			contextVarName?: string;
		};
		const options = this.getNodeParameter('options', itemIndex, {}) as {
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

		// Get pre-loaded context from main input if provided
		let preloadedContext: any = undefined;
		try {
			const items = this.getInputData();
			if (items && items.length > 0) {
				// Use the first item as context
				const contextItem = items[0];
				
				// Try to extract meaningful context from the item
				if (contextItem.json && Object.keys(contextItem.json).length > 0) {
					preloadedContext = contextItem.json;
				} else if (contextItem.binary) {
					// Handle binary data if present
					preloadedContext = { binary: 'Binary data present - access via binary property' };
				}
			}
		} catch (e) {
			// No context input, that's OK
		}

		// Build configuration
		const config: RlmConfig = {
			maxIterations: replOptions.maxIterations || 20,
			maxDepth: recursionOptions.maxDepth ?? 1,
			maxContextSize: contextOptions.maxContextSize || 10000000,
			outputTruncationLength: replOptions.outputTruncationLength || 5000,
			iterationTimeout: replOptions.iterationTimeout || 60000,
			debugging: options.debugging || false,
			toolName: toolOptions.toolName || 'recursive_context_processor',
			toolDescription: toolOptions.description || 'Process and answer questions about large contexts using recursive analysis',
		};

		// Build RLM context
		const rlmContext: RlmContext = {
			model,
			tools: tools.length > 0 ? tools : undefined,
			memory: memory || undefined,
			config,
			preloadedContext,
		};

		// Create the DynamicTool
		const tool = new DynamicTool({
			name: config.toolName,
			description: config.toolDescription,
			func: async (input: string) => {
				try {
					// Create executor for this query
					const executor = new RecursiveLmExecutor(rlmContext);
					
					// Execute RLM
					const result = await executor.execute(input);
					
					// Return answer with metadata if debugging
					if (config.debugging && result.metadata.executionHistory) {
						return JSON.stringify({
							answer: result.answer,
							metadata: {
								iterations: result.metadata.iterations,
								recursiveCalls: result.metadata.recursiveCalls,
								totalTime: result.metadata.totalTime,
								hitLimit: result.metadata.hitLimit,
							},
						}, null, 2);
					}
					
					return result.answer;
				} catch (error) {
					const errorMessage = (error as Error).message;
					throw new Error(`RLM execution failed: ${errorMessage}`);
				}
			},
		});

		return {
			response: tool,
		};
	}
}

