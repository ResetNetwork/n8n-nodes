import { DynamicTool } from '@langchain/core/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CompatibilityCallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import { Toolkit } from 'langchain/agents';
import {
	createResultError,
	createResultOk,
	type IDataObject,
	type IExecuteFunctions,
	type ILoadOptionsFunctions,
	type ISupplyDataFunctions,
	type Result,
} from 'n8n-workflow';

import type {
	McpAuthenticationOption,
	McpServerTransport,
	McpTool,
	McpToolIncludeMode,
} from './types';

// Proxy fetch - simplified version for community node
const proxyFetch = async (url: string | URL, init?: RequestInit): Promise<Response> => {
	return await fetch(url, init);
};

// No longer needed for DynamicTool approach

export async function getAllTools(client: Client, cursor?: string): Promise<McpTool[]> {
	const { tools, nextCursor } = await client.listTools({ cursor });

	if (nextCursor) {
		return (tools as McpTool[]).concat(await getAllTools(client, nextCursor));
	}

	return tools as McpTool[];
}

export function getSelectedTools({
	mode,
	includeTools,
	excludeTools,
	tools,
}: {
	mode: McpToolIncludeMode;
	includeTools?: string[];
	excludeTools?: string[];
	tools: McpTool[];
}) {
	switch (mode) {
		case 'selected': {
			if (!includeTools?.length) return tools;
			const include = new Set(includeTools);
			return tools.filter((tool) => include.has(tool.name));
		}
		case 'except': {
			const except = new Set(excludeTools ?? []);
			return tools.filter((tool) => !except.has(tool.name));
		}
		case 'all':
		default:
			return tools;
	}
}

export const getErrorDescriptionFromToolCall = (result: unknown): string | undefined => {
	if (result && typeof result === 'object') {
		if ('content' in result && Array.isArray(result.content)) {
			const errorMessage = (result.content as Array<{ type: 'text'; text: string }>).find(
				(content) => content && typeof content === 'object' && typeof content.text === 'string',
			)?.text;
			return errorMessage;
		} else if ('toolResult' in result && typeof result.toolResult === 'string') {
			return result.toolResult;
		}
		if ('message' in result && typeof result.message === 'string') {
			return result.message;
		}
	}

	return undefined;
};

export const createCallTool =
	(name: string, client: Client, timeout: number, onError: (error: string) => void) =>
	async (input: string): Promise<string> => {
		// Parse input as JSON if possible, otherwise use as string
		let args: IDataObject;
		try {
			args = typeof input === 'string' && input.trim().startsWith('{') ? JSON.parse(input) : { input };
		} catch {
			// If not valid JSON, treat as a simple object with the input
			args = { input };
		}

		let result: Awaited<ReturnType<Client['callTool']>>;

		function handleError(error: unknown): string {
			const errorDescription =
				getErrorDescriptionFromToolCall(error) ?? `Failed to execute tool "${name}"`;
			onError(errorDescription);
			return errorDescription;
		}

		try {
			result = await client.callTool({ name, arguments: args }, CompatibilityCallToolResultSchema, {
				timeout,
			});
		} catch (error) {
			return handleError(error);
		}

		if (result.isError) {
			return handleError(result);
		}

		if (result.toolResult !== undefined) {
			return typeof result.toolResult === 'string' ? result.toolResult : JSON.stringify(result.toolResult);
		}

		if (result.content !== undefined) {
			return typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
		}

		return JSON.stringify(result);
	};

export function mcpToolToDynamicTool(
	tool: McpTool,
	onCallTool: (input: string) => Promise<string>,
): DynamicTool {
	// Use DynamicTool instead of DynamicStructuredTool for cross-module compatibility
	// MCP tools accept JSON input, which we'll parse from the string input
	const description = tool.description ?? `Execute the ${tool.name} tool`;
	
	// Add schema information to description if available
	let enhancedDescription = description;
	if (tool.inputSchema && typeof tool.inputSchema === 'object') {
		const schemaProps = (tool.inputSchema as any).properties;
		if (schemaProps && Object.keys(schemaProps).length > 0) {
			const params = Object.entries(schemaProps)
				.map(([key, value]: [string, any]) => `${key}: ${value.description || value.type || 'any'}`)
				.join(', ');
			enhancedDescription += ` Parameters: {${params}}. Provide input as JSON string.`;
		}
	}

	return new DynamicTool({
		name: tool.name,
		description: enhancedDescription,
		func: onCallTool,
		metadata: { isFromToolkit: true },
	});
}

export class McpToolkit extends Toolkit {
	constructor(public tools: DynamicTool[]) {
		super();
	}
}

function safeCreateUrl(url: string, baseUrl?: string | URL): Result<URL, Error> {
	try {
		return createResultOk(new URL(url, baseUrl));
	} catch (error) {
		return createResultError(error instanceof Error ? error : new Error(String(error)));
	}
}

function normalizeAndValidateUrl(input: string): Result<URL, Error> {
	const withProtocol = !/^https?:\/\//i.test(input) ? `https://${input}` : input;
	const parsedUrl = safeCreateUrl(withProtocol);

	if (!parsedUrl.ok) {
		return createResultError(parsedUrl.error);
	}

	return parsedUrl;
}

function isUnauthorizedError(error: unknown): boolean {
	return (
		!!error &&
		typeof error === 'object' &&
		(('code' in error && Number(error.code) === 401) ||
			('message' in error && typeof error.message === 'string' && error.message.includes('401')))
	);
}

type OnUnauthorizedHandler = (
	headers?: Record<string, string>,
) => Promise<Record<string, string> | null>;

