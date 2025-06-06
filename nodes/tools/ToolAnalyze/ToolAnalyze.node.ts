/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	NodeConnectionType,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { logWrapper } from '../../../utils/logWrapper';
import { getConnectionHintNoticeField } from '../../../utils/sharedFields';
import { DynamicTool } from '@langchain/core/tools';
import { ToolName } from '../../../utils/toolName';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import { SearchResult, UserIntent, ReflectionResult, SearchEvaluation } from './types';
import { ReflectionSchema, SearchEvaluationSchema, UserIntentSchema } from './types';
import { systemMessage, searchPrompt, intentPrompt, evaluationPrompt, reflectionPrompt } from './DeepAnalyzePrompt';
import { executeStep, formatAllSteps, formatEvaluation, formatReflection, formatUserIntent } from './utils';


export class ToolAnalyze implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bink AI Deep Analyze Tool',
		name: ToolName.ANALYZE_TOOL,
		icon: 'file:../../icons/analyze_bink_ai.svg',
		iconColor: 'black',
		group: ['transform'],
		version: 1,
		description: 'Advanced AI research tool with reflection, evaluation, and iterative search capabilities',
		defaults: {
			name: 'BinkAI Analyze',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
				Tools: ['Analyze Tools'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://bink.ai',
					},
				],
			},
		},
		// eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
		inputs: [],
		// eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
		outputs: [NodeConnectionType.AiTool],
		outputNames: ['Tool'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionType.AiAgent]),
			{
				displayName: 'Analyze Query',
				name: 'analyzeQuery',
				type: 'string',
				required: true,
				default: '{{ $json.chatInput }}',
				description: 'Main research topic or question',
			},
			{
				displayName: 'Gemini Model',
				name: 'geminiModel',
				type: 'options',
				required: true,
				default: 'gemini-2.0-flash-exp',
				options: [
					{ name: 'gemini-2.0-flash-exp', value: 'gemini-2.0-flash-exp' },
					{ name: 'gemini-2.0-lite', value: 'gemini-2.0-lite' },
					{ name: 'gemini-1.5-pro', value: 'gemini-1.5-pro' },
					{ name: 'gemini-1.5-flash', value: 'gemini-1.5-flash' },
				],
			},
			{
				displayName: 'Max Research Iterations',
				name: 'maxIterations',
				type: 'number',
				description: 'Maximum number of research iterations',
				default: 2,
				typeOptions: { minValue: 1, maxValue: 5 },
			},
			{
				displayName: 'Search Temperature',
				name: 'searchTemperature',
				type: 'number',
				description: 'Temperature for search queries (0.0 = focused, 1.0 = creative)',
				default: 0.1,
				typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.1 },
			},
			{
				displayName: 'Analysis Temperature',
				name: 'analysisTemperature',
				type: 'number',
				description: 'Temperature for reflection analysis (higher = more critical)',
				default: 0.3,
				typeOptions: { minValue: 0, maxValue: 1, numberStepSize: 0.1 },
			},
			{
				displayName:
					'🧠 <strong>Advanced Research Tool with Reflection & Evaluation</strong><br><br>' +
					'<strong>Research Workflow:</strong><br>' +
					'&nbsp;&nbsp; 1. 🔍 <strong>Initial Search</strong> - Web search with Google API<br>' +
					'&nbsp;&nbsp; 2. 🤔 <strong>Reflection Analysis</strong> - Evaluate completeness & identify gaps<br>' +
					'&nbsp;&nbsp; 3. ⚖️ <strong>Search Evaluation</strong> - Determine if more research needed<br>' +
					'&nbsp;&nbsp; 4. 🔄 <strong>Continue Search</strong> - Follow-up searches if necessary<br>' +
					'&nbsp;&nbsp; 5. 💡 <strong>Suggest Next Move</strong> - Recommend optimal actions<br><br>' +
					'<strong>Key Features:</strong><br>' +
					'&nbsp;&nbsp; • Knowledge gap identification<br>' +
					'&nbsp;&nbsp; • Confidence scoring<br>' +
					'&nbsp;&nbsp; • Iterative research refinement<br>' +
					'&nbsp;&nbsp; • Intelligent next-step suggestions',
				name: 'notice_tip',
				type: 'notice',
				default: '',
			},
		],
		credentials: [
			{
				name: 'binkaiSearchCredentials',
				required: true,
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
		this.logger.info('Supplying data for ToolAnalyze for BinkAI');

		const binkaiSearchCredentials = await this.getCredentials('binkaiSearchCredentials');
		const geminiApiKey = binkaiSearchCredentials.geminiApiKey as string;
		const analyzeQuery = this.getNodeParameter('analyzeQuery', 0, '') as string;
		const searchTemperature = this.getNodeParameter('searchTemperature', 0, 0.1) as number;
		const analysisTemperature = this.getNodeParameter('analysisTemperature', 0, 0.3) as number;
		const maxIterations = this.getNodeParameter('maxIterations', 0, 3) as number;
		const geminiModel = this.getNodeParameter('geminiModel', 0, 'gemini-2.0-flash-exp') as string;


		const tool = new DynamicTool({
			name: ToolName.ANALYZE_TOOL,
			description: 'Advanced research tool with step-by-step analysis and real-time progress tracking.',
			func: async (analyzeQuery: string) => {
				try {
					if (!analyzeQuery || analyzeQuery.trim() === '') {
						return 'Please provide a research query';
					}

					const researchTool = new AdvancedResearch(
						geminiApiKey,
						searchTemperature,
						analysisTemperature,
						geminiModel,
						maxIterations,
						systemMessage
					);

					// Option 1: Return step-by-step structured result
					return await researchTool.performComprehensiveResearch(analyzeQuery);


				} catch (error) {
					this.logger.error('Error in advanced research:', error);
					return `Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
				}
			},
		});

		return {
			response: logWrapper(tool, this),
		};
	}
}

class AdvancedResearch {
	private geminiApiKey: string;
	private searchTemperature: number;
	private analysisTemperature: number;
	private geminiModel: string;
	private maxIterations: number;
	private systemMessage: string;
	private searchResults: SearchResult[] = [];
	private currentIteration = 0;
	private userIntent?: UserIntent;
    private stepResults: Array<{step: string, title: string, content: string, timestamp: string}> = [];

	constructor(
		geminiApiKey: string,
		searchTemperature: number,
		analysisTemperature: number,
		geminiModel: string,
		maxIterations: number,
		systemMessage: string
	) {
		this.geminiApiKey = geminiApiKey;
		this.searchTemperature = searchTemperature;
		this.analysisTemperature = analysisTemperature;
		this.geminiModel = geminiModel;
		this.maxIterations = maxIterations;
		this.systemMessage = systemMessage;
	}

	private getCurrentDate(): string {
		return new Date().toISOString().split('T')[0];
	}

	async performComprehensiveResearch(query: string): Promise<string> {
		// Step 1: Combined Intent Analysis + Query Optimization
		await executeStep('intent_and_optimization', '🎯 Intent Analysis & Query Optimization', async () => {
			const combined = await this.analyzeIntentAndOptimizeQuery(query);
			this.userIntent = combined.intent;
			return `${formatUserIntent(combined.intent)}\n\n**Optimized Queries:**\n${combined.optimizedQueries.join('\n')}`;
		}, this.stepResults);

		// Step 2: Initial Search with multiple queries simultaneously
		await executeStep('batch_initial_search', '🔍 Batch Initial Research', async () => {
			const optimizedQueries = await this.getOptimizedQueries(query, this.userIntent!);
			const batchResults = await this.performBatchWebSearch(optimizedQueries.slice(0, 2));
			this.searchResults.push(...batchResults);
			return batchResults.map(r => `**Query:** ${r.query}\n\n${r.content}`).join('\n\n---\n\n');
		}, this.stepResults);

		// Research iteration loop - Combined reflection + evaluation
		while (this.currentIteration < this.maxIterations) {
			this.currentIteration++;

			const evaluation = await this.performReflectionAndEvaluation(query);

            if (!evaluation.evaluation.should_continue || evaluation.evaluation.next_action === 'finalize') {
				await executeStep('completion', '🏁 Research Completion', async () => {
					return `Research completed after ${this.currentIteration} iterations.\n\n**Reason:** ${evaluation.evaluation.reasoning}`;
				}, this.stepResults);
				break;
			}

			await executeStep(
				`reflection_evaluation_${this.currentIteration}`, 
				`🤔 Reflection & Evaluation - Iteration ${this.currentIteration}`, 
				async () => {
					return `${formatReflection(evaluation.reflection)}\n\n${formatEvaluation(evaluation.evaluation)}`;
				}, this.stepResults);

			// Batch follow-up searches
			if (evaluation.evaluation.next_action === 'search') {
				await executeStep(`batch_followup_${this.currentIteration}`, `🔄 Batch Follow-up Research - Iteration ${this.currentIteration}`, async () => {
					const followUpQueries = evaluation.reflection.follow_up_queries.slice(0, 3);
					const optimized = await this.batchOptimizeQueries(followUpQueries, this.userIntent!);
					const batchResults = await this.performBatchWebSearch(optimized);
					this.searchResults.push(...batchResults);
					
					return batchResults.map(r => `**Query:** ${r.query}\n\n${r.content}`).join('\n\n---\n\n');
				}, this.stepResults);
			}

			if (this.currentIteration >= this.maxIterations) {
				await executeStep('max_iterations', '⏰ Maximum Iterations Reached', async () => {
					return `Maximum iterations (${this.maxIterations}) reached. Research will now be finalized.`;
				}, this.stepResults);
				break;
			}
		}

		// Final suggestions remains the same
		await executeStep('final_suggestions', '💡 Final Recommendations', async () => {
			return await this.generateSuggestions(query);
		}, this.stepResults);

		return formatAllSteps(query, this.stepResults);
	}

	
	// Fix generateSuggestions method
	private async generateSuggestions(originalQuery: string): Promise<string> {
		const suggestionPrompt = `Based on the comprehensive research conducted for: ${originalQuery}

USER INTENT CONTEXT:
- Primary Intent: ${this.userIntent?.primary_intent}
- User Context: ${this.userIntent?.user_context}
- Focus Areas: ${this.userIntent?.focus_areas.join(', ')}

Research summary:
- Total iterations: ${this.currentIteration}
- Total searches: ${this.searchResults.length}
- Research queries: ${this.searchResults.map(r => r.query).join(', ')}

Steps completed: ${this.stepResults.map(s => s.title).join(' → ')}

Provide final actionable recommendations specifically tailored to the user's intent and context.`;

		try {
			const model = new ChatGoogleGenerativeAI({
				model: this.geminiModel,
				temperature: 0.5,
				maxRetries: 2,
				apiKey: this.geminiApiKey,
			});

			const result = await model.invoke(suggestionPrompt);
			return result.content?.toString() || 'No suggestions available';

		} catch (error) {
			console.error('Suggestion error:', error);
			return 'Unable to generate suggestions due to analysis error.';
		}
	}

	// Combined methods
	private async analyzeIntentAndOptimizeQuery(query: string): Promise<{intent: UserIntent, optimizedQueries: string[]}> {
		const combinedPrompt = `${intentPrompt}

Additionally, based on the analyzed intent, provide 2-3 optimized search queries that would comprehensively address the user's needs.

Analyze this query: "${query}"

Return both the intent analysis and optimized search queries.`;

		try {
			const model = new ChatGoogleGenerativeAI({
				model: this.geminiModel,
				temperature: 0.3,
				maxRetries: 2,
				apiKey: this.geminiApiKey,
			});

			// Combined schema
			const CombinedSchema = z.object({
				intent: UserIntentSchema,
				optimized_queries: z.array(z.string()).describe('2-3 optimized search queries based on intent'),
			});

			const structuredModel = model.withStructuredOutput(CombinedSchema);
			const result = await structuredModel.invoke(combinedPrompt);

			return {
				intent: {
					primary_intent: result.intent.primary_intent,
					user_context: result.intent.user_context,
					focus_areas: result.intent.focus_areas,
					suggested_angles: result.intent.suggested_angles,
				},
				optimizedQueries: result.optimized_queries,
			};

		} catch (error) {
			console.error('Combined intent analysis error:', error);
			return {
				intent: {
					primary_intent: 'information_seeking',
					user_context: 'general_public',
					focus_areas: ['general information'],
					suggested_angles: ['comprehensive overview'],
				},
				optimizedQueries: [query],
			};
		}
	}

	private async performReflectionAndEvaluation(originalQuery: string): Promise<{reflection: ReflectionResult, evaluation: SearchEvaluation}> {
		const combinedPrompt = `You are analyzing research completeness for: ${originalQuery}

USER INTENT CONTEXT:
- Primary Intent: ${this.userIntent?.primary_intent}
- Focus Areas: ${this.userIntent?.focus_areas.join(', ')}

Current research findings:
${this.searchResults.map((result, index) => 
	`### Search ${index + 1}: ${result.query}\n${result.content}`
).join('\n\n---\n\n')}

${reflectionPrompt}

Additionally, ${evaluationPrompt}
Current iteration: ${this.currentIteration}/${this.maxIterations}

Provide both reflection analysis and search evaluation.`;

		try {
			const model = new ChatGoogleGenerativeAI({
				model: this.geminiModel,
				temperature: this.analysisTemperature,
				maxRetries: 2,
				apiKey: this.geminiApiKey,
			});

			const CombinedReflectionEvaluationSchema = z.object({
				reflection: ReflectionSchema,
				evaluation: SearchEvaluationSchema,
			});

			const structuredModel = model.withStructuredOutput(CombinedReflectionEvaluationSchema);
			const result = await structuredModel.invoke(combinedPrompt);

			return {
				reflection: {
					is_sufficient: result.reflection.is_sufficient,
					knowledge_gap: result.reflection.knowledge_gap,
					follow_up_queries: result.reflection.follow_up_queries,
					confidence_score: result.reflection.confidence_score,
				},
				evaluation: {
					should_continue: result.evaluation.should_continue,
					next_action: result.evaluation.next_action,
					priority_areas: result.evaluation.priority_areas,
					reasoning: result.evaluation.reasoning,
				},
			};

		} catch (error) {
			console.error('Combined reflection evaluation error:', error);
			return {
				reflection: {
					is_sufficient: true,
					knowledge_gap: 'Unable to perform reflection analysis',
					follow_up_queries: [],
					confidence_score: 0.5,
				},
				evaluation: {
					should_continue: false,
					next_action: 'finalize',
					priority_areas: [],
					reasoning: 'Unable to perform evaluation analysis',
				},
			};
		}
	}

	private async performBatchWebSearch(queries: string[]): Promise<SearchResult[]> {
		const batchPrompt = `${searchPrompt}

Current date: ${this.getCurrentDate()}
Research iteration: ${this.currentIteration + 1}/${this.maxIterations}

Perform comprehensive web search for these queries:
${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Provide detailed results for each query separately.`;

		try {
			const model = new ChatGoogleGenerativeAI({
				model: this.geminiModel,
				temperature: this.searchTemperature,
				maxRetries: 2,
				apiKey: this.geminiApiKey,
			});

			const modelWithSearch = model.bind({
				tools: [{ google_search: {} }],
			});

			const result = await modelWithSearch.invoke(batchPrompt);
			
			let searchContent = '';
			if (Array.isArray(result.content)) {
				searchContent = result.content
					.map(item => {
						if (typeof item === 'string') return item;
						if (item && typeof item === 'object' && 'text' in item) return item.text;
						return '';
					})
					.join('\n');
			} else {
				searchContent = result.content?.toString() || '';
			}

			// Split results by queries (this is a simplified approach)
			return queries.map(query => ({
				query,
				content: searchContent, 
            }));

		} catch (error) {
			console.error('Batch web search error:', error);
			throw error;
		}
	}

	private async batchOptimizeQueries(queries: string[], intent: UserIntent): Promise<string[]> {
		const batchOptimizePrompt = `Optimize these search queries based on user intent:

Queries: ${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}
Intent: ${intent.primary_intent}
Context: ${intent.user_context}
Focus Areas: ${intent.focus_areas.join(', ')}

Return optimized versions of each query that are more comprehensive and targeted.`;

		try {
			const model = new ChatGoogleGenerativeAI({
				model: this.geminiModel,
				temperature: 0.2,
				maxRetries: 2,
				apiKey: this.geminiApiKey,
			});

			const BatchOptimizationSchema = z.object({
				optimized_queries: z.array(z.string()).describe('Optimized versions of the input queries'),
			});

			const structuredModel = model.withStructuredOutput(BatchOptimizationSchema);
			const result = await structuredModel.invoke(batchOptimizePrompt);
			
			return result.optimized_queries;

		} catch (error) {
			console.error('Batch query optimization error:', error);
			return queries; // Return original queries if optimization fails
		}
	}

	private async getOptimizedQueries(originalQuery: string, intent: UserIntent): Promise<string[]> {
		// This can reuse the result from analyzeIntentAndOptimizeQuery
		// or be called separately if needed
		const result = await this.analyzeIntentAndOptimizeQuery(originalQuery);
		return result.optimizedQueries;
	}
}