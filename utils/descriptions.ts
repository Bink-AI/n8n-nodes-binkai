import type { DisplayCondition, INodeProperties, NodeParameterValue } from 'n8n-workflow';
import { SYSTEM_MESSAGE, HUMAN_MESSAGE, DEFAULT_STEP_EXECUTOR_HUMAN_CHAT_MESSAGE_TEMPLATE } from './prompt';

export const schemaTypeField: INodeProperties = {
	displayName: 'Schema Type',
	name: 'schemaType',
	type: 'options',
	noDataExpression: true,
	options: [
		{
			name: 'Generate From JSON Example',
			value: 'fromJson',
			description: 'Generate a schema from an example JSON object',
		},
		{
			name: 'Define Below',
			value: 'manual',
			description: 'Define the JSON schema manually',
		},
	],
	default: 'fromJson',
	description: 'How to specify the schema for the function',
};

export const buildJsonSchemaExampleField = (props?: {
	showExtraProps?: Record<string, Array<NodeParameterValue | DisplayCondition> | undefined>;
}): INodeProperties => ({
	displayName: 'JSON Example',
	name: 'jsonSchemaExample',
	type: 'json',
	default: `{
	"some_input": "some_value"
}`,
	noDataExpression: true,
	typeOptions: {
		rows: 10,
	},
	displayOptions: {
		show: {
			...props?.showExtraProps,
			schemaType: ['fromJson'],
		},
	},
	description: 'Example JSON object to use to generate the schema',
});

export const jsonSchemaExampleField = buildJsonSchemaExampleField();

export const buildInputSchemaField = (props?: {
	showExtraProps?: Record<string, Array<NodeParameterValue | DisplayCondition> | undefined>;
}): INodeProperties => ({
	displayName: 'Input Schema',
	name: 'inputSchema',
	type: 'json',
	default: `{
"type": "object",
"properties": {
	"some_input": {
		"type": "string",
		"description": "Some input to the function"
		}
	}
}`,
	noDataExpression: true,
	typeOptions: {
		rows: 10,
	},
	displayOptions: {
		show: {
			...props?.showExtraProps,
			schemaType: ['manual'],
		},
	},
	description: 'Schema to use for the function',
});

export const inputSchemaField = buildInputSchemaField();

export const promptTypeOptions: INodeProperties = {
	displayName: 'Source for Input (User Message)',
	name: 'promptType',
	type: 'options',
	options: [
		{
			name: 'Connected Chat Trigger Node',
			value: 'auto',
			description:
				"Looks for an input field called 'chatInput' that is coming from a directly connected Chat Trigger",
		},
		{
			name: 'Define below',
			value: 'define',
			description: 'Use an expression to reference data in previous nodes or enter static text',
		},
	],
	default: 'auto',
};

export const textInput: INodeProperties = {
	displayName: 'This is user\'s input',
	name: 'text',
	type: 'string',
	required: true,
	default: '={{ $json.chatInput }}',
	placeholder: 'e.g. Hello, how can you help me?',
	typeOptions: {
		rows: 2,
	},
};

// export const textFromPreviousNode: INodeProperties = {
// 	displayName: 'Prompt (User Message)',
// 	name: 'text',
// 	type: 'string',
// 	required: true,
// 	default: '={{ $json.chatInput }}',
// 	typeOptions: {
// 		rows: 2,
// 	},
// 	disabledOptions: { show: { promptType: ['auto'] } },
// };




export const planAndExecuteAgentProperties: INodeProperties[] = [
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				agent: ['planAndExecuteAgent'],
				'@version': [1],
			},
		},
		default: '={{ $json.input }}',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				agent: ['planAndExecuteAgent'],
				'@version': [1.1],
			},
		},
		default: '={{ $json.chat_input }}',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		required: true,
		displayOptions: {
			show: {
				agent: ['planAndExecuteAgent'],
				'@version': [1.2],
			},
		},
		default: '={{ $json.chatInput }}',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		displayOptions: {
			show: {
				agent: ['planAndExecuteAgent'],
			},
		},
		default: {},
		placeholder: 'Add Option',
		options: [
			{
				displayName: 'Human Message Template',
				name: 'humanMessageTemplate',
				type: 'string',
				default: DEFAULT_STEP_EXECUTOR_HUMAN_CHAT_MESSAGE_TEMPLATE,
				description: 'The message that will be sent to the agent during each step execution',
				typeOptions: {
					rows: 6,
				},
			},
		],
	},		
];