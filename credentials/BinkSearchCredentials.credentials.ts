import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

const searchProviderProperties = [
	{
		displayName: 'Gemini API Key',
		name: 'geminiApiKey',
		type: 'string',
		typeOptions: {
			password: true,
		},
		default: '',
	},
] as INodeProperties[];

export class BinkSearchCredentials implements ICredentialType {
	name = 'binkaiSearchCredentials';
	displayName = 'Bink AI Search Gemini Credentials';
	properties: INodeProperties[] = [
		...searchProviderProperties,
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				gemini_api_key: '={{$credentials.geminiApiKey}}',
			},
		},
	};
}
