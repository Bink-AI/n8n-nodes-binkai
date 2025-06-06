import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	INodeInputConfiguration,
	INodeInputFilter,
	INodeProperties,
	NodeOperationError,
	jsonParse,
	NodeConnectionType,
} from 'n8n-workflow';
import { promptTypeOptions, textInput } from '../../utils/descriptions';
import {
	getOptionalOutputParser,
	N8nOutputParser,
} from '../../utils/output_parsers/N8nOutputParser';
import { getPromptInputByType } from '../../utils/helpers';
import { getChatModel, getOptionalMemory, getTools } from '../../utils/common';
import type { BaseChatMemory } from '@langchain/community/memory/chat_memory';
import { Wallet, Network } from '@binkai/core';
import { N8nLLM } from '../N8NBase/N8nLLM';
import { omit } from 'lodash';
import { N8nBinkAgent } from '../N8NBase/N8nBinkAgent';
import { DynamicStructuredTool, Tool } from '@langchain/core/tools';
// import { TransferPlugin } from '@binkai/transfer-plugin';
import { SYSTEM_MESSAGE } from '../../utils/prompt';
import { planAndExecuteAgentProperties } from '../../utils/descriptions';
import { getNetworksConfig } from '../../utils/networks';

function getInputs(
	agent:
		| 'toolsAgent'
		| 'conversationalAgent'
		| 'openAiFunctionsAgent'
		| 'planAndExecuteAgent'
		| 'reActAgent',
	hasOutputParser?: boolean,
): Array<NodeConnectionType | INodeInputConfiguration> {
	interface SpecialInput {
		type: NodeConnectionType;
		filter?: INodeInputFilter;
		required?: boolean;
	}

	const getInputData = (
		inputs: SpecialInput[],
	): Array<NodeConnectionType | INodeInputConfiguration> => {
		const displayNames: { [key: string]: string } = {
			ai_languageModel: 'Model',
			ai_memory: 'Memory',
			ai_tool: 'Tool',
			ai_outputParser: 'Output Parser',
		};

		return inputs.map(({ type, filter }) => {
			const isModelType = type === ('ai_languageModel' as NodeConnectionType);
			let displayName = type in displayNames ? displayNames[type] : undefined;
			if (
				isModelType &&
				['openAiFunctionsAgent', 'toolsAgent', 'conversationalAgent'].includes(agent)
			) {
				displayName = 'Chat Model';
			}
			const input: INodeInputConfiguration = {
				type,
				displayName,
				required: isModelType,
				maxConnections: ['ai_languageModel', 'ai_memory', 'ai_outputParser'].includes(
					type as NodeConnectionType,
				)
					? 1
					: undefined,
			};

			if (filter) {
				input.filter = filter;
			}

			return input;
		});
	};

	let specialInputs: SpecialInput[] = [];

	if (agent === 'toolsAgent') {
		specialInputs = [
			{
				type: 'ai_languageModel' as NodeConnectionType,
				filter: {
					nodes: [
						'@n8n/n8n-nodes-langchain.lmChatAnthropic',
						'@n8n/n8n-nodes-langchain.lmChatAzureOpenAi',
						'@n8n/n8n-nodes-langchain.lmChatAwsBedrock',
						'@n8n/n8n-nodes-langchain.lmChatMistralCloud',
						'@n8n/n8n-nodes-langchain.lmChatOllama',
						'@n8n/n8n-nodes-langchain.lmChatOpenAi',
						'@n8n/n8n-nodes-langchain.lmChatGroq',
						'@n8n/n8n-nodes-langchain.lmChatGoogleVertex',
						'@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
						'@n8n/n8n-nodes-langchain.lmChatDeepSeek',
						'@n8n/n8n-nodes-langchain.lmChatOpenRouter',
						'@n8n/n8n-nodes-langchain.lmChatXAiGrok',
					],
				},
			},
			{
				type: 'ai_memory' as NodeConnectionType,
			},
			{
				type: 'ai_tool' as NodeConnectionType,
				required: true,
			},
			{
				type: 'ai_outputParser' as NodeConnectionType,
			},
		];
	}

	if (hasOutputParser === false) {
		specialInputs = specialInputs.filter((input) => input.type !== 'ai_outputParser');
	}
	return ['main', ...getInputData(specialInputs)] as Array<
		NodeConnectionType | INodeInputConfiguration
	>;
}

const agentTypeProperty: INodeProperties = {
	displayName: 'Agent',
	name: 'agent',
	type: 'options',
	noDataExpression: true,
	// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
	options: [
		{
			name: 'Tools Agent',
			value: 'toolsAgent',
			description:
				'Utilizes structured tool schemas for precise and reliable tool selection and execution. Recommended for complex tasks requiring accurate and consistent tool usage, but only usable with models that support tool calling.',
		},
		{
			name: 'Plan and Execute Agent',
			value: 'planAndExecuteAgent',
			description:
				'Utilizes a plan and execute approach to solve complex tasks. Recommended for tasks that require a structured approach to problem solving.',
		},
	],
	default: 'toolsAgent',
};


