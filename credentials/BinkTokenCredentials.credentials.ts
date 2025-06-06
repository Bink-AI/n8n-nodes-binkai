import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

const tokenProviderProperties = [
	{
		displayName: 'Alchemy API Key',
		name: 'alchemyApiKey',
		type: 'string',
		typeOptions: {
			password: true,
		},
		default: '',
	},
	{
		displayName: 'Birdeye API Key',
		name: 'birdeyeApiKey',
		type: 'string',
		typeOptions: {
			password: true,
		},
		default: '',
	},
] as INodeProperties[];

export class BinkTokenCredentials implements ICredentialType {
	name = 'binkaiTokenCredentials';
	displayName = 'Bink AI Token Credentials';
	properties: INodeProperties[] = [
		...tokenProviderProperties,
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				alchemy_api_key: '={{$credentials.alchemyApiKey}}',
				birdeye_api_key: '={{$credentials.birdeyeApiKey}}',
			},
		},
	};
}
