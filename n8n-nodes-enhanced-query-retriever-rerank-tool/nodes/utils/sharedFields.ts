import { INodeProperties, NodeConnectionType } from 'n8n-workflow';

export function getConnectionHintNoticeField(
	connectionTypes: NodeConnectionType[],
): INodeProperties {
	const connectors = connectionTypes
		.map((type) => {
			if (type === NodeConnectionType.AiTool) return 'AI Tool';
			if (type === NodeConnectionType.AiVectorStore) return 'Vector Store';
			if (type === NodeConnectionType.AiLanguageModel) return 'Language Model';
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