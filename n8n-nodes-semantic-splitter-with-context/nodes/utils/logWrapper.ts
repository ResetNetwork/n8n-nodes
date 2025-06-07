import { ISupplyDataFunctions, NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { TextSplitter } from '@langchain/textsplitters';

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
	} catch (error) {
		// Silently fail if logAiEvent is not available
	}
}

export function logWrapper<T extends object>(originalInstance: T, executeFunctions: ISupplyDataFunctions): T {
	console.log('LogWrapper: Wrapping instance of type:', originalInstance.constructor.name);
	
	return new Proxy(originalInstance, {
		get(target, prop, receiver) {
			const originalValue = Reflect.get(target, prop, receiver);
			
			// Log all method calls for debugging
			if (typeof originalValue === 'function' && typeof prop === 'string') {
				console.log('LogWrapper: Method accessed:', prop);
			}

			// Handle TextSplitter specifically
			if (originalInstance instanceof TextSplitter) {
				if (prop === 'splitText' && 'splitText' in target) {
					return async (text: string): Promise<string[]> => {
						console.log('LogWrapper: splitText intercepted, text length:', text?.length || 0);
						const connectionType = NodeConnectionType.AiTextSplitter;

						// Log input data
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { textSplitter: text } }],
						]);

						// Call the original method with proper error handling
						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop as keyof typeof target] as (...args: any[]) => Promise<unknown>,
							arguments: [text],
						})) as string[];

						console.log('LogWrapper: splitText completed, chunks:', response?.length || 0);

						// Log AI event
						logAiEvent(executeFunctions, 'ai-text-split');

						// Log output data
						executeFunctions.addOutputData(connectionType, index, [
							[{ json: { response } }],
						]);

						return response;
					};
				}

				if (prop === 'splitDocuments' && 'splitDocuments' in target) {
					return async (documents: any[]): Promise<any[]> => {
						console.log('LogWrapper: splitDocuments intercepted, docs:', documents?.length || 0);
						const connectionType = NodeConnectionType.AiTextSplitter;

						// Log input data
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { documents: documents.length } }],
						]);

						// Call the original method with proper error handling
						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop as keyof typeof target] as (...args: any[]) => Promise<unknown>,
							arguments: [documents],
						})) as any[];

						console.log('LogWrapper: splitDocuments completed, chunks:', response?.length || 0);

						// Log AI event
						logAiEvent(executeFunctions, 'ai-text-split');

						// Log output data
						executeFunctions.addOutputData(connectionType, index, [
							[{ json: { response: response.length } }],
						]);

						return response;
					};
				}
			}

			return originalValue;
		},
	});
}