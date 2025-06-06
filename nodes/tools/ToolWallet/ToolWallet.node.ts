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
import { OnchainToolName } from '../../../utils/toolName';
import { WalletPlugin } from '@binkai/wallet-plugin';
import { SupportChain } from '../../../utils/networks';
import { AlchemyProvider } from '@binkai/alchemy-provider';
import { BirdeyeProvider } from '@binkai/birdeye-provider';

export class ToolWallet implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bink AI Wallet Management Tool',
		name: OnchainToolName.WALLET_TOOL,
		icon: 'file:../../icons/wallet_bink_ai.svg',
		iconColor: 'black',
		group: ['transform'],
		version: 1,
		description: 'Make it easier for AI agents to perform arithmetic',
		defaults: {
			name: 'BinkAI Wallet',
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
					'This tool helps you get wallet information and balances on blockchain networks. It will use AI to determine these parameters from your input:<br><br>' +
					'&nbsp;&nbsp; - <strong>address</strong> - Wallet address to query (optional, uses agent wallet if not provided)<br>' +
					'&nbsp;&nbsp; - <strong>network</strong> - Blockchain network to check (bnb, solana, ethereum) (optional)<br><br>' +
					'Use this tool to retrieve wallet balances, transaction history, and account information across different blockchain networks.',
				name: 'notice_tip',
				type: 'notice',
				default: '',
			},
		],
		credentials: [
			{
				name: 'binkaiTokenCredentials',
				required: true,
			},
		]
	};

	private static walletPlugin?: WalletPlugin;

	async getWalletPlugin(): Promise<any> {
		return ToolWallet.walletPlugin;
	}

	async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
		this.logger.info('Supplying data for ToolWallet for BinkAIs');

		const tokenCredentials = await this.getCredentials('binkaiTokenCredentials');
		const birdeyeApiKey = tokenCredentials.birdeyeApiKey as string;
		const alchemyApiKey = tokenCredentials.alchemyApiKey as string;


		const birdeyeProvider = new BirdeyeProvider({ apiKey: birdeyeApiKey });
		const alchemyProvider = new AlchemyProvider({ apiKey: alchemyApiKey });

		const walletPlugin = new WalletPlugin();
		await walletPlugin.initialize({
			defaultChain: SupportChain.BNB,
			providers: [birdeyeProvider, alchemyProvider],
			supportedChains: [SupportChain.BNB, SupportChain.SOLANA, SupportChain.ETHEREUM],
		});
		ToolWallet.walletPlugin = walletPlugin;
		const tool = new DynamicTool({
			name: OnchainToolName.WALLET_TOOL,
			description: 'Wallet tool for BinkAI',
			func: async (subject: string) => {
				return subject;
			},
		});

		return {
			response: logWrapper(tool, this),
		};
	}
}