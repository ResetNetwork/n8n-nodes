import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { BaseMemory } from '@langchain/core/memory';
import type { StructuredToolInterface } from '@langchain/core/tools';

/**
 * State of the REPL environment during execution
 */
export interface ReplState {
	/** Variables stored in the REPL environment */
	variables: Record<string, any>;
	/** History of code executions and their outputs */
	executionHistory: ExecutionStep[];
	/** Current iteration number */
	iteration: number;
	/** Maximum iterations allowed */
	maxIterations: number;
	/** Current recursion depth (0 = root, 1 = recursive) */
	depth: number;
	/** Maximum recursion depth allowed */
	maxDepth: number;
	/** Whether execution has completed */
	completed: boolean;
	/** Final answer if completed */
	finalAnswer?: string;
}

/**
 * Single step in the execution history
 */
export interface ExecutionStep {
	/** Iteration number */
	iteration: number;
	/** Recursion depth */
	depth: number;
	/** Code that was executed */
	code: string;
	/** Output from the code execution (truncated) */
	output: string;
	/** Raw output (full, for debugging) */
	rawOutput?: any;
	/** Any error that occurred */
	error?: string;
	/** Timestamp */
	timestamp: Date;
	/** Execution time in ms */
	executionTime: number;
}

/**
 * Result of a code execution
 */
export interface ExecutionResult {
	/** Whether execution was successful */
	success: boolean;
	/** Output value */
	output: any;
	/** Output as string (truncated for LM feedback) */
	outputString: string;
	/** Any error that occurred */
	error?: string;
	/** Execution time in ms */
	executionTime: number;
	/** Whether this is the final answer */
	isFinal: boolean;
	/** Final answer if isFinal is true */
	finalAnswer?: string;
	/** Name of variable to use as final answer */
	finalVarName?: string;
}

/**
 * Configuration for the RLM tool
 */
export interface RlmConfig {
	/** Maximum number of iterations per execution */
	maxIterations: number;
	/** Maximum recursion depth */
	maxDepth: number;
	/** Maximum size of context to accept */
	maxContextSize: number;
	/** Maximum length of output to return to LM */
	outputTruncationLength: number;
	/** Timeout per iteration in ms */
	iterationTimeout: number;
	/** Whether to enable debugging */
	debugging: boolean;
	/** Tool name for the RLM */
	toolName: string;
	/** Tool description */
	toolDescription: string;
}

/**
 * Context for executing RLM
 */
export interface RlmContext {
	/** The language model to use */
	model: BaseLanguageModel;
	/** Connected tools (optional) */
	tools?: StructuredToolInterface[];
	/** Memory for debugging (optional) */
	memory?: BaseMemory;
	/** Configuration */
	config: RlmConfig;
	/** Pre-loaded context (optional) */
	preloadedContext?: any;
}

/**
 * Result from an RLM execution
 */
export interface RlmResult {
	/** The final answer */
	answer: string;
	/** Execution metadata */
	metadata: {
		/** Total iterations used */
		iterations: number;
		/** Total execution time in ms */
		totalTime: number;
		/** Number of recursive calls made */
		recursiveCalls: number;
		/** Whether execution hit limits */
		hitLimit: boolean;
		/** Execution history (if debugging enabled) */
		executionHistory?: ExecutionStep[];
	};
}

/**
 * System prompt components for the root LM
 */
export interface SystemPromptComponents {
	/** Available tools description */
	toolsDescription: string;
	/** Available variables description */
	variablesDescription: string;
	/** REPL environment capabilities */
	replCapabilities: string;
	/** Example usage patterns */
	examples: string;
}

