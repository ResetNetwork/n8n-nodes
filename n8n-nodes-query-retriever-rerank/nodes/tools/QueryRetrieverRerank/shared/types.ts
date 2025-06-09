import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { VectorStore } from '@langchain/core/vectorstores';
import type { Embeddings } from '@langchain/core/embeddings';
import type { BaseMemory } from '@langchain/core/memory';

// Strategy execution context
export interface StrategyContext {
	vectorStore: VectorStore;
	model: BaseLanguageModel;
	embeddings: Embeddings;
	memory: BaseMemory | null;
	config: StrategyConfig;
	debugging: boolean;
	llmDebugAnalysis: boolean;
}

// Configuration for strategies
export interface StrategyConfig {
	documentsToRetrieve: number;
	documentsToReturn: number;
	returnRankedDocuments: boolean;
	promptTemplate?: string;
	queryVariations?: number;
	includeOriginalQuery?: boolean;
	maxSteps?: number;
	enableEarlyStop?: boolean;
}

// Result from strategy execution
export interface StrategyResult {
	answer?: string;
	sourceDocuments?: any[];
	debugData?: any;
	error?: string;
}

// Debug data structure
export interface DebugData {
	strategy: string;
	configuration: StrategyConfig;
	timing: Record<string, string>;
	documentFlow: Record<string, number>;
	queryDetails: Record<string, any>;
	reranking?: Record<string, any>;
	answerGeneration?: Record<string, any>;
}

// Reranking context
export interface RerankingContext {
	strategyType: string;
	queryIndex?: number;
	isOriginal?: boolean;
	label?: string;
}

// Reranking result
export interface RerankingResult {
	docs: any[];
	debugInfo: any;
}

// Base strategy interface
export interface QueryStrategy {
	execute(input: string, context: StrategyContext): Promise<StrategyResult>;
	getName(): string;
	getDescription(): string;
}