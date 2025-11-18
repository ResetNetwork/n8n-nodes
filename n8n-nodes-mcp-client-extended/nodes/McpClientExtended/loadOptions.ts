import {
	type ILoadOptionsFunctions,
	type INodePropertyOptions,
	NodeOperationError,
} from 'n8n-workflow';

import type { McpAuthenticationOption, McpServerTransport } from './types';
import { connectMcpClient, getAllTools, getAuthHeaders, mergeCustomHeaders, tryRefreshOAuth2Token } from './utils';

export async function getTools(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const authentication = this.getNodeParameter('authentication') as McpAuthenticationOption;
	const node = this.getNode();
	
	const serverTransport = this.getNodeParameter('serverTransport') as McpServerTransport;
	const endpointUrl = this.getNodeParameter('endpointUrl') as string;
	
	const { headers: authHeaders } = await getAuthHeaders(this, authentication);
	
	// Get custom headers if specified
	const customHeadersEnabled = this.getNodeParameter('options.customHeadersEnabled', false) as boolean;
	let customHeaders;
	if (customHeadersEnabled) {
		customHeaders = this.getNodeParameter('options.customHeaders', {}) as Record<string, string>;
	}
	
	// Merge custom headers with auth headers
	const headers = mergeCustomHeaders(authHeaders, customHeaders);
	
	const client = await connectMcpClient({
		serverTransport,
		endpointUrl,
		headers,
		name: node.type,
		version: node.typeVersion,
		onUnauthorized: async (headers) => await tryRefreshOAuth2Token(this, authentication, headers),
	});

	if (!client.ok) {
		throw new NodeOperationError(this.getNode(), 'Could not connect to your MCP server');
	}

	const tools = await getAllTools(client.result);
	return tools.map((tool) => ({
		name: tool.name,
		value: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
	}));
}
