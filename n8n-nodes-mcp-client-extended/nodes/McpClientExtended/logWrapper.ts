import { ISupplyDataFunctions, NodeConnectionType, NodeOperationError } from 'n8n-workflow';

async function callMethodAsync<T>(
	this: T,
	parameters: {
		executeFunctions: ISupplyDataFunctions;
		connectionType: NodeConnectionType;
		currentNodeRunIndex: number;
		method: (...args: any[]) => Promise<unknown>;
		arguments: unknown[];
	},
): Promise<unknown> {
	try {
		return await parameters.method.call(this, ...parameters.arguments);
	} catch (e) {
		const connectedNode = parameters.executeFunctions.getNode();

		const error = new NodeOperationError(connectedNode, e as Error, {
			functionality: 'configuration-node',
		});

		parameters.executeFunctions.addOutputData(
			parameters.connectionType,
			parameters.currentNodeRunIndex,
			error,
		);

		if (error.message) {
			if (!error.description) {
				error.description = error.message;
			}
			throw error;
		}

		throw new NodeOperationError(
			connectedNode,
			`Error on node "${connectedNode.name}" which is connected via input "${parameters.connectionType}"`,
			{ functionality: 'configuration-node' },
		);
	}
}

function logAiEvent(executeFunctions: ISupplyDataFunctions, eventType: string): void {
	try {
		if ('logAiEvent' in executeFunctions && typeof executeFunctions.logAiEvent === 'function') {
			(executeFunctions.logAiEvent as any)({
				type: eventType,
			});
		}
	} catch {
		// Silently fail if logAiEvent is not available
	}
}

export function logWrapper<T extends object>(originalInstance: T, executeFunctions: ISupplyDataFunctions): T {
	return new Proxy(originalInstance, {
		get(target, prop, receiver) {
			const originalValue = Reflect.get(target, prop, receiver);

			// Handle DynamicStructuredTool - intercept invoke method
			// DynamicStructuredTool uses invoke(input: z.infer<schema>) method
			if (prop === 'invoke' && typeof originalValue === 'function') {
				return async (input: any): Promise<any> => {
					const connectionType = NodeConnectionType.AiTool;
					const inputData: any = { input };

					// Add tool metadata if from toolkit
					if ((target as any).metadata?.isFromToolkit) {
						inputData.tool = {
							name: (target as any).name,
							description: (target as any).description,
						};
					}

					// Log input data
					const { index } = executeFunctions.addInputData(connectionType, [
						[{ json: inputData }],
					]);

					// Call the original method with proper error handling
					const response = (await callMethodAsync.call(target, {
						executeFunctions,
						connectionType,
						currentNodeRunIndex: index,
						method: originalValue as (...args: any[]) => Promise<unknown>,
						arguments: [input],
					})) as any;

					// Log AI event
					logAiEvent(executeFunctions, 'ai-tool-called');

					// Log output data
					executeFunctions.addOutputData(connectionType, index, [
						[{ json: { response } }],
					]);

					// Return the response (DynamicStructuredTool returns the actual result)
					return response;
				};
			}

			// Handle legacy tool interfaces for compatibility
			if ('_call' in target || 'call' in target) {
				if (prop === '_call' && '_call' in target) {
					return async (query: string): Promise<string> => {
						const connectionType = NodeConnectionType.AiTool;
						const inputData: any = { query };

						// Add tool metadata if from toolkit
						if ((target as any).metadata?.isFromToolkit) {
							inputData.tool = {
								name: (target as any).name,
								description: (target as any).description,
							};
						}

						// Log input data
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: inputData }],
						]);

						// Call the original method with proper error handling
						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop as keyof typeof target] as (...args: any[]) => Promise<unknown>,
							arguments: [query],
						})) as string;

						// Log AI event
						logAiEvent(executeFunctions, 'ai-tool-called');

						// Log output data
						executeFunctions.addOutputData(connectionType, index, [
							[{ json: { response } }],
						]);

						// Return string or stringify non-string responses
						if (typeof response === 'string') return response;
						return JSON.stringify(response);
					};
				}

				if (prop === 'call' && 'call' in target) {
					return async (query: string): Promise<string> => {
						const connectionType = NodeConnectionType.AiTool;
						const inputData: any = { query };

						// Add tool metadata if from toolkit
						if ((target as any).metadata?.isFromToolkit) {
							inputData.tool = {
								name: (target as any).name,
								description: (target as any).description,
							};
						}

						// Log input data
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: inputData }],
						]);

						// Call the original method with proper error handling
						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop as keyof typeof target] as (...args: any[]) => Promise<unknown>,
							arguments: [query],
						})) as string;

						// Log AI event
						logAiEvent(executeFunctions, 'ai-tool-called');

						// Log output data
						executeFunctions.addOutputData(connectionType, index, [
							[{ json: { response } }],
						]);

						// Return string or stringify non-string responses
						if (typeof response === 'string') return response;
						return JSON.stringify(response);
					};
				}
			}

			return originalValue;
		},
	});
}
