import { VM } from 'vm2';
import type { StructuredToolInterface } from '@langchain/core/tools';
import type {
	ReplState,
	ExecutionResult,
	RlmConfig,
} from './types';

/**
 * REPL Environment Manager
 * Manages JavaScript code execution in a sandboxed environment
 */
export class ReplEnvironment {
	private vm: VM;
	private state: ReplState;
	private config: RlmConfig;
	private tools: Map<string, StructuredToolInterface>;
	private recursiveCallHandler?: (query: string, context: any) => Promise<string>;

	constructor(
		config: RlmConfig,
		tools: StructuredToolInterface[] = [],
		preloadedContext?: any,
	) {
		this.config = config;
		this.tools = new Map(tools.map(t => [t.name, t]));
		
		// Initialize state
		this.state = {
			variables: {},
			executionHistory: [],
			iteration: 0,
			maxIterations: config.maxIterations,
			depth: 0,
			maxDepth: config.maxDepth,
			completed: false,
		};

		// Pre-load context if provided
		if (preloadedContext !== undefined) {
			this.state.variables.context = preloadedContext;
		}

		// Initialize VM with restricted environment
		this.vm = new VM({
			timeout: config.iterationTimeout,
			sandbox: this.createSandbox(),
			eval: false,
			wasm: false,
		});
	}

	/**
	 * Create the sandbox environment with available functions
	 */
	private createSandbox(): Record<string, any> {
		const sandbox: Record<string, any> = {
			// Expose state variables
			...this.state.variables,

			// Console for debugging (limited)
			console: {
				log: (...args: any[]) => JSON.stringify(args),
			},

			// JSON utilities
			JSON: JSON,

			// String utilities
			String: String,
			
			// Array utilities
			Array: Array,

			// Object utilities
			Object: {
				keys: Object.keys,
				values: Object.values,
				entries: Object.entries,
			},

			// Math utilities
			Math: Math,

			// FINAL() function to return answer
			FINAL: (answer: string) => {
				return { __rlm_final__: true, answer };
			},

			// FINAL_VAR() function to return variable as answer
			FINAL_VAR: (varName: string) => {
				return { __rlm_final_var__: true, varName };
			},
		};

		// Add connected tools as callable functions
		for (const [name, tool] of this.tools) {
			sandbox[name] = async (...args: any[]) => {
				try {
					// Call the tool with JSON stringified input
					const input = args.length === 1 ? args[0] : args;
					const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
					const result = await tool.invoke(inputStr);
					return result;
				} catch (error) {
					throw new Error(`Tool ${name} error: ${(error as Error).message}`);
				}
			};
		}

		// Add rlm() recursive call function
		if (this.recursiveCallHandler) {
			sandbox.rlm = this.recursiveCallHandler;
		}

		return sandbox;
	}

	/**
	 * Set the recursive call handler
	 */
	setRecursiveCallHandler(handler: (query: string, context: any) => Promise<string>): void {
		this.recursiveCallHandler = handler;
		// Update sandbox
		if (this.vm) {
			this.vm.setGlobal('rlm', handler);
		}
	}

