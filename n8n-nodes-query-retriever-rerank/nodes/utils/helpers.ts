import { INode } from 'n8n-workflow';

export function nodeNameToToolName(node: INode): string {
	return node.name.replace(/[\s.?!=+#@&*()\[\]{}:;,<>\/\\'"^%$]/g, '_').replace(/\_+/g, '_');
}