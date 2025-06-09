import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { BaseMemory } from '@langchain/core/memory';
import type { DebugData } from './types';

export class DebugManager {
	private debugData: DebugData;
	private startTime: number;

	constructor(strategyType: string, configuration: any) {
		this.startTime = Date.now();
		this.debugData = {
			strategy: strategyType,
			configuration,
			timing: {},
			documentFlow: {},
			queryDetails: {}
		};
	}

	// Set query details
	setQueryDetails(details: Record<string, any>): void {
		this.debugData.queryDetails = { ...this.debugData.queryDetails, ...details };
	}

	// Set document flow metrics
	setDocumentFlow(flow: Record<string, number>): void {
		this.debugData.documentFlow = { ...this.debugData.documentFlow, ...flow };
	}

	// Add timing information
	addTiming(phase: string, startTime: number): void {
		this.debugData.timing[phase] = `${Date.now() - startTime}ms`;
	}

	// Set reranking data
	setRerankingData(rerankingData: Record<string, any>): void {
		this.debugData.reranking = rerankingData;
	}

	// Set answer generation data
	setAnswerGenerationData(answerData: Record<string, any>): void {
		this.debugData.answerGeneration = answerData;
	}

	// Finalize debug data with total time
	finalize(): DebugData {
		this.debugData.timing.total = `${Date.now() - this.startTime}ms`;
		return this.debugData;
	}

	// Get current debug data
	getDebugData(): DebugData {
		return this.debugData;
	}

	// Store debug data in memory with optional LLM analysis
	static async storeInMemory(
		debugData: DebugData,
		model: BaseLanguageModel,
		memory: BaseMemory,
		enableLLMAnalysis: boolean,
		originalQuery: string
	): Promise<void> {
		if (!memory) return;

		try {
			let analysis = null;

			// Generate LLM analysis only if enabled
			if (enableLLMAnalysis) {
				const analysisPrompt = `QUERY RETRIEVER DEBUG ANALYSIS

The following debug data is from a document retrieval and reranking execution (strategy: ${debugData.strategy}):

Debug Data:
${JSON.stringify(debugData, null, 2)}

Please analyze this data and provide insights on:
- System performance and timing
- Strategy effectiveness 
- Document retrieval effectiveness
- Reranking impact
- Areas for optimization

Provide a structured analysis that could help optimize future queries.`;

				const analysisResponse = await model.invoke(analysisPrompt);
				analysis = typeof analysisResponse === 'string' ? analysisResponse : 
					analysisResponse.content || analysisResponse.text || String(analysisResponse);
			}

			// Create debug entry (with or without LLM analysis)
			const debugEntry = {
				timestamp: new Date().toISOString(),
				query: originalQuery,
				strategy: debugData.strategy,
				debugData,
				...(analysis && { analysis }),
				summary: {
					totalTime: debugData.timing?.total,
					documentsRetrieved: debugData.documentFlow?.totalRetrieved,
					finalDocuments: debugData.documentFlow?.finalCount,
					strategy: debugData.strategy
				}
			};

			// Store in memory using the saveContext method with single key-value pairs
			await memory.saveContext(
				{ input: `Debug data for query: ${originalQuery}` },
				{ output: JSON.stringify(debugEntry, null, 2) }
			);

		} catch (debugError) {
			// Silent failure for debug storage
		}
	}
}