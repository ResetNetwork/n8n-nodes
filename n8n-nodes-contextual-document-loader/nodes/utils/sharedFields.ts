import { INodeProperties } from 'n8n-workflow';

export function getConnectionHintNoticeField(
    connectionTypes: string[],
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
                        case 'aiVectorStore':
                            return 'Vector Store';
                        case 'aiAgent':
                            return 'AI Agent';
                        case 'aiChain':
                            return 'AI Chain';
                        case 'aiLanguageModel':
                            return 'Language Model';
                        case 'aiEmbedding':
                            return 'Embeddings';
                        default:
                            return type;
                    }
                })
                .join(', ')} nodes`,
		},
	};
} 