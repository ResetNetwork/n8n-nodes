import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import {
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	nodeConnectionTypes,
	NodeOperationError,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { transportSelect } from './descriptions';
import { getTools } from './loadOptions';
import { logWrapper } from './logWrapper';
import { getConnectionHintNoticeField } from './sharedFields';
import type { McpServerTransport, McpAuthenticationOption, McpToolIncludeMode } from './types';
import {
	connectMcpClient,
	createCallTool,
	createMcpToolkit,
	evaluateToolRules,
	getAllTools,
	getAuthHeaders,
	getSelectedTools,
	mcpToolToDynamicTool,
	mergeCustomHeaders,
	tryRefreshOAuth2Token,
} from './utils';

/**
 * Get node parameters for MCP client configuration
 */
function getNodeConfig(
	ctx: ISupplyDataFunctions | IExecuteFunctions,
	itemIndex: number,
): {
	authentication: McpAuthenticationOption;
	timeout: number;
	serverTransport: McpServerTransport;
	endpointUrl: string;
	mode: McpToolIncludeMode;
	includeTools: string[];
	excludeTools: string[];
	customHeaders?: IDataObject;
	enableDynamicFiltering: boolean;
	evaluationExpression: string;
	toolAccessRules: Array<{
		matchValues: string;
		ruleAction: 'includeSpecific' | 'includeAll' | 'excludeAll';
		tools?: string[];
	}>;
	defaultBehavior: 'useBaseMode' | 'excludeAll';
} {
	const authentication = ctx.getNodeParameter(
		'authentication',
		itemIndex,
	) as McpAuthenticationOption;
	const timeout = ctx.getNodeParameter('options.timeout', itemIndex, 60000) as number;

	const serverTransport = ctx.getNodeParameter('serverTransport', itemIndex) as McpServerTransport;
	const endpointUrl = ctx.getNodeParameter('endpointUrl', itemIndex) as string;

	const mode = ctx.getNodeParameter('include', itemIndex) as McpToolIncludeMode;
	const includeTools = ctx.getNodeParameter('includeTools', itemIndex, []) as string[];
	const excludeTools = ctx.getNodeParameter('excludeTools', itemIndex, []) as string[];

	// Get custom headers from fixedCollection
	const customHeadersData = ctx.getNodeParameter('options.customHeaders', itemIndex, {}) as {
		values?: Array<{ name: string; value: string }>;
	};
	
	// Convert array format to object for header merging
	let customHeaders: IDataObject | undefined;
	if (customHeadersData?.values && Array.isArray(customHeadersData.values)) {
		customHeaders = customHeadersData.values.reduce((acc, header) => {
			if (header.name && header.value) {
				acc[header.name] = header.value;
			}
			return acc;
		}, {} as IDataObject);
	}

	// Get dynamic filtering parameters
	const toolFilteringConfig = ctx.getNodeParameter(
		'toolFiltering.config',
		itemIndex,
		null,
	) as {
		defaultBehavior: 'useBaseMode' | 'excludeAll';
		evaluationExpression: string;
		toolAccessRules: {
			rules: Array<{
				matchValues: string;
				ruleAction: 'includeSpecific' | 'includeAll' | 'excludeAll';
				tools?: string[];
			}>;
		};
	} | null;

	const enableDynamicFiltering = toolFilteringConfig !== null;
	const evaluationExpression = toolFilteringConfig?.evaluationExpression || '';
	const toolAccessRulesData = toolFilteringConfig?.toolAccessRules?.rules || [];
	const defaultBehavior = toolFilteringConfig?.defaultBehavior || 'useBaseMode';

	return {
		authentication,
		timeout,
		serverTransport,
		endpointUrl,
		mode,
		includeTools,
		excludeTools,
		customHeaders,
		enableDynamicFiltering,
		evaluationExpression,
		toolAccessRules: toolAccessRulesData,
		defaultBehavior,
	};
}

/**
 * Connect to MCP server and get filtered tools
 */
async function connectAndGetTools(
	ctx: ISupplyDataFunctions | IExecuteFunctions,
	config: ReturnType<typeof getNodeConfig>,
) {
	const node = ctx.getNode();
	const { headers: authHeaders } = await getAuthHeaders(ctx, config.authentication);

	// Merge custom headers with auth headers
	const headers = mergeCustomHeaders(authHeaders, config.customHeaders);

	const client = await connectMcpClient({
		serverTransport: config.serverTransport,
		endpointUrl: config.endpointUrl,
		headers,
		name: node.type,
		version: node.typeVersion,
		onUnauthorized: async (headers) =>
			await tryRefreshOAuth2Token(ctx, config.authentication, headers),
	});

	if (!client.ok) {
		return { client, mcpTools: null, error: client.error };
	}

	const allTools = await getAllTools(client.result);
	const mcpTools = getSelectedTools({
		tools: allTools,
		mode: config.mode,
		includeTools: config.includeTools,
		excludeTools: config.excludeTools,
	});

	return { client: client.result, mcpTools, error: null };
}

export class McpClientExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MCP Client Extended',
		name: 'mcpClientExtended',
		icon: {
			light: 'file:mcp.svg',
			dark: 'file:mcp.dark.svg',
		},
		group: ['output'],
		version: 1,
		description: 'Connect tools from an MCP Server with custom headers support',
		defaults: {
			name: 'MCP Client Extended',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Model Context Protocol', 'Tools'],
			},
			alias: ['Model Context Protocol', 'MCP Client', 'Custom Headers'],
		},
		inputs: [],
		outputs: [{ type: 'ai_tool', displayName: 'Tools' }],
		credentials: [
			{
				name: 'httpBearerAuth',
				required: true,
				displayOptions: {
					show: {
						authentication: ['bearerAuth'],
					},
				},
			},
			{
				name: 'httpHeaderAuth',
				required: true,
				displayOptions: {
					show: {
						authentication: ['headerAuth'],
					},
				},
			},
			{
				name: 'httpMultipleHeadersAuth',
				required: true,
				displayOptions: {
					show: {
						authentication: ['multipleHeadersAuth'],
					},
				},
			},
			{
				name: 'mcpOAuth2Api',
				required: true,
				displayOptions: {
					show: {
						authentication: ['mcpOAuth2Api'],
					},
				},
			},
		],
		properties: [
			getConnectionHintNoticeField(['ai_agent']),
			{
				displayName: 'Endpoint',
				name: 'endpointUrl',
				type: 'string',
				description: 'Endpoint of your MCP server',
				placeholder: 'e.g. https://my-mcp-server.ai/mcp',
				default: '',
				required: true,
			},
			transportSelect({
				defaultOption: 'httpStreamable',
				displayOptions: { show: {} },
			}),
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'Bearer Auth',
						value: 'bearerAuth',
					},
					{
						name: 'Header Auth',
						value: 'headerAuth',
					},
					{
						name: 'MCP OAuth2',
						value: 'mcpOAuth2Api',
					},
					{
						name: 'Multiple Headers Auth',
						value: 'multipleHeadersAuth',
					},
					{
						name: 'None',
						value: 'none',
					},
				],
				default: 'none',
				description: 'The way to authenticate with your endpoint',
			},
			{
				displayName: 'Credentials',
				name: 'credentials',
				type: 'credentials',
				default: '',
				displayOptions: {
					show: {
						authentication: ['headerAuth', 'bearerAuth', 'mcpOAuth2Api', 'multipleHeadersAuth'],
					},
				},
			},
			{
				displayName: 'Tools to Include',
				name: 'include',
				type: 'options',
				description: 'How to select the tools you want to be exposed to the AI Agent',
				default: 'all',
				options: [
					{
						name: 'All',
						value: 'all',
						description: 'Include all tools from the MCP server',
					},
					{
						name: 'Selected',
						value: 'selected',
						description: 'Include only the tools listed in the parameter "Tools to Include"',
					},
					{
						name: 'All Except',
						value: 'except',
						description: 'Exclude the tools listed in the parameter "Tools to Exclude"',
					},
				],
			},
			{
				displayName: 'Tools to Include',
				name: 'includeTools',
				type: 'multiOptions',
				default: [],
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getTools',
				},
				displayOptions: {
					show: {
						include: ['selected'],
					},
				},
			},
			{
				displayName: 'Tools to Exclude',
				name: 'excludeTools',
				type: 'multiOptions',
				default: [],
				description:
					'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
				typeOptions: {
					loadOptionsMethod: 'getTools',
				},
				displayOptions: {
					show: {
						include: ['except'],
					},
				},
			},
		{
			displayName: 'Tool Filtering',
			name: 'toolFiltering',
			type: 'fixedCollection',
			typeOptions: {
				multipleValues: false,
			},
			default: {},
			placeholder: 'Add Tool Filtering',
			description: 'Configure dynamic tool filtering based on workflow data',
			options: [
				{
					displayName: 'Configuration',
					name: 'config',
					values: [
						{
							displayName: 'Default Behavior',
							name: 'defaultBehavior',
							type: 'options',
							default: 'useBaseMode',
							options: [
								{
									name: 'Use Base Mode Filter',
									value: 'useBaseMode',
									description: 'Use the "Tools to Include" mode when no rule matches',
								},
								{
									name: 'Exclude All Tools',
									value: 'excludeAll',
									description: 'Expose no tools when no rule matches',
								},
							],
							description: 'What to do when no rule matches the evaluation expression',
						},
						{
							displayName: 'Evaluation Expression',
							name: 'evaluationExpression',
							type: 'string',
							default: '',
							placeholder: "e.g. {{ $('PreviousNode').item.json.team }}",
							description: 'Expression that returns the value to evaluate against rules. Reference other nodes in the workflow.',
						},
						{
							displayName: 'Tool Access Rules',
							name: 'toolAccessRules',
							type: 'fixedCollection',
							typeOptions: {
								multipleValues: true,
							},
							default: {},
							placeholder: 'Add Rule',
							description: 'Rules evaluated against the expression value. First matching rule wins.',
							options: [
								{
									displayName: 'Rule',
									name: 'rules',
									values: [
										{
											displayName: 'Match Values',
											name: 'matchValues',
											type: 'string',
											default: '',
											placeholder: 'dev,ext-dev,admin',
											description: 'Comma-separated values to match. Leave empty to match any value (catch-all rule).',
										},
										{
											displayName: 'Rule Action',
											name: 'ruleAction',
											type: 'options',
											default: 'includeSpecific',
											options: [
												{
													name: 'Include Specific Tools',
													value: 'includeSpecific',
													description: 'Expose only the tools listed below',
												},
												{
													name: 'Include All Tools',
													value: 'includeAll',
													description: 'Expose all tools (after base mode filtering)',
												},
												{
													name: 'Exclude All Tools',
													value: 'excludeAll',
													description: 'Expose no tools',
												},
											],
										},
										{
											displayName: 'Tools',
											name: 'tools',
											type: 'multiOptions',
											default: [],
											typeOptions: {
												loadOptionsMethod: 'getTools',
											},
											displayOptions: {
												show: {
													ruleAction: ['includeSpecific'],
												},
											},
											description: 'Tools to expose when this rule matches',
										},
									],
								},
							],
						},
					],
				},
			],
		},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
						default: 60000,
						description: 'Time in ms to wait for tool calls to finish',
					},
					{
						displayName: 'Custom Headers',
						name: 'customHeaders',
						type: 'fixedCollection',
						typeOptions: {
							multipleValues: true,
						},
						default: {},
						description: 'Add custom headers to send with MCP server requests',
						placeholder: 'Add Header',
						options: [
							{
								displayName: 'Header',
								name: 'values',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Header name',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Header value. Supports expressions.',
									},
								],
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			getTools,
		},
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const node = this.getNode();
		const config = getNodeConfig(this, itemIndex);

		const setError = (message: string, description?: string): SupplyData => {
			const error = new NodeOperationError(node, message, { itemIndex, description });
			this.addOutputData('ai_tool', itemIndex, error);
			throw error;
		};

		const { client, mcpTools, error } = await connectAndGetTools(this, config);

		if (error) {
			this.logger.error('McpClientExtended: Failed to connect to MCP Server', { error });

			switch (error.type) {
				case 'invalid_url':
					return setError('Could not connect to your MCP server. The provided URL is invalid.');
				case 'connection':
				default:
					return setError('Could not connect to your MCP server');
			}
		}

		this.logger.debug('McpClientExtended: Successfully connected to MCP Server');

		if (!mcpTools?.length) {
			return setError(
				'MCP Server returned no tools',
				'Connected successfully to your MCP server but it returned an empty list of tools.',
			);
		}

		// Apply dynamic filtering if enabled
		let finalTools = mcpTools;

		if (config.enableDynamicFiltering) {
			const evaluatedValue = config.evaluationExpression;

			this.logger.debug(
				`McpClientExtended: Evaluating dynamic filtering rules with value: "${evaluatedValue}"`,
			);

			finalTools = evaluateToolRules({
				evaluatedValue,
				rules: config.toolAccessRules,
				baseFilteredTools: mcpTools,
				defaultBehavior: config.defaultBehavior,
			});

			this.logger.debug(
				`McpClientExtended: After dynamic filtering: ${finalTools.length} of ${mcpTools.length} tools available`,
			);
		}

		if (!finalTools.length) {
			this.logger.debug('McpClientExtended: No tools available after filtering');
			return { response: [], closeFunction: async () => await client.close() };
		}

		// Create tools array with logWrapper for proper logging
		const tools = await Promise.all(
			finalTools.map(async (tool) =>
				logWrapper(
					await mcpToolToDynamicTool(
						tool,
						createCallTool(tool.name, client, config.timeout, (errorMessage) => {
							const error = new NodeOperationError(node, errorMessage, { itemIndex });
							void this.addOutputData('ai_tool', itemIndex, error);
							this.logger.error(`McpClientExtended: Tool "${tool.name}" failed to execute`, { error });
						}),
					),
					this,
				),
			),
		);

		this.logger.debug(`McpClientExtended: Connected to MCP Server with ${tools.length} tools`);

		// Return tools array directly - n8n will handle multiple tools
		return { response: tools, closeFunction: async () => await client.close() };
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const node = this.getNode();
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];
			const config = getNodeConfig(this, itemIndex);

			const { client, mcpTools, error } = await connectAndGetTools(this, config);

			if (error) {
				throw new NodeOperationError(node, error.error, { itemIndex });
			}

			if (!mcpTools?.length) {
				throw new NodeOperationError(node, 'MCP Server returned no tools', { itemIndex });
			}

			for (const tool of mcpTools) {
				// Check for tool name in item.json.tool (for toolkit execution from agent)
				// or item.tool (for direct execution)
				if (!item.json.tool || typeof item.json.tool !== 'string') {
					throw new NodeOperationError(node, 'Tool name not found in item.json.tool or item.tool', {
						itemIndex,
					});
				}

				const toolName = item.json.tool;
				if (toolName === tool.name) {
					// Extract the tool name from arguments before passing to MCP
					const { tool: _, ...toolArguments } = item.json;
					const params: {
						name: string;
						arguments: IDataObject;
					} = {
						name: tool.name,
						arguments: toolArguments,
					};
					const result = await client.callTool(params, CallToolResultSchema, {
						timeout: config.timeout,
					});
					returnData.push({
						json: {
							response: result.content as IDataObject,
						},
						pairedItem: {
							item: itemIndex,
						},
					});
				}
			}
		}

		return [returnData];
	}
}
