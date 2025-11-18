import { INodeProperties, nodeConnectionTypes } from 'n8n-workflow';

export function getConnectionHintNoticeField(
	connectionTypes: string[],
): INodeProperties {
	const connectors = connectionTypes
		.map((type) => {
			if (type === 'ai_tool') return 'AI Tool';
			if (type === 'ai_agent') return 'AI Agent';
			if (type === 'ai_vectorStore') return 'Vector Store';
			if (type === 'ai_languageModel') return 'Language Model';
			return type;
		})
		.join(' or ');

	return {
		displayName: `Use this node to connect to ${connectors} nodes`,
		name: 'notice',
		type: 'notice',
		default: '',
	};
}

