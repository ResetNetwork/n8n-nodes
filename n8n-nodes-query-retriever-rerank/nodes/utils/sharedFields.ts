import { INodeProperties } from 'n8n-workflow';

export function getConnectionHintNoticeField(
    connectionTypes: string[],
): INodeProperties {
    const connectors = connectionTypes
        .map((type) => {
            if (type === 'aiTool') return 'AI Tool';
            if (type === 'aiVectorStore') return 'Vector Store';
            if (type === 'aiLanguageModel') return 'Language Model';
            if (type === 'aiAgent') return 'Agent';
            if (type === 'aiEmbedding') return 'Embeddings';
            if (type === 'aiMemory') return 'Memory';
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


