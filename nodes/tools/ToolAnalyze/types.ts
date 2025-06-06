import { z } from "zod";

export interface SearchResult {
	query: string;
	content: string;
	sources?: any[];
}

export interface ReflectionResult {
	is_sufficient: boolean;
	knowledge_gap: string;
	follow_up_queries: string[];
	confidence_score: number;
}

export interface SearchEvaluation {
	should_continue: boolean;
	next_action: 'search' | 'finalize' | 'clarify' | 'suggest';
	priority_areas: string[];
	reasoning: string;
}

export interface UserIntent {
	primary_intent: string;
	user_context: string;
	focus_areas: string[];
	suggested_angles: string[];
}


// Schema for reflection analysis
export const ReflectionSchema = z.object({
	is_sufficient: z.boolean().describe('Whether the current research is sufficient to answer the question comprehensively.'),
	knowledge_gap: z.string().describe('Description of what information is missing or needs clarification.'),
	follow_up_queries: z.array(z.string()).describe('List of specific follow-up queries to address knowledge gaps.'),
	confidence_score: z.number().min(0).max(1).describe('Confidence score (0-1) in the current research completeness.'),
});

export const SearchEvaluationSchema = z.object({
	should_continue: z.boolean().describe('Whether more research is needed.'),
	next_action: z.enum(['search', 'finalize', 'clarify', 'suggest']).describe('Recommended next action.'),
	priority_areas: z.array(z.string()).describe('Priority areas that need more research.'),
	reasoning: z.string().describe('Reasoning for the recommendation.'),
});

// Schema for Intent Analysis
export const UserIntentSchema = z.object({
	primary_intent: z.enum([
		'information_seeking', 'decision_making', 'action_planning', 'problem_solving',
		'learning', 'investment_analysis', 'market_research', 'technical_understanding',
		'trend_analysis', 'comparison', 'risk_assessment', 'opportunity_identification'
	]).describe('Primary intent behind the user\'s query'),
	user_context: z.enum([
		'beginner', 'intermediate', 'advanced', 'professional', 'researcher', 'investor',
		'trader', 'developer', 'analyst', 'general_public'
	]).describe('Estimated user context/expertise level'),
	focus_areas: z.array(z.string()).describe('Key areas the user likely wants to focus on'),
	suggested_angles: z.array(z.string()).describe('Recommended research angles based on intent'),
});