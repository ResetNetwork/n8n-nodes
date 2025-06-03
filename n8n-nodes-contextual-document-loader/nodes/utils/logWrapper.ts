import type { ISupplyDataFunctions, INodeExecutionData } from 'n8n-workflow';
import { Document } from '@langchain/core/documents';

interface Processor {
	processAll(items?: INodeExecutionData[]): Promise<Document[]>;
}

// Wrapper that provides the interface expected by n8n's vector stores
export function logWrapper<T extends Processor>(processor: T, _context: ISupplyDataFunctions): T {
	// In the full n8n implementation, this would add logging and error handling
	// For compatibility we simply return the processor as-is.
	return processor;
} 