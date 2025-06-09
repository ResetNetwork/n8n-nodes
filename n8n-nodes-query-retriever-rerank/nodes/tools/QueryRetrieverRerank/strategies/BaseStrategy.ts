import type { QueryStrategy, StrategyContext, StrategyResult } from '../shared/types';
import { DebugManager } from '../shared/debugging';

export abstract class BaseStrategy implements QueryStrategy {
	protected debugManager: DebugManager;

	constructor() {
		this.debugManager = new DebugManager('base', {});
	}

	// Abstract methods that must be implemented by concrete strategies
	abstract execute(input: string, context: StrategyContext): Promise<StrategyResult>;
	abstract getName(): string;
	abstract getDescription(): string;

	// Common helper methods available to all strategies

	// Generate answer using language model
	protected async generateAnswer(
		docs: any[], 
		query: string, 
		context: StrategyContext
	): Promise<string> {
		if (docs.length === 0) {
			return 'No relevant documents found in the vector store.';
		}

		// Prepare context from retrieved documents
		const docContext = docs.map((doc, index) => 
			`Document ${index + 1}:\n${doc.pageContent}\n`
		).join('\n');

		// Use custom prompt template if provided, otherwise use default
		const defaultTemplate = `Use the following pieces of context to answer the question at the end.

{context}

Question: {question}
Answer:`;

		const promptTemplate = context.config.promptTemplate?.trim() || defaultTemplate;

		const prompt = promptTemplate
			.replace('{context}', docContext)
			.replace('{question}', query);

		this.debugManager.setAnswerGenerationData({
			contextLength: docContext.length,
			promptLength: prompt.length
		});

		// Generate answer using the language model
		const answerStart = Date.now();
		const response = await context.model.invoke(prompt);
		this.debugManager.addTiming('answerGeneration', answerStart);

		return typeof response === 'string' ? response : response.content || response.text || String(response);
	}

	// Format result for different return types
	protected formatResult(
		answer: string | null, 
		docs: any[], 
		context: StrategyContext
	): StrategyResult {
		// For "none" strategy, return only documents without generating an answer
		if (!answer) {
			return {
				sourceDocuments: docs.map((doc: any) => ({
					pageContent: doc.pageContent,
					metadata: doc.metadata
				}))
			};
		}

		// Return structured JSON when returning source documents
		if (context.config.returnRankedDocuments) {
			return {
				answer,
				sourceDocuments: docs.map((doc: any) => ({
					pageContent: doc.pageContent,
					metadata: doc.metadata
				}))
			};
		}

		// Simple answer return (no source documents)
		return { answer };
	}

	// Handle debug data storage
	protected async handleDebugging(
		originalQuery: string,
		context: StrategyContext
	): Promise<void> {
		if (!context.debugging || !context.memory) return;

		const debugData = this.debugManager.finalize();
		
		await DebugManager.storeInMemory(
			debugData,
			context.model,
			context.memory,
			context.llmDebugAnalysis,
			originalQuery
		);
	}

	// Initialize debug manager for the strategy
	protected initializeDebugManager(strategyName: string, config: any): void {
		this.debugManager = new DebugManager(strategyName, config);
	}
}