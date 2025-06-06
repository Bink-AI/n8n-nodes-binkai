import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

const apiProviderProperties = [
	{
		displayName: 'Solana RPC URL',
		name: 'solRpcUrl',
		type: 'string',
		default: 'https://api.mainnet-beta.solana.com',
	},
	{
		displayName: 'Ethereum RPC URL',
		name: 'ethRpcUrl',
		type: 'string',
		default: 'wss://ethereum-rpc.publicnode.com',
	},
	{
		displayName: 'BNB Chain RPC URL',
		name: 'bnbRpcUrl',
		type: 'string',
		default: 'https://bsc-dataseed1.binance.org',
	},
] as INodeProperties[];

export class BinkAICredentialsApi implements ICredentialType {
	name = 'binkaiCredentialsApi';
	displayName = 'Bink AI Credentials API';
	properties: INodeProperties[] = [
		...apiProviderProperties,
		{
			displayName: 'Wallet Mnemonic',
			name: 'mnemonic',
			type: 'string',
			description: 'The mnemonic of the wallet to use for the agent',
			required: true,
			typeOptions: {
				password: true,
			},
			default: '',
		}
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				sol_rpc_url: '={{$credentials.solRpcUrl}}',
				eth_rpc_url: '={{$credentials.ethRpcUrl}}',
				bnb_rpc_url: '={{$credentials.bnbRpcUrl}}',
				mnemonic: '={{$credentials.mnemonic}}',
			},
		},
	};

}

