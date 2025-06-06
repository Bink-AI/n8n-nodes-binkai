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
import { OnchainToolName } from '../../../utils/toolName';
import { deBridgeProvider } from '@binkai/debridge-provider';
import { BridgePlugin } from '@binkai/bridge-plugin';
import { SupportChain } from '../../../utils/networks';
import { Connection } from '@solana/web3.js';
import { ethers } from 'ethers';
const bscBridgeProvider: INodeProperties[] = [
	{
		displayName: 'BSC Bridge Provider',
		name: 'bscBridgeProvider',
		type: 'multiOptions',
		description: 'The provider to use for the BSC bridge. You can select multiple providers. Will be updated soon for more providers.',
		required: true,
		options: [
			{
				displayName: 'BSC Provider',
				name: 'bscProvider',
				value: 'bscProvider',
			},
		],
		default: 'bscProvider',
	},
];

const solanaBridgeProvider: INodeProperties[] = [
	{
		displayName: 'Solana Bridge Provider',
		name: 'solanaBridgeProvider',
		type: 'multiOptions',
		description: 'The provider to use for the Solana bridge. You can select multiple providers. Will be updated soon for more providers.',
		required: true,
		options: [
			{
				displayName: 'Solana Provider',
				name: 'solanaProvider',
				value: 'solanaProvider',
			},
		],
		default: 'solanaProvider',
	},
];

export class ToolBridge implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bink AI Bridge Tool',
		name: OnchainToolName.BRIDGE_TOOL,
		icon: 'file:../../icons/bridge_bink_ai.svg',
		iconColor: 'black',
		group: ['transform'],
		version: 1,
		description: 'Make it easier for AI agents to perform arithmetic',
		defaults: {
			name: 'BinkAI Bridge',
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
			...bscBridgeProvider,
			...solanaBridgeProvider,
			{
				displayName:
					'This tool helps you bridge tokens between blockchain networks. It will use AI to determine these parameters from your input:<br><br>' +
					'&nbsp;&nbsp; - <strong>fromNetwork</strong> - Source blockchain network to bridge from<br>' +
					'&nbsp;&nbsp; - <strong>toNetwork</strong> - Destination blockchain network to bridge to<br>' +
					'&nbsp;&nbsp; - <strong>fromToken</strong> - Address of token to send<br>' +
					'&nbsp;&nbsp; - <strong>toToken</strong> - Address of token to receive<br>' +
					'&nbsp;&nbsp; - <strong>amount</strong> - Amount of tokens to bridge<br>' +
					'&nbsp;&nbsp; - <strong>amountType</strong> - Whether amount is input (send) or output (receive)<br>' +
					'&nbsp;&nbsp; - <strong>provider</strong> - Bridge protocol provider (optional, will find best rate if not specified)<br><br>' +
					'Use this tool to transfer tokens across different blockchain networks using bridge protocols.',
				name: 'notice_tip',
				type: 'notice',
				default: '',
			},
		],
		credentials: [
			{
				name: 'binkaiCredentialsApi',
				required: true,
			},
		],
	};

	private static bridgePlugin?: BridgePlugin;

	async getBridgePlugin(): Promise<BridgePlugin | undefined> {
		return ToolBridge.bridgePlugin;
	}

	async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
		this.logger.info('Supplying data for ToolBridge for BinkAIs');

		const baseCredentials = await this.getCredentials('binkaiCredentialsApi');
		const RPC_URLS = {
			BNB: baseCredentials.bnbRpcUrl as string,
			ETH: baseCredentials.ethRpcUrl as string,
			SOL: baseCredentials.solRpcUrl as string,
		};

		const bscBridgeProvider = this.getNodeParameter('bscBridgeProvider', 0) as string[];
		const solanaBridgeProvider = this.getNodeParameter('solanaBridgeProvider', 0) as string[];

		let bscProvider;
		let solanaProvider;

		if (bscBridgeProvider?.length) {
			bscProvider = new ethers.JsonRpcProvider(RPC_URLS.BNB);
		}

		if (solanaBridgeProvider?.length) {
			solanaProvider = new Connection(RPC_URLS.SOL);
		}

		const debridge = new deBridgeProvider([bscProvider, solanaProvider], 56, 7565164);
		const bridgePlugin = new BridgePlugin();
		await bridgePlugin.initialize({
			supportedChains: [SupportChain.BNB, SupportChain.ETHEREUM, SupportChain.SOLANA],
			providers: [debridge],
		});

		ToolBridge.bridgePlugin = bridgePlugin;

		const tool = new DynamicTool({
			name: OnchainToolName.BRIDGE_TOOL,
			description: 'Bridge tool for BinkAI',
			func: async (subject: string) => {
				return subject;
			},
		});

		
		return {
			response: logWrapper(tool, this),
		};
	}
}
