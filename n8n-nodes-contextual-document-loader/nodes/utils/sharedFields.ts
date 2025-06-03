import { INodeProperties, NodeConnectionType } from 'n8n-workflow';

export function getConnectionHintNoticeField(
	connectionTypes: NodeConnectionType[],
): INodeProperties {
	return {
		displayName: '',
		name: 'notice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				'@version': [{ _cnd: { gte: 1.1 } }],
			},
		},
		typeOptions: {
			message: `This node can be connected to ${connectionTypes
				.map((type) => {
					switch (type) {
						case NodeConnectionType.AiVectorStore:
							return 'Vector Store';
						case NodeConnectionType.AiAgent:
							return 'AI Agent';
						case NodeConnectionType.AiChain:
							return 'AI Chain';
						case NodeConnectionType.AiLanguageModel:
							return 'Language Model';
						case NodeConnectionType.AiEmbedding:
							return 'Embeddings';
						default:
							return type;
					}
				})
				.join(', ')} nodes`,
		},
	};
} 