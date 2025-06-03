import { INodeProperties, NodeConnectionType } from 'n8n-workflow';

export function getConnectionHintNoticeField(
	acceptedConnectionTypes: NodeConnectionType[],
): INodeProperties {
	return {
		displayName: '',
		name: 'notice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				'@version': [1],
			},
		},
		typeOptions: {
			notice: `This node can be connected to: ${acceptedConnectionTypes
				.map((type) => type)
				.join(', ')} nodes`,
		},
	};
} 