export const toolsAgentProperties: INodeProperties[] = [
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		displayOptions: {
			show: {
				agent: ['toolsAgent'],
			},
		},
		default: {},
		placeholder: 'Add Option',
		options: [
			{
				displayName: 'System Message',
				name: 'systemMessage',
				type: 'string',
				default: SYSTEM_MESSAGE,
				description: 'The message that will be sent to the agent before the conversation starts',
				typeOptions: {
					rows: 6,
				},
			},
			{
				displayName: 'Max Iterations',
				name: 'maxIterations',
				type: 'number',
				default: 10,
				description: 'The maximum number of iterations the agent will run before stopping',
			},
			{
				displayName: 'Return Intermediate Steps',
				name: 'returnIntermediateSteps',
				type: 'boolean',
				default: false,
				description: 'Whether or not the output should include intermediate steps the agent took',
			},
			{
				displayName: 'Automatically Passthrough Binary Images',
				name: 'passthroughBinaryImages',
				type: 'boolean',
				default: true,
				description:
					'Whether or not binary images should be automatically passed through to the agent as image type messages',
			},
		],
	},
];

export class BinkAgentNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bink AI Agent',
		name: 'binkAgentNode',
		group: ['transform'],
		version: 1,
		icon: 'fa:robot',
		iconColor: 'black',
		description: 'Initialize Bink AI Agent with plugins',
		defaults: {
			name: 'Bink AI Agent',
		},
		inputs: `={{
			((agent, hasOutputParser) => {
				${getInputs.toString()};
				return getInputs(agent, hasOutputParser)
			})($parameter.agent, $parameter.hasOutputParser === undefined || $parameter.hasOutputParser === true)
		}}`,
		outputs: ['main' as NodeConnectionType] as any,
		properties: [
			{
				displayName:
					'Tip: Get a feel for agents with our quick <a href="https://docs.n8n.io/advanced-ai/intro-tutorial/" target="_blank">tutorial</a> or see an <a href="/templates/1954" target="_blank">example</a> of how this node works',
				name: 'notice_tip',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						agent: ['toolsAgent'],
					},
				},
			},

			{
				displayName: 'Require Specific Output Format',
				name: 'hasOutputParser',
				type: 'boolean',
				default: false,
				noDataExpression: true,
			},
			{
				displayName: `Connect an <a data-action='openSelectiveNodeCreator' data-action-parameter-connectiontype='${NodeConnectionType.AiOutputParser}'>output parser</a> on the canvas to specify the output format you require`,
				name: 'notice',
				type: 'notice',
				default: '',
				displayOptions: {
					show: {
						hasOutputParser: [true],
						agent: ['toolsAgent'],
					},
				},
			},
			
			...[promptTypeOptions],
			// ...[textFromPreviousNode],
			...[textInput],
			...[agentTypeProperty],
			...toolsAgentProperties,
			...planAndExecuteAgentProperties,
		],
		credentials: [
			{
				name: 'binkaiCredentialsApi',
				required: true,
			},
			
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const typeAgent = this.getNodeParameter('agent', 0) as string;
		const returnData: INodeExecutionData[] = [];
		const items = this.getInputData();
		const outputParser = (await getOptionalOutputParser(this)) as N8nOutputParser;
		const toolsWithPlugins = (await getTools(this)) as Array<{ tool: DynamicStructuredTool | Tool, plugin?: any }>;
		// Get credentials
		const baseCredentials = await this.getCredentials('binkaiCredentialsApi');

		// Get RPC URLs from credentials
		const RPC_URLS = {
			BNB: baseCredentials.bnbRpcUrl as string,
			ETH: baseCredentials.ethRpcUrl as string,
			SOL: baseCredentials.solRpcUrl as string,
		};
	
		let tools: any[] = [];
		let plugins: any[] = [];
		for (const tool of toolsWithPlugins) {
			tools.push(tool.tool);
			plugins.push(tool.plugin);
		}
		plugins = plugins.filter(plugin => plugin !== undefined);
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const llm = new N8nLLM(await getChatModel(this));
				const memory = (await getOptionalMemory(this)) as BaseChatMemory;

				const n8nOptions = this.getNodeParameter('options', itemIndex, {}) as {
					systemMessage?: string;
					maxIterations?: number;
					returnIntermediateSteps?: boolean;
					passthroughBinaryImages?: boolean;
				};

				const networks = getNetworksConfig(RPC_URLS);
				const network = new Network({ networks });
				const wallet = new Wallet(
					{
						seedPhrase:
							(baseCredentials.mnemonic as string) ||
							'test test test test test test test test test test test test',
						index: 0,
					},
					network,
				);

				const binkAgent = new N8nBinkAgent(
					llm,
					typeAgent,
					memory,
					tools,
					outputParser,
					{
						temperature: 0.5,
						systemPrompt: SYSTEM_MESSAGE,
					},
					wallet,
					networks,
					n8nOptions,
				);

				// Register all initialized plugins
				for (const plugin of plugins) {
					await binkAgent.registerPlugin(plugin);
				}

				const input = getPromptInputByType({
					ctx: this,
					i: itemIndex,
					inputKey: 'text',
					promptTypeKey: 'promptType',
				});

				if (input === undefined) {
					throw new NodeOperationError(this.getNode(), 'The "text" parameter is empty.');
				}

				let response;
				if (memory) {
					const chatHistory = await memory.loadMemoryVariables({});
					response = await binkAgent.execute(input, chatHistory);
				} else {
					response = await binkAgent.execute(input);
				}
				
			
				if (outputParser) {
					const parsedOutput = jsonParse<{ output: Record<string, unknown> }>(
						response.output as string,
					);
					response.output = parsedOutput?.output ?? parsedOutput;
				}

				const itemResult = {
					json: omit(
						response,
						'system_message',
						'formatting_instructions',
						'input',
						'chat_history',
						'agent_scratchpad',
					),
				};

				returnData.push(itemResult);
			} catch (error) {
				console.log('Error processing item:', error);
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error.message || 'An error occurred' },
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}