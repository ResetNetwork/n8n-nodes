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
	
	// Get custom headers from fixedCollection
	const customHeadersData = this.getNodeParameter('options.customHeaders', {}) as {
		values?: Array<{ name: string; value: string }>;
	};
	
	// Convert array format to object for header merging
	let customHeaders: Record<string, string> | undefined;
	if (customHeadersData?.values && Array.isArray(customHeadersData.values)) {
		customHeaders = customHeadersData.values.reduce((acc, header) => {
			if (header.name && header.value) {
				acc[header.name] = header.value;
			}
			return acc;
		}, {} as Record<string, string>);
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

	try {
		const tools = await getAllTools(client.result);
		return tools.map((tool) => ({
			name: tool.name,
			value: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		}));
	} finally {
		// Clean up client connection
		await client.result.close().catch(() => {
			// Ignore close errors
		});
	}
}
