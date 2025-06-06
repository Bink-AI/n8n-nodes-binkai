import { ReflectionResult, SearchEvaluation, UserIntent } from './types';
export async function executeStep(stepId: string, title: string, stepFunction: () => Promise<string>, stepResults: any[]): Promise<string> {
    const timestamp = new Date().toISOString();
    
    try {
        console.log(`\n=== EXECUTING STEP: ${title} ===`);
        const content = await stepFunction();
        
        stepResults.push({
            step: stepId,
            title,
            content,
            timestamp
        });

        // Log step completion
        console.log(`✅ COMPLETED: ${title}`);
        console.log(`Content Preview: ${content.substring(0, 200)}...`);
        
        return content;
    } catch (error) {
        const errorContent = `❌ Error in ${title}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        
        stepResults.push({
            step: stepId,
            title,
            content: errorContent,
            timestamp
        });

        console.error(`❌ ERROR in ${title}:`, error);
        return errorContent;
    }
}


export function formatAllSteps(originalQuery: string, stepResults: any[]): string {
    const header = `# 🔬 Advanced Research Analysis\n**Query:** ${originalQuery}\n**Started:** ${stepResults[0]?.timestamp}\n**Total Steps:** ${stepResults.length}\n\n`;
    
    const stepsContent = stepResults.map((step, index) => {
        return `## Step ${index + 1}: ${step.title}\n**Timestamp:** ${step.timestamp}\n**Step ID:** ${step.step}\n\n${step.content}\n\n---\n`;
    }).join('\n');

    const summary = `\n## 📋 Research Summary\n**Total Steps Executed:** ${stepResults.length}\n**Final Status:** ${stepResults[stepResults.length - 1]?.title}\n\n`;

    return header + stepsContent + summary;
}

export function formatReflection(reflection: ReflectionResult): string {
    return `**Research Sufficiency:** ${reflection.is_sufficient ? '✅ Sufficient' : '❌ Needs more research'}
**Confidence Score:** ${Math.round(reflection.confidence_score * 100)}%
**Knowledge Gap:** ${reflection.knowledge_gap}
**Follow-up Queries:** ${reflection.follow_up_queries.length > 0 ? reflection.follow_up_queries.join(', ') : 'None'}

`;
}

export function formatEvaluation(evaluation: SearchEvaluation): string {
    return `**Should Continue:** ${evaluation.should_continue ? '✅ Yes' : '❌ No'}
**Next Action:** ${evaluation.next_action.toUpperCase()}
**Priority Areas:** ${evaluation.priority_areas.join(', ') || 'None'}
**Reasoning:** ${evaluation.reasoning}

`;
}

export function formatUserIntent(intent: UserIntent): string {
    return `**Primary Intent:** ${intent.primary_intent.replace('_', ' ').toUpperCase()}
**User Context:** ${intent.user_context.replace('_', ' ').toUpperCase()}
**Focus Areas:** ${intent.focus_areas.join(', ')}
**Suggested Research Angles:** ${intent.suggested_angles.join(', ')}
`;
}