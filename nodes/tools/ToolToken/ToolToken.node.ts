/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import {
	NodeConnectionType,
	type INodeType,
	type INodeProperties,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	IExecuteFunctions,
	ICredentialDataDecryptedObject,
} from 'n8n-workflow';

import { logWrapper } from '../../../utils/logWrapper';
import { getConnectionHintNoticeField } from '../../../utils/sharedFields';
import { DynamicTool } from '@langchain/core/tools';
import { OnchainToolName } from '../../../utils/toolName';
import { SupportChain } from '../../../utils/networks';
import { TokenPlugin } from '@binkai/token-plugin';
import { BirdeyeProvider } from '@binkai/birdeye-provider';
import { AlchemyProvider } from '@binkai/alchemy-provider';



export class ToolToken implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bink AI Token Search Tool',
		name: OnchainToolName.TOKEN_TOOL,
		icon: 'file:../../icons/token_bink_ai.svg',
		iconColor: 'black',
		group: ['transform'],
		version: 1,
		description: 'Make it easier for AI agents to perform arithmetic',
		defaults: {
			name: 'BinkAI Token',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Tools'],
				Tools: ['Other Tools'],
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
				displayName:
					'This tool helps you get blockchain token information. It will use AI to determine these parameters from your input:<br><br>' +
					'&nbsp;&nbsp; - <strong>query</strong> - Token address or symbol to search for (e.g., "BTC", "0x123...")<br>' +
					'&nbsp;&nbsp; - <strong>network</strong> - Blockchain network (bnb, solana, ethereum, arbitrum, base, optimism, polygon)<br>' +
					'&nbsp;&nbsp; - <strong>provider</strong> - Data provider to use (optional, will try all if not specified)<br>' +
					'&nbsp;&nbsp; - <strong>includePrice</strong> - Include price data in response (optional, default: true)<br><br>' +
					'Use this tool to retrieve token details, prices, and metadata across different blockchain networks.',
				name: 'notice_tip',
				type: 'notice',
				default: '',
			},
			// ...protocolsTypeProperties,
		],
		credentials: [
			{
				name: 'binkaiTokenCredentials',
				required: true,
			},
		],
	};

	private static tokenPlugin?: TokenPlugin;
	

	async getTokenPlugin(): Promise<any> {
		return ToolToken.tokenPlugin;
	}


	async supplyData(this: ISupplyDataFunctions): Promise<any> {
		this.logger.info('Supplying data for ToolToken for BinkAIs');
		
		const tokenCredentials = await this.getCredentials('binkaiTokenCredentials');
		const birdeyeApiKey = tokenCredentials.birdeyeApiKey as string;
		const alchemyApiKey = tokenCredentials.alchemyApiKey as string;


		const birdeyeProvider = new BirdeyeProvider({ apiKey: birdeyeApiKey });
		const alchemyProvider = new AlchemyProvider({ apiKey: alchemyApiKey });

		const tokenPlugin = new TokenPlugin();
		await tokenPlugin.initialize({
			defaultChain: SupportChain.BNB,
			providers: [birdeyeProvider, alchemyProvider],
			supportedChains: [SupportChain.SOLANA, SupportChain.BNB, SupportChain.ETHEREUM],
		});
    	ToolToken.tokenPlugin = tokenPlugin; // Use static property

		const tool = new DynamicTool({
			name: OnchainToolName.TOKEN_TOOL,
			description: 'Token tool for BinkAI',
			func: async (subject: string) => {
				return subject;
			},
		});
		
		return {
			response: logWrapper(tool, this),
		};
	}
}