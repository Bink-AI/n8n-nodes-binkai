/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	NodeConnectionType,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	type INodeProperties,
} from 'n8n-workflow';

import { logWrapper } from '../../../utils/logWrapper';
import { getConnectionHintNoticeField } from '../../../utils/sharedFields';
import { DynamicTool } from '@langchain/core/tools';
import { ToolName } from '../../../utils/toolName';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';


interface SearchResult {
	query: string;
	content: string;
}


const systemMessage = `You are an AI assistant conducting web searches using Google Search.

INSTRUCTIONS:
- Search for comprehensive, current, and authoritative information
- Focus on recent developments and current information
- Include key facts, statistics, and expert opinions
- Provide comprehensive coverage of different aspects

OUTPUT FORMAT:
- Return search results in a well-structured format
- You can summarize or keep original content based on user needs
- Include source information when available

Current date will be provided automatically.`;



export class ToolSearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bink AI Search Tool',
		name: ToolName.SEARCH_TOOL,
		icon: 'file:../../icons/search_bink_ai.svg',
		iconColor: 'black',
		group: ['transform'],
		version: 1,
		description: 'AI-powered cascading web search tool with reflection',
		defaults: {
			name: 'BinkAI Search',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
				Tools: ['Search Tools'],
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
				displayName: 'System message',
				name: 'systemMessage',
				type: 'string',
				default: systemMessage,
				description: 'System message for the search tool. You can use this to provide additional context or instructions for the search tool.',
			},
			{
				displayName: 'Search Query',
				name: 'text',
				type: 'string',
				required: true,
				default: '{{ $json.chatInput }}',
			},
			{
				displayName: 'Gemini Model',
				name: 'geminiModel',
				type: 'options',
				required: true,
				default: 'gemini-2.0-flash-exp',
				options: [
					{
						name: 'gemini-2.0-flash-exp',
						value: 'gemini-2.0-flash-exp',
					},
					{
						name: 'gemini-2.0-lite',
						value: 'gemini-2.0-lite',
					},
					{
						name: 'gemini-1.5-pro',
						value: 'gemini-1.5-pro',
					},
					{
						name: 'gemini-1.5-flash',
						value: 'gemini-1.5-flash',
					},

				],
			},
			{
				displayName: 'Search Temperature',
				name: 'searchTemperature',
				type: 'number',
				description: 'Temperature for search queries (0.0 = focused, 1.0 = creative)',
				default: 0.0,
				typeOptions: {
					minValue: 0,
					maxValue: 1,
					numberStepSize: 0.1,
				},
			},
			{
				displayName: 'Max Search Retries',
				name: 'maxSearchRetries',
				type: 'number',
				description: 'The maximum number of retries that can be made for a single call, with an exponential backoff between each attempt. Defaults to 2.',
				default: 2,
				typeOptions: { minValue: 1, maxValue: 5 },
			},
			{
				displayName:
					'This tool performs web search using Gemini Model with Google Search integration:<br><br>' +
					'<strong>All with only Gemini API</strong> ' +
					'&nbsp;&nbsp; 🔍 <strong>Web Search</strong> - Conducts real-time web search using Google Search<br>' +
					'&nbsp;&nbsp; 🤖 <strong>AI Processing</strong> - Uses Gemini model to process and format results<br><br>' +
					'<strong>System Message Usage:</strong><br>' +
					'The system message controls how the AI processes and presents the search results.' + 
					'<br><br><strong>Search Temperature:</strong> <br>' +
					'The search temperature controls the randomness of the search results. ' +
					'A higher temperature will result in more creative search results, while a lower temperature will result in more focused search results.',
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
		this.logger.info('Supplying data for ToolSearch for BinkAI');

		const binkaiSearchCredentials = await this.getCredentials('binkaiSearchCredentials');
		const geminiApiKey = binkaiSearchCredentials.geminiApiKey as string;
		const mainQuery = this.getNodeParameter('text', 0, '') as string;
		const systemMessage = this.getNodeParameter('systemMessage', 0, '') as string;
		const searchTemperature = this.getNodeParameter('searchTemperature', 0, 0.0) as number;
		const maxSearchRetries = this.getNodeParameter('maxSearchRetries', 0, 2) as number;
		const geminiModel = this.getNodeParameter('geminiModel', 0, 'gemini-2.0-flash-exp') as string;

		const tool = new DynamicTool({
			name: ToolName.SEARCH_TOOL,
			description: 'Comprehensive cascading web search tool that performs multiple research iterations with reflection analysis to provide thorough, well-researched answers.',
			func: async (query: string) => {
				try {
					if (!query || query.trim() === '') {
						return 'Please provide a search query';
					}

					const searchTool = new WebSearch(
						geminiApiKey,
						searchTemperature,
						geminiModel,
						mainQuery,
						systemMessage,
						maxSearchRetries,
					);
					
					return await searchTool.performWebSearch(systemMessage, mainQuery);
				} catch (error) {
					this.logger.error('Error in cascading search:', error);
					return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
				}
			},
		});

		return {
			response: logWrapper(tool, this),
		};
	}
}

class WebSearch {
	private geminiApiKey: string;
	private searchTemperature: number;
	private geminiModel: string;
	private mainQuery: string;
	private systemMessage: string;
	private maxSearchRetries: number;
	constructor(
		geminiApiKey: string,
		searchTemperature: number,
		geminiModel: string,
		mainQuery: string,
		systemMessage: string,
		maxSearchRetries: number,
	) {
		this.geminiApiKey = geminiApiKey;
		this.geminiModel = geminiModel;
		this.searchTemperature = searchTemperature;
		this.mainQuery = mainQuery;
		this.systemMessage = systemMessage;
		this.maxSearchRetries = maxSearchRetries;
	}

	private getCurrentDate(): string {
		return new Date().toISOString().split('T')[0];
	}


	async performWebSearch(systemMessage: string, query: string): Promise<SearchResult> {
		const searchPrompt = `Current date: ${this.getCurrentDate()}\n\n${systemMessage}\n\nUser query: ${query}`;
		try {
				// Fallback to ChatGoogleGenerativeAI
				const model = new ChatGoogleGenerativeAI({
					model: this.geminiModel,
					temperature: this.searchTemperature,
					maxRetries: this.maxSearchRetries,
					apiKey: this.geminiApiKey,
				});

				const modelWithSearch = model.bind({
					tools: [{ google_search: {} }],
				});

				const result = await modelWithSearch.invoke(searchPrompt);
				
				// Extract all text content from the result
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
				return {
					query,
					content: searchContent,
				};

		} catch (error) {
			console.error('Web search error:', error);
			throw error;
		}
	}

}