type ConnectMcpClientError =
	| { type: 'invalid_url'; error: Error }
	| { type: 'connection'; error: Error };

export async function connectMcpClient({
	headers,
	serverTransport,
	endpointUrl,
	name,
	version,
	onUnauthorized,
}: {
	serverTransport: McpServerTransport;
	endpointUrl: string;
	headers?: Record<string, string>;
	name: string;
	version: number;
	onUnauthorized?: OnUnauthorizedHandler;
}): Promise<Result<Client, ConnectMcpClientError>> {
	const endpoint = normalizeAndValidateUrl(endpointUrl);

	if (!endpoint.ok) {
		return createResultError({ type: 'invalid_url', error: endpoint.error });
	}

	const client = new Client({ name, version: version.toString() }, { capabilities: {} });

	if (serverTransport === 'httpStreamable') {
		try {
			const transport = new StreamableHTTPClientTransport(endpoint.result, {
				requestInit: { headers },
				fetch: proxyFetch,
			});
			await client.connect(transport);
			return createResultOk(client);
		} catch (error) {
			if (onUnauthorized && isUnauthorizedError(error)) {
				const newHeaders = await onUnauthorized(headers);
				if (newHeaders) {
					// Don't pass `onUnauthorized` to avoid possible infinite recursion
					return await connectMcpClient({
						headers: newHeaders,
						serverTransport,
						endpointUrl,
						name,
						version,
					});
				}
			}

			return createResultError({ type: 'connection', error: error instanceof Error ? error : new Error(String(error)) });
		}
	}

	try {
		const sseTransport = new SSEClientTransport(endpoint.result, {
			eventSourceInit: {
				fetch: async (url, init) =>
					await proxyFetch(url, {
						...init,
						headers: {
							...headers,
							Accept: 'text/event-stream',
						},
					}),
			},
			fetch: proxyFetch,
			requestInit: { headers },
		});
		await client.connect(sseTransport);
		return createResultOk(client);
	} catch (error) {
		if (onUnauthorized && isUnauthorizedError(error)) {
			const newHeaders = await onUnauthorized(headers);
			if (newHeaders) {
				// Don't pass `onUnauthorized` to avoid possible infinite recursion
				return await connectMcpClient({
					headers: newHeaders,
					serverTransport,
					endpointUrl,
					name,
					version,
				});
			}
		}

		return createResultError({ type: 'connection', error: error instanceof Error ? error : new Error(String(error)) });
	}
}

/**
 * Get authentication headers from credentials
 */
export async function getAuthHeaders(
	ctx: Pick<IExecuteFunctions, 'getCredentials'>,
	authentication: McpAuthenticationOption,
): Promise<{ headers?: Record<string, string> }> {
	switch (authentication) {
		case 'headerAuth': {
			const header = await ctx
				.getCredentials<{ name: string; value: string }>('httpHeaderAuth')
				.catch(() => null);

			if (!header) return {};

			return { headers: { [header.name]: header.value } };
		}
		case 'bearerAuth': {
			const result = await ctx
				.getCredentials<{ token: string }>('httpBearerAuth')
				.catch(() => null);

			if (!result) return {};

			return { headers: { Authorization: `Bearer ${result.token}` } };
		}
		case 'mcpOAuth2Api': {
			const result = await ctx
				.getCredentials<{ oauthTokenData: { access_token: string } }>('mcpOAuth2Api')
				.catch(() => null);

			if (!result) return {};

			return { headers: { Authorization: `Bearer ${result.oauthTokenData.access_token}` } };
		}
		case 'multipleHeadersAuth': {
			const result = await ctx
				.getCredentials<{ headers: { values: Array<{ name: string; value: string }> } }>(
					'httpMultipleHeadersAuth',
				)
				.catch(() => null);

			if (!result) return {};

			return {
				headers: result.headers.values.reduce(
					(acc, cur) => {
						acc[cur.name] = cur.value;
						return acc;
					},
					{} as Record<string, string>,
				),
			};
		}
		case 'none':
		default: {
			return {};
		}
	}
}

/**
 * Get custom headers from node parameters and merge with auth headers
 * Custom headers take precedence over auth headers
 */
export function mergeCustomHeaders(
	authHeaders: Record<string, string> | undefined,
	customHeaders: IDataObject | undefined,
): Record<string, string> | undefined {
	if (!customHeaders || Object.keys(customHeaders).length === 0) {
		return authHeaders;
	}

	const merged: Record<string, string> = { ...(authHeaders || {}) };

	for (const [key, value] of Object.entries(customHeaders)) {
		if (typeof value === 'string') {
			merged[key] = value;
		} else if (value !== null && value !== undefined) {
			merged[key] = String(value);
		}
	}

	return merged;
}

/**
 * Tries to refresh the OAuth2 token
 * Note: This is simplified for community nodes as full OAuth2 refresh may not be available
 * @param ctx - The execution context
 * @param authentication - The authentication method
 * @param headers - The headers to refresh
 * @returns The refreshed headers or null if the authentication method is not oAuth2Api or has failed
 */
export async function tryRefreshOAuth2Token(
	ctx: IExecuteFunctions | ISupplyDataFunctions | ILoadOptionsFunctions,
	authentication: McpAuthenticationOption,
	headers?: Record<string, string>,
) {
	// For community nodes, OAuth2 refresh might not be available
	// Return null to indicate refresh is not possible
	if (authentication !== 'mcpOAuth2Api') {
		return null;
	}

	// In community nodes, we might not have access to refreshOAuth2Token
	// Return null to let the connection fail naturally
	return null;
}

