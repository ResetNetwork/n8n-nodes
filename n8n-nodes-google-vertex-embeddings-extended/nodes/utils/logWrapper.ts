import { ISupplyDataFunctions, NodeOperationError } from 'n8n-workflow';

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
	} catch (error) {
		// Silently fail if logAiEvent is not available
	}
}

export function logWrapper<T extends object>(originalInstance: T, executeFunctions: ISupplyDataFunctions): T {
	console.log('VertexEmbeddingsLogWrapper: Wrapping instance of type:', originalInstance.constructor.name);
	
	return new Proxy(originalInstance, {
		get(target, prop, receiver) {
			const originalValue = Reflect.get(target, prop, receiver);
			
			// Log all method calls for debugging
			if (typeof originalValue === 'function' && typeof prop === 'string') {
				console.log('VertexEmbeddingsLogWrapper: Method accessed:', prop);
			}

			// Handle Embeddings - check for embedDocuments/embedQuery methods instead of instanceof
			if ('embedDocuments' in target || 'embedQuery' in target) {
				if (prop === 'embedDocuments' && 'embedDocuments' in target) {
					return async (documents: string[]): Promise<number[][]> => {
						console.log('VertexEmbeddingsLogWrapper: embedDocuments intercepted, docs:', documents?.length || 0);
                        const connectionType = 'aiEmbedding' as any;

						// Log input data
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { documents } }],
						]);

						// Call the original method with proper error handling
						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop as keyof typeof target] as (...args: any[]) => Promise<unknown>,
							arguments: [documents],
						})) as number[][];

						console.log('VertexEmbeddingsLogWrapper: embedDocuments completed, embeddings:', response?.length || 0);

						// Log AI event
						logAiEvent(executeFunctions, 'ai-document-embedded');

						// Log output data
						executeFunctions.addOutputData(connectionType, index, [
							[{ json: { response } }],
						]);

						return response;
					};
				}

				if (prop === 'embedQuery' && 'embedQuery' in target) {
					return async (query: string): Promise<number[]> => {
						console.log('VertexEmbeddingsLogWrapper: embedQuery intercepted, query length:', query?.length || 0);
                        const connectionType = 'aiEmbedding' as any;

						// Log input data
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { query } }],
						]);

						// Call the original method with proper error handling
						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop as keyof typeof target] as (...args: any[]) => Promise<unknown>,
							arguments: [query],
						})) as number[];

						console.log('VertexEmbeddingsLogWrapper: embedQuery completed, embedding dimension:', response?.length || 0);

						// Log AI event
						logAiEvent(executeFunctions, 'ai-query-embedded');

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