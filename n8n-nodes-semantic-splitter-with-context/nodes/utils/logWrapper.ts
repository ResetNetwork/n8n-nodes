import { ISupplyDataFunctions, NodeOperationError, NodeConnectionTypes } from 'n8n-workflow';
import { TextSplitter } from '@langchain/textsplitters';

async function callMethodAsync<T>(
	this: T,
	parameters: {
		executeFunctions: ISupplyDataFunctions;
		connectionType: any;
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
    const debugEnabled = process.env.N8N_NODES_DEBUG === '1' || process.env.N8N_NODES_DEBUG === 'true';
    
    if (debugEnabled) {
        console.log('LogWrapper: Wrapping instance of type:', originalInstance.constructor.name);
    }
	
	return new Proxy(originalInstance, {
		get(target, prop, receiver) {
			const originalValue = Reflect.get(target, prop, receiver);
			
			// Log all method calls for debugging (only when debug enabled)
            if (debugEnabled && typeof originalValue === 'function' && typeof prop === 'string') {
                console.log('LogWrapper: Method accessed:', prop);
			}

			// Handle TextSplitter specifically - match n8n's built-in logWrapper exactly
			if (originalInstance instanceof TextSplitter) {
				if (prop === 'splitText' && 'splitText' in target) {
                    return async (text: string): Promise<string[]> => {
                        const connectionType = NodeConnectionTypes.AiTextSplitter;
                        
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

						// Log AI event
						logAiEvent(executeFunctions, 'ai-text-split');

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