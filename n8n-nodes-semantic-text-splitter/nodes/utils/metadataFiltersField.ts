import { INodeProperties } from 'n8n-workflow';

export const metadataFilterField: INodeProperties = {
	displayName: 'Metadata Filter',
	name: 'metadataFilter',
	type: 'string',
	default: '',
	placeholder: 'e.g. metadata.source = "web"',
	description: 'Filter documents based on metadata properties',
}; 