import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { ReplEnvironment } from './ReplEnvironment';
import type {
	RlmConfig,
	RlmContext,
	RlmResult,
	SystemPromptComponents,
} from './types';

/**
 * Recursive LM Executor
 * Handles LM calls with depth tracking and manages the REPL loop
 */
export class RecursiveLmExecutor {
	private model: BaseLanguageModel;
	private config: RlmConfig;
	private context: RlmContext;
	private recursiveCallCount: number = 0;

	constructor(context: RlmContext) {
		this.model = context.model;
		this.config = context.config;
		this.context = context;
	}

	/**
	 * Execute RLM for a query
	 */
	async execute(query: string, depth: number = 0): Promise<RlmResult> {
		const startTime = Date.now();

		// Create REPL environment
		const repl = new ReplEnvironment(
			this.config,
			this.context.tools || [],
			this.context.preloadedContext,
		);

		// Set up recursive call handler
		repl.setRecursiveCallHandler(async (subQuery: string, subContext: any) => {
			if (depth >= this.config.maxDepth) {
				throw new Error(`Maximum recursion depth (${this.config.maxDepth}) reached`);
			}
			this.recursiveCallCount++;
			
			// Create a sub-executor for the recursive call
			const subContext: RlmContext = {
				...this.context,
				preloadedContext: subContext,
			};
			const subExecutor = new RecursiveLmExecutor(subContext);
			const result = await subExecutor.execute(subQuery, depth + 1);
			return result.answer;
		});

		// Generate system prompt
		const systemPrompt = this.generateSystemPrompt(repl, query, depth);

		// REPL execution loop
		let conversationHistory: Array<{ role: string; content: string }> = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: query },
		];

		let finalAnswer: string | undefined;
		let hitLimit = false;

		while (repl.shouldContinue()) {
			// Call LM to get next code block
			const response = await this.callModel(conversationHistory);
			
			// Extract code blocks from response
			const codeBlocks = this.extractCodeBlocks(response);

			if (codeBlocks.length === 0) {
				// No code blocks, check if this is a direct answer
				if (response.toLowerCase().includes('final(')) {
					// Try to extract FINAL() call from text
					const finalMatch = response.match(/FINAL\(['"](.+?)['"]\)/s);
					if (finalMatch) {
						finalAnswer = finalMatch[1];
						break;
					}
				}
				
				// No code and no FINAL, ask LM to provide code
				conversationHistory.push(
					{ role: 'assistant', content: response },
					{ role: 'user', content: 'Please provide executable JavaScript code in a code block to process this query.' },
				);
				continue;
			}

			// Execute each code block
			let lastResult;
			for (const code of codeBlocks) {
				const result = await repl.execute(code);
				lastResult = result;

				if (result.isFinal) {
					finalAnswer = result.finalAnswer;
					repl.complete(finalAnswer);
					break;
				}

				// Add execution result to conversation
				conversationHistory.push(
					{ role: 'assistant', content: `\`\`\`javascript\n${code}\n\`\`\`` },
					{ role: 'user', content: `Execution output:\n${result.outputString}` },
				);

				if (!result.success) {
					// Add error guidance
					conversationHistory.push({
						role: 'user',
						content: 'There was an error. Please fix the code and try again.',
					});
				}
			}

			if (finalAnswer) {
				break;
			}

			// Check if we should continue
			if (!repl.shouldContinue()) {
				hitLimit = true;
				finalAnswer = 'Execution reached maximum iteration limit without completing.';
				break;
			}
		}

		const totalTime = Date.now() - startTime;

		// If no final answer, try to get one from LM
		if (!finalAnswer) {
			conversationHistory.push({
				role: 'user',
				content: 'Please provide a final answer based on the results so far using FINAL().',
			});
			const finalResponse = await this.callModel(conversationHistory);
			
			// Try to extract answer
			const finalMatch = finalResponse.match(/FINAL\(['"](.+?)['"]\)/s);
			finalAnswer = finalMatch ? finalMatch[1] : finalResponse;
		}

		// Store execution history in memory if debugging enabled
		if (this.config.debugging && this.context.memory && depth === 0) {
			const history = repl.getExecutionHistory();
			await this.storeDebugInfo(history, query, finalAnswer);
		}

		return {
			answer: finalAnswer || 'No answer generated',
			metadata: {
				iterations: repl.getState().iteration,
				totalTime,
				recursiveCalls: this.recursiveCallCount,
				hitLimit,
				executionHistory: this.config.debugging ? repl.getExecutionHistory() : undefined,
			},
		};
	}

	/**
	 * Call the language model
	 */
	private async callModel(messages: Array<{ role: string; content: string }>): Promise<string> {
		// Convert to LangChain message format
		const formattedMessages = messages.map(msg => {
			if (msg.role === 'system') {
				return `System: ${msg.content}`;
			} else if (msg.role === 'user') {
				return `Human: ${msg.content}`;
			} else {
				return `Assistant: ${msg.content}`;
			}
		}).join('\n\n');

		const response = await this.model.invoke(formattedMessages);
		return typeof response === 'string' ? response : response.content.toString();
	}

	/**
	 * Generate system prompt for the LM
	 */
	private generateSystemPrompt(repl: ReplEnvironment, query: string, depth: number): string {
		const components: SystemPromptComponents = {
			toolsDescription: repl.getToolsDescription(),
			variablesDescription: repl.getVariablesDescription(),
			replCapabilities: this.getReplCapabilitiesDescription(),
			examples: this.getExamplePatterns(),
		};

		const depthIndicator = depth > 0 ? `\n\nYou are at recursion depth ${depth}.` : '';

		return `You are a Recursive Language Model (RLM) agent with access to a JavaScript REPL environment.

Your task is to answer the user's query by writing and executing JavaScript code that processes the available context.

${components.variablesDescription}

${components.toolsDescription}

${components.replCapabilities}

${components.examples}

IMPORTANT RULES:
1. Write executable JavaScript code in markdown code blocks
2. Use FINAL(answer) when you have a final answer to return
3. Use FINAL_VAR(varName) to return the value of a variable as the final answer
4. You can call rlm(query, context) to recursively process subsets of data
5. Store intermediate results in variables for later use
6. All code must be valid JavaScript that can run in a sandbox

${depthIndicator}

Begin by analyzing the query and determining the best approach to answer it.`;
	}

	/**
	 * Get REPL capabilities description
	 */
	private getReplCapabilitiesDescription(): string {
		return `REPL Capabilities:
- Execute JavaScript code in a sandboxed environment
- Store and access variables across executions
- Call connected tools as functions
- Make recursive LM calls with rlm(query, context)
- Use FINAL(answer) or FINAL_VAR(varName) to return results
- Standard JavaScript utilities: JSON, String, Array, Object, Math`;
	}

	/**
	 * Get example patterns
	 */
	private getExamplePatterns(): string {
		return `Example Patterns:

Pattern 1: Direct processing (small context)
\`\`\`javascript
const chunks = context.split('\\n\\n');
const summaries = [];
for (const chunk of chunks) {
  const summary = await rlm("summarize this", chunk);
  summaries.push(summary);
}
FINAL(summaries.join('\\n'));
\`\`\`

Pattern 2: Tool-based retrieval
\`\`\`javascript
const docs = await vectorSearch("key findings", 20);
const relevant = docs.filter(d => d.score > 0.7);
const answer = await rlm("synthesize findings", relevant);
FINAL(answer);
\`\`\`

Pattern 3: Hybrid approach
\`\`\`javascript
const candidates = await queryRetriever("main conclusions");
const verified = candidates.filter(c => context.includes(c.text));
FINAL_VAR('verified');
\`\`\``;
	}

	/**
	 * Extract code blocks from LM response
	 */
	private extractCodeBlocks(response: string): string[] {
		const codeBlockRegex = /```(?:javascript|js)?\n([\s\S]*?)```/g;
		const blocks: string[] = [];
		let match;

		while ((match = codeBlockRegex.exec(response)) !== null) {
			blocks.push(match[1].trim());
		}

		return blocks;
	}

	/**
	 * Store debug info in memory
	 */
	private async storeDebugInfo(
		history: any[],
		query: string,
		answer: string,
	): Promise<void> {
		if (!this.context.memory) return;

		try {
			const debugInfo = {
				query,
				answer,
				executionHistory: history,
				timestamp: new Date().toISOString(),
			};

			// Store in memory context
			await this.context.memory.saveContext(
				{ input: `RLM Debug: ${query}` },
				{ output: JSON.stringify(debugInfo, null, 2) },
			);
		} catch (error) {
			// Silently fail if memory storage fails
			console.error('Failed to store debug info:', error);
		}
	}
}

