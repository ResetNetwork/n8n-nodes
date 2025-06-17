import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import { jsonParse } from 'n8n-workflow';

export class SseTriggerExtended implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SSE Trigger Extended',
		name: 'sseTriggerExtended',
		icon: 'fa:cloud-download-alt',
		group: ['trigger'],
		version: 1,
		description: 'Triggers the workflow when Server-Sent Events occur with support for custom headers',
		eventTriggerDescription: 'Waiting for Server-Sent Events',
		activationMessage: 'You can now make calls to your SSE URL to trigger executions.',
		defaults: {
			name: 'SSE Trigger Extended',
		},
		triggerPanel: {
			header: 'Listening for Server-Sent Events',
			executionsHelp: {
				inactive: 'Server-Sent Events are not being listened to. To start listening, click the "execute" button below.',
				active: 'Server-Sent Events are being listened to. To stop listening, click the "stop" button below.',
			},
		},
		inputs: [],
		outputs: [
			{
				type: NodeConnectionType.Main,
			},
		],
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
		],
		properties: [
			{
				displayName: 'SSE Endpoint',
				name: 'sseEndpoint',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://example.com/events',
				description: 'SSE Endpoint to listen for Server-Sent Events',
			},
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
						name: 'None',
						value: 'none',
					},
				],
				default: 'none',
				description: 'The way to authenticate with your SSE endpoint',
			},
			{
				displayName: 'Credentials',
				name: 'credentials',
				type: 'credentials',
				default: '',
				displayOptions: {
					show: {
						authentication: ['headerAuth', 'bearerAuth'],
					},
				},
			},
			{
				displayName: 'Send Custom Headers',
				name: 'sendHeaders',
				type: 'boolean',
				default: false,
				description: 'Whether to send additional custom headers with the SSE connection (in addition to authentication)',
			},
			{
				displayName: 'Specify Headers',
				name: 'specifyHeaders',
				type: 'options',
				displayOptions: {
					show: {
						sendHeaders: [true],
					},
				},
				options: [
					{
						name: 'Using Fields Below',
						value: 'keypair',
					},
					{
						name: 'JSON',
						value: 'json',
					},
				],
				default: 'keypair',
				description: 'The way to specify the headers to send',
			},
			{
				displayName: 'Header Parameters',
				name: 'headerParameters',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['keypair'],
					},
				},
				typeOptions: {
					multipleValues: true,
					addButtonText: 'Add Parameter',
				},
				default: {
					parameters: [
						{
							name: '',
							value: '',
						},
					],
				},
				placeholder: 'Add Parameter',
				options: [
					{
						name: 'parameters',
						displayName: 'Header',
						values: [
							{
								displayName: 'Name',
								name: 'name',
								type: 'string',
								default: '',
								description: 'Name of the header',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value of the header',
							},
						],
					},
				],
			},
			{
				displayName: 'Headers (JSON)',
				name: 'jsonHeaders',
				type: 'json',
				displayOptions: {
					show: {
						sendHeaders: [true],
						specifyHeaders: ['json'],
					},
				},
				default: '{}',
				description: 'Headers to send as JSON object',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Connection Timeout (ms)',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Connection timeout in milliseconds',
					},
					{
						displayName: 'Retry Attempts',
						name: 'retryAttempts',
						type: 'number',
						default: 3,
						description: 'Number of retry attempts on connection failure',
					},
					{
						displayName: 'Retry Delay (ms)',
						name: 'retryDelay',
						type: 'number',
						default: 1000,
						description: 'Delay between retry attempts in milliseconds',
					},
				],
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const url = this.getNodeParameter('sseEndpoint') as string;
		const authentication = this.getNodeParameter('authentication', 'none') as string;
		const options = this.getNodeParameter('options', {}) as IDataObject;
		
		let headers: Record<string, string> = {
			'Accept': 'text/event-stream',
			'Cache-Control': 'no-cache',
		};

		// Handle authentication
		if (authentication === 'bearerAuth') {
			const credentials = await this.getCredentials('httpBearerAuth');
			headers['Authorization'] = `Bearer ${credentials.token}`;
		} else if (authentication === 'headerAuth') {
			const credentials = await this.getCredentials('httpHeaderAuth');
			headers[credentials.name as string] = credentials.value as string;
		}

		// Handle custom headers (always available, regardless of authentication)
		const sendHeaders = this.getNodeParameter('sendHeaders', false) as boolean;
		
		if (sendHeaders) {
			const specifyHeaders = this.getNodeParameter('specifyHeaders', 'keypair') as string;
			
			if (specifyHeaders === 'keypair') {
				const headerParameters = this.getNodeParameter('headerParameters.parameters', []) as Array<{
					name: string;
					value: string;
				}>;
				
				headerParameters.forEach((header) => {
					if (header.name && header.value) {
						headers[header.name] = header.value;
					}
				});
			} else if (specifyHeaders === 'json') {
				const jsonHeaders = this.getNodeParameter('jsonHeaders', '{}') as string;
				try {
					const parsedHeaders = jsonParse<IDataObject>(jsonHeaders);
					Object.entries(parsedHeaders).forEach(([key, value]) => {
						headers[key] = String(value);
					});
				} catch (error) {
					throw new Error(`Invalid JSON in headers: ${(error as Error).message}`);
				}
			}
		}

		const timeout = (options.timeout as number) || 30000;
		const maxRetries = (options.retryAttempts as number) || 3;
		const retryDelay = (options.retryDelay as number) || 1000;

		let isActive = true;
		let retryCount = 0;

		const processEvent = (eventData: any, url: string) => {
			try {
				let parsedData: IDataObject;
				
				if (eventData.data) {
					try {
						parsedData = jsonParse<IDataObject>(eventData.data, {
							errorMessage: 'Invalid JSON for event data',
						});
					} catch {
						// If JSON parsing fails, treat as raw string
						parsedData = { data: eventData.data };
					}
				} else {
					parsedData = {};
				}

				const outputData = {
					...parsedData,
					$metadata: {
						eventType: eventData.event || 'message',
						lastEventId: eventData.id,
						origin: url,
						timestamp: new Date().toISOString(),
						retry: eventData.retry,
					},
				};

				this.emit([this.helpers.returnJsonArray([outputData])]);
			} catch (error) {
				this.emit([this.helpers.returnJsonArray([{
					error: (error as Error).message,
					rawData: eventData.data,
					$metadata: {
						eventType: eventData.event || 'message',
						lastEventId: eventData.id,
						origin: url,
						timestamp: new Date().toISOString(),
					},
				}])]);
			}
		};

		const connectSSE = async (): Promise<void> => {
			if (!isActive) return;

			try {
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				const response = await fetch(url, {
					headers,
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				if (!response.body) {
					throw new Error('Response body is null');
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';

				retryCount = 0; // Reset retry count on successful connection

				try {
					while (isActive) {
						const { done, value } = await reader.read();
						
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() || '';

						let eventData: any = {};
						let hasData = false;

						for (const line of lines) {
							const trimmedLine = line.trim();
							
							if (trimmedLine === '') {
								// Empty line signals end of event
								if (hasData && eventData.data !== undefined) {
									processEvent(eventData, url);
								}
								eventData = {};
								hasData = false;
							} else if (trimmedLine.startsWith('data:')) {
								const data = trimmedLine.substring(5).trim();
								eventData.data = (eventData.data || '') + data;
								hasData = true;
							} else if (trimmedLine.startsWith('event:')) {
								eventData.event = trimmedLine.substring(6).trim();
								hasData = true;
							} else if (trimmedLine.startsWith('id:')) {
								eventData.id = trimmedLine.substring(3).trim();
								hasData = true;
							} else if (trimmedLine.startsWith('retry:')) {
								eventData.retry = parseInt(trimmedLine.substring(6).trim(), 10);
								hasData = true;
							}
						}
					}
				} finally {
					reader.releaseLock();
				}

			} catch (error) {
				if (!isActive) return;

				if (retryCount < maxRetries) {
					retryCount++;
					this.logger.warn(`SSE connection failed, retrying in ${retryDelay}ms (attempt ${retryCount}/${maxRetries}): ${(error as Error).message}`);
					
					setTimeout(() => {
						connectSSE().catch((retryError) => {
							this.logger.error(`SSE retry failed: ${(retryError as Error).message}`);
						});
					}, retryDelay);
				} else {
					this.emit([this.helpers.returnJsonArray([{
						error: 'SSE connection failed after max retries',
						details: (error as Error).message,
						$metadata: {
							eventType: 'error',
							timestamp: new Date().toISOString(),
						},
					}])]);
				}
			}
		};

		// Start the SSE connection
		connectSSE().catch((error) => {
			this.logger.error(`Initial SSE connection failed: ${(error as Error).message}`);
		});

		async function closeFunction() {
			isActive = false;
		}

		return {
			closeFunction,
		};
	}

}