	/**
	 * Execute code in the REPL environment
	 */
	async execute(code: string): Promise<ExecutionResult> {
		const startTime = Date.now();
		
		try {
			// Update sandbox with current variables
			for (const [key, value] of Object.entries(this.state.variables)) {
				this.vm.setGlobal(key, value);
			}

			// Execute code
			const result = await this.vm.run(code);
			const executionTime = Date.now() - startTime;

			// Check if this is a FINAL() call
			if (result && typeof result === 'object' && result.__rlm_final__) {
				return {
					success: true,
					output: result.answer,
					outputString: String(result.answer),
					executionTime,
					isFinal: true,
					finalAnswer: String(result.answer),
				};
			}

			// Check if this is a FINAL_VAR() call
			if (result && typeof result === 'object' && result.__rlm_final_var__) {
				const varValue = this.state.variables[result.varName];
				if (varValue === undefined) {
					throw new Error(`Variable '${result.varName}' not found in REPL environment`);
				}
				return {
					success: true,
					output: varValue,
					outputString: String(varValue),
					executionTime,
					isFinal: true,
					finalAnswer: String(varValue),
				};
			}

			// Regular execution - update variables from sandbox
			const sandboxVars = this.vm.getGlobal('Object').keys(this.vm.getGlobal('this'));
			for (const key of sandboxVars) {
				if (!key.startsWith('__') && key !== 'console' && key !== 'FINAL' && key !== 'FINAL_VAR') {
					try {
						this.state.variables[key] = this.vm.getGlobal(key);
					} catch (e) {
						// Skip if can't access
					}
				}
			}

			// Truncate output for LM feedback
			const outputString = this.truncateOutput(result);

			// Record execution step
			this.state.executionHistory.push({
				iteration: this.state.iteration,
				depth: this.state.depth,
				code,
				output: outputString,
				rawOutput: result,
				timestamp: new Date(),
				executionTime,
			});

			this.state.iteration++;

			return {
				success: true,
				output: result,
				outputString,
				executionTime,
				isFinal: false,
			};

		} catch (error) {
			const executionTime = Date.now() - startTime;
			const errorMessage = (error as Error).message;

			// Record error in execution history
			this.state.executionHistory.push({
				iteration: this.state.iteration,
				depth: this.state.depth,
				code,
				output: '',
				error: errorMessage,
				timestamp: new Date(),
				executionTime,
			});

			this.state.iteration++;

			return {
				success: false,
				output: null,
				outputString: `Error: ${errorMessage}`,
				error: errorMessage,
				executionTime,
				isFinal: false,
			};
		}
	}

	/**
	 * Truncate output for LM feedback
	 */
	private truncateOutput(output: any): string {
		const str = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
		
		if (str.length <= this.config.outputTruncationLength) {
			return str;
		}

		const truncated = str.slice(0, this.config.outputTruncationLength);
		return `${truncated}\n... (truncated, ${str.length - this.config.outputTruncationLength} more characters)`;
	}

	/**
	 * Get current state
	 */
	getState(): ReplState {
		return { ...this.state };
	}

	/**
	 * Get execution history
	 */
	getExecutionHistory(): typeof this.state.executionHistory {
		return [...this.state.executionHistory];
	}

	/**
	 * Check if execution should continue
	 */
	shouldContinue(): boolean {
		return !this.state.completed && this.state.iteration < this.state.maxIterations;
	}

	/**
	 * Mark execution as completed
	 */
	complete(finalAnswer?: string): void {
		this.state.completed = true;
		this.state.finalAnswer = finalAnswer;
	}

	/**
	 * Get available tools description for system prompt
	 */
	getToolsDescription(): string {
		if (this.tools.size === 0) {
			return 'No tools available.';
		}

		const toolDescriptions = Array.from(this.tools.values()).map(tool => 
			`- ${tool.name}(...args): ${tool.description}`
		).join('\n');

		return `Available tools:\n${toolDescriptions}`;
	}

	/**
	 * Get available variables description for system prompt
	 */
	getVariablesDescription(): string {
		const vars = Object.keys(this.state.variables);
		if (vars.length === 0) {
			return 'No pre-loaded variables.';
		}

		const varDescriptions = vars.map(key => {
			const value = this.state.variables[key];
			const type = Array.isArray(value) ? 'array' : typeof value;
			const size = typeof value === 'string' ? value.length : 
						Array.isArray(value) ? value.length : 
						typeof value === 'object' ? JSON.stringify(value).length : 0;
			return `- ${key} (${type}${size > 0 ? `, size: ${size}` : ''})`;
		}).join('\n');

		return `Available variables:\n${varDescriptions}`;
	}
}

