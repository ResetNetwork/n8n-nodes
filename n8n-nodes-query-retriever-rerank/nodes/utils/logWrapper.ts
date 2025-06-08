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
	} catch (error) {
		const connectedNode = parameters.executeFunctions.getNode();
		throw new NodeOperationError(connectedNode, error as Error);
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
	console.log('ToolLogWrapper: Wrapping instance of type:', originalInstance.constructor.name);
	
	return new Proxy(originalInstance, {
		get(target, prop, receiver) {
			const originalValue = Reflect.get(target, prop, receiver);
			
			// Log all method calls for debugging
			if (typeof originalValue === 'function' && typeof prop === 'string') {
				console.log('ToolLogWrapper: Method accessed:', prop);
			}

			// Handle Tool - check for _call method (standard tool interface)
			if ('_call' in target || 'call' in target) {
				if (prop === '_call' && '_call' in target) {
					return async (input: string): Promise<string> => {
						console.log('ToolLogWrapper: _call intercepted, input length:', input?.length || 0);
						const connectionType = NodeConnectionType.AiTool;

						// Log input data
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { input } }],
						]);

						// Call the original method with proper error handling
						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop as keyof typeof target] as (...args: any[]) => Promise<unknown>,
							arguments: [input],
						})) as string;

						console.log('ToolLogWrapper: _call completed, response length:', response?.length || 0);

						// Log AI event
						logAiEvent(executeFunctions, 'ai-tool-called');

						// Log output data
						executeFunctions.addOutputData(connectionType, index, [
							[{ json: { response } }],
						]);

						return response;
					};
				}

				if (prop === 'call' && 'call' in target) {
					return async (input: string): Promise<string> => {
						console.log('ToolLogWrapper: call intercepted, input length:', input?.length || 0);
						const connectionType = NodeConnectionType.AiTool;

						// Log input data
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { input } }],
						]);

						// Call the original method with proper error handling
						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop as keyof typeof target] as (...args: any[]) => Promise<unknown>,
							arguments: [input],
						})) as string;

						console.log('ToolLogWrapper: call completed, response length:', response?.length || 0);

						// Log AI event
						logAiEvent(executeFunctions, 'ai-tool-called');

						// Log output data
						executeFunctions.addOutputData(connectionType, index, [
							[{ json: { response } }],
						]);

						return response;
					};
				}
			}

			return originalValue;
		},
	});
}