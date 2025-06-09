import { BaseStrategy } from './BaseStrategy';
import { RerankingManager } from '../shared/reranking';
import type { StrategyContext, StrategyResult } from '../shared/types';

interface StepResult {
	step: number;
	subQuery: string;
	documents: any[];
	stepAnswer: string;
	reasoning: string;
	shouldStop: boolean;
}

export class MultiStepQueryStrategy extends BaseStrategy {
	getName(): string {
		return 'multi_step_query';
	}

	getDescription(): string {
		return 'Break complex queries into sequential reasoning steps, building context progressively';
	}

	async execute(input: string, context: StrategyContext): Promise<StrategyResult> {
		try {
			// Initialize debug manager
			this.initializeDebugManager('multi_step_query', context.config);

			const maxSteps = context.config.maxSteps || 3;
			const enableEarlyStop = context.config.enableEarlyStop !== false;
			
			let prevReasoning = "";
			let allDocuments: any[] = [];
			const stepResults: StepResult[] = [];
			const stepStart = Date.now();

			this.debugManager.setQueryDetails({
				original: input,
				maxSteps,
				enableEarlyStop
			});

			// Execute multi-step reasoning
			for (let step = 0; step < maxSteps; step++) {
				const stepStartTime = Date.now();
				
				try {
					// 1. Generate sub-question for this step
					const subQuery = await this.generateSubQuery(input, prevReasoning, step, context);
					
					// 2. Retrieve and rerank documents for this sub-question
					const stepDocs = await this.retrieveForStep(subQuery, step, context);
					
					// 3. Generate intermediate answer for this step
					const stepAnswer = await this.generateStepAnswer(stepDocs, subQuery, prevReasoning, context);
					
					// 4. Check if we should stop early
					const shouldStop = enableEarlyStop && step > 0 && 
						await this.shouldStopEarly(stepAnswer, input, prevReasoning, context);
					
					// 5. Update accumulated reasoning
					const stepReasoning = `Step ${step + 1}: ${subQuery}\nAnswer: ${stepAnswer}`;
					prevReasoning += (prevReasoning ? '\n\n' : '') + stepReasoning;
					
					// 6. Store step result
					const stepResult: StepResult = {
						step: step + 1,
						subQuery,
						documents: stepDocs,
						stepAnswer,
						reasoning: stepReasoning,
						shouldStop
					};
					stepResults.push(stepResult);
					
					// 7. Add documents to collection (with deduplication)
					this.addDocumentsWithDeduplication(allDocuments, stepDocs);
					
					this.debugManager.addTiming(`step_${step + 1}`, stepStartTime);
					
					// 8. Early stopping check
					if (shouldStop) {
						this.debugManager.setQueryDetails({
							stoppedEarly: true,
							stoppedAtStep: step + 1,
							reason: 'Early stopping condition met'
						});
						break;
					}
					
				} catch (stepError) {
					// Log step error but continue with other steps
					this.debugManager.setQueryDetails({
						[`step_${step + 1}_error`]: stepError instanceof Error ? stepError.message : String(stepError)
					});
					continue;
				}
			}

			this.debugManager.addTiming('allSteps', stepStart);
			this.debugManager.setDocumentFlow({
				totalStepsExecuted: stepResults.length,
				totalDocumentsCollected: allDocuments.length,
				finalCount: allDocuments.length
			});

			// Store detailed step debugging information
			if (context.debugging) {
				this.debugManager.setRerankingData({
					multiStepDetails: {
						stepResults: stepResults.map(r => ({
							step: r.step,
							subQuery: r.subQuery,
							documentsRetrieved: r.documents.length,
							stepAnswer: r.stepAnswer.substring(0, 200) + (r.stepAnswer.length > 200 ? '...' : ''),
							shouldStop: r.shouldStop
						})),
						stepsData: stepResults.map(r => ({
							step: r.step,
							documentsFound: r.documents.length,
							subQuery: r.subQuery
						})),
						progressiveReasoning: prevReasoning,
						documentDeduplication: {
							totalCollected: allDocuments.length,
							uniqueAfterDedup: allDocuments.length
						}
					}
				});
			}

			// 9. Final synthesis from all steps
			const finalAnswer = await this.synthesizeFinalAnswer(input, prevReasoning, allDocuments, stepResults, context);

			// Handle debugging
			await this.handleDebugging(input, context);

			// Format and return result
			return this.formatResult(finalAnswer, allDocuments, context);

		} catch (error) {
			return {
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	// Generate next sub-question based on original query and previous reasoning
	private async generateSubQuery(
		originalQuery: string, 
		prevReasoning: string, 
		step: number, 
		context: StrategyContext
	): Promise<string> {
		const stepPrompt = `You are helping to answer a complex question through step-by-step reasoning. 

Original Question: "${originalQuery}"

${prevReasoning ? `Previous Steps:\n${prevReasoning}\n` : ''}

Generate the next specific sub-question that should be answered in Step ${step + 1} to help build toward answering the original question. The sub-question should:
- Build on previous steps if any exist
- Focus on a specific aspect that hasn't been fully addressed
- Be answerable with document retrieval
- Move toward answering the original question

Output only the sub-question, no explanations:`;

		const response = await context.model.invoke(stepPrompt);
		const subQuery = typeof response === 'string' ? response : response.content || response.text || String(response);
		
		return subQuery.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
	}

	// Retrieve documents for a specific step
	private async retrieveForStep(subQuery: string, step: number, context: StrategyContext): Promise<any[]> {
		try {
			// Retrieve documents for this sub-query
			const rawDocs = await context.vectorStore.similaritySearch(subQuery, context.config.documentsToRetrieve);
			
			// Apply reranking specific to this step
			const rerankResult = await RerankingManager.performReranking(
				rawDocs,
				subQuery,
				context.embeddings,
				Math.min(context.config.documentsToReturn, rawDocs.length),
				{
					strategyType: 'multi_step_query',
					queryIndex: step,
					label: `step ${step + 1}`
				},
				context.debugging
			);

			return rerankResult.docs;

		} catch (error) {
			// Return empty array if retrieval fails
			return [];
		}
	}

	// Generate answer for a specific step
	private async generateStepAnswer(
		stepDocs: any[], 
		subQuery: string, 
		prevReasoning: string,
		context: StrategyContext
	): Promise<string> {
		if (stepDocs.length === 0) {
			return "No relevant documents found for this step.";
		}

		// Prepare context from step documents
		const stepContext = stepDocs.map((doc, index) => 
			`Document ${index + 1}:\n${doc.pageContent}\n`
		).join('\n');

		const stepPrompt = `Answer the following sub-question using the provided documents. Be concise but thorough.

${prevReasoning ? `Previous reasoning:\n${prevReasoning}\n\n` : ''}

Sub-question: ${subQuery}

Available documents:
${stepContext}

Answer:`;

		const response = await context.model.invoke(stepPrompt);
		return typeof response === 'string' ? response : response.content || response.text || String(response);
	}

	// Check if we should stop early based on the current step's answer
	private async shouldStopEarly(
		stepAnswer: string, 
		originalQuery: string,
		prevReasoning: string,
		context: StrategyContext
	): Promise<boolean> {
		const stopPrompt = `Determine if we have sufficient information to answer the original question.

Original Question: "${originalQuery}"

Reasoning so far:
${prevReasoning}

Current step answer: ${stepAnswer}

Can the original question be sufficiently answered with the information gathered so far? 
Respond with only "YES" or "NO":`;

		try {
			const response = await context.model.invoke(stopPrompt);
			const decision = typeof response === 'string' ? response : response.content || response.text || String(response);
			return decision.trim().toUpperCase().includes('YES');
		} catch (error) {
			// If check fails, continue with more steps
			return false;
		}
	}

	// Add documents with deduplication
	private addDocumentsWithDeduplication(allDocuments: any[], newDocuments: any[]): void {
		const existingContent = new Set(allDocuments.map(doc => doc.pageContent.trim()));
		
		for (const doc of newDocuments) {
			if (!existingContent.has(doc.pageContent.trim())) {
				allDocuments.push(doc);
				existingContent.add(doc.pageContent.trim());
			}
		}
	}

	// Synthesize final answer from all steps
	private async synthesizeFinalAnswer(
		originalQuery: string,
		prevReasoning: string,
		allDocuments: any[],
		stepResults: StepResult[],
		context: StrategyContext
	): Promise<string> {
		// Prepare comprehensive context
		const documentContext = allDocuments.map((doc, index) => 
			`Document ${index + 1}:\n${doc.pageContent}\n`
		).join('\n');

		const synthesisPrompt = `Provide a comprehensive answer to the original question using the step-by-step reasoning and supporting documents.

Original Question: "${originalQuery}"

Step-by-step reasoning:
${prevReasoning}

Supporting documents:
${documentContext}

Synthesize a complete, well-structured answer that:
1. Directly addresses the original question
2. Incorporates insights from the step-by-step reasoning
3. References relevant information from the documents
4. Is coherent and comprehensive

Final Answer:`;

		const answerStart = Date.now();
		const response = await context.model.invoke(synthesisPrompt);
		this.debugManager.addTiming('finalSynthesis', answerStart);

		this.debugManager.setAnswerGenerationData({
			stepsCount: stepResults.length,
			reasoningLength: prevReasoning.length,
			documentsUsed: allDocuments.length,
			synthesisPromptLength: synthesisPrompt.length
		});

		return typeof response === 'string' ? response : response.content || response.text || String(response);
	}
}