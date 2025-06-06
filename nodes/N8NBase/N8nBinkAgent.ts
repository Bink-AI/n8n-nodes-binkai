import {
	AgentConfig,
	BaseAgent,
	IModel,
	IWallet,
	NetworksConfig,
	AgentExecuteParams,
	DatabaseAdapter,
	IPlugin,
} from '@binkai/core';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { createOpenAIToolsAgent } from 'langchain/agents';
import { AgentExecutor } from 'langchain/agents';
import { MessagesPlaceholder } from '@langchain/core/prompts';
import { fixEmptyContentMessage, getAgentStepsParser } from '../../utils/common';
import { RunnableSequence } from '@langchain/core/runnables';
import { BaseChatMemory } from '@langchain/community/memory/chat_memory';
import { N8nOutputParser } from '../../utils/output_parsers/N8nOutputParser';
import { getAgentTracingConfig } from '../../utils/tracing';
import { PlanAndExecuteAgentExecutor } from 'langchain/experimental/plan_and_execute';
import { AgentType, OnchainToolName } from '../../utils/toolName';

export class N8nBinkAgent extends BaseAgent {
	private model: IModel;
	public typeAgent: string;
	private wallet: IWallet;
	private networks: NetworksConfig['networks'];
	private config: AgentConfig;
	private memory: BaseChatMemory;
	private outputParser: N8nOutputParser | undefined;
	private n8nOptions: any;
	constructor(
		model: IModel,
		typeAgent: string,
		memory: BaseChatMemory,
		tools: any[],
		outputParser: N8nOutputParser | undefined,
		config: AgentConfig,
		wallet: IWallet,
		networks: NetworksConfig['networks'],
		n8nOptions: any,
	) {
		super();
		this.model = model;
		this.typeAgent = typeAgent;
		this.memory = memory;
		this.outputParser = outputParser;
		this.tools = tools;
		this.config = config;
		this.wallet = wallet;
		this.networks = networks;
		this.n8nOptions = n8nOptions;
	}

	protected async onToolsUpdated(): Promise<void> {}

	public isMockResponseTool(): boolean {
		return false;
	}

	async registerPlugin(plugin: IPlugin): Promise<void> {
		const pluginName = plugin.getName();
		this.plugins.set(pluginName, plugin);

		// Register all tools from the plugin
		const tools = plugin.getTools();
		for (const tool of tools) {
			await this.registerTool(tool);
		}
	}

	protected async createToolsAgentExecutor(): Promise<AgentExecutor> {
		const defaultSystemPrompt = `You are a helpful assistant that can help with tasks related to the BinkAI platform.`;

		const filteredTools = this.tools.filter(
			(tool) =>
				tool.name !== OnchainToolName.SWAP_TOOL &&
				tool.name !== OnchainToolName.BRIDGE_TOOL &&
				tool.name !== OnchainToolName.TOKEN_TOOL &&
				tool.name !== OnchainToolName.WALLET_TOOL,
		);

		if (this.memory && this.memory.chatHistory) {
			const messages = await this.memory.chatHistory.getMessages();
			const validMessages = messages.filter(
				(msg: any) => msg.content && msg.content.trim() !== ''
			);
			if (validMessages.length !== messages.length) {
				await this.memory.chatHistory.clear();
				await this.memory.chatHistory.addMessages(validMessages);
			}
		}

		const agent = await createOpenAIToolsAgent({
			llm: this.getModel().getLangChainLLM(),
			tools: filteredTools,
			prompt: ChatPromptTemplate.fromMessages([
				['system', `${this.config.systemPrompt ?? defaultSystemPrompt}`],
				new MessagesPlaceholder('chat_history'),
				['human', '{input}'],
				new MessagesPlaceholder('agent_scratchpad'),
			]),
		});

		const runnableAgent = RunnableSequence.from([
			agent,
			getAgentStepsParser(this.outputParser, this.memory),
			fixEmptyContentMessage,
		]);

		return AgentExecutor.fromAgentAndTools({
			agent: runnableAgent,
			memory: this.memory,
			tools: filteredTools,
			returnIntermediateSteps: this.n8nOptions.returnIntermediateSteps === true,
			maxIterations: this.n8nOptions.maxIterations,
		});
	}

	protected async createPlanningAgentExecutor(): Promise<any> {
		const filteredTools = this.tools.filter(
			(tool) =>
				tool.name !== OnchainToolName.SWAP_TOOL &&
				tool.name !== OnchainToolName.BRIDGE_TOOL &&
				tool.name !== OnchainToolName.TOKEN_TOOL &&
				tool.name !== OnchainToolName.WALLET_TOOL,
		);

		const agentExecutor = await PlanAndExecuteAgentExecutor.fromLLMAndTools({
			llm: this.getModel().getLangChainLLM(),
			tools: filteredTools,
			humanMessageTemplate: this.n8nOptions.humanMessageTemplate,
		});
		return agentExecutor;
	}

	public getWallet(): IWallet {
		return this.wallet;
	}

	public getModel(): IModel {
		return this.model;
	}

	public async execute(
		command: string | AgentExecuteParams,
		chat_history?: any,
	): Promise<any> {
		let executor;
		let response;
		if (this.typeAgent === AgentType.PLANNING_AGENT) {
			executor = await this.createPlanningAgentExecutor();
			response = await executor
				.withConfig(getAgentTracingConfig(this))
				.invoke({ input: command, chat_history: chat_history });
		} else {
			executor = await this.createToolsAgentExecutor();
			response = await executor.invoke({ input: command, chat_history: chat_history });
		}
		return response;
	}

	public getNetworks(): NetworksConfig['networks'] {
		return this.networks;
	}

	public async registerDatabase<T>(db: DatabaseAdapter<T>): Promise<void> {
		// Implementation for registering database
	}
}
