import type { IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';
import type { Document } from '@langchain/core/documents';

interface DocumentLoader {
  load(): Promise<Document[]>;
  loadAndSplit?(): Promise<Document[]>;
}

export function logWrapper(
  processor: DocumentLoader,
  context: ISupplyDataFunctions | IExecuteFunctions,
): DocumentLoader {
  // Ensure the processor has the required load method
  if (!processor || typeof processor.load !== 'function') {
    throw new Error('Invalid document loader: missing load() method');
  }

  // Return a properly typed document loader
  const wrappedLoader: DocumentLoader = {
    async load(): Promise<Document[]> {
      try {
        console.log('Document loader: load() called');
        const documents = await processor.load();
        
        // Ensure we always return an array
        if (!Array.isArray(documents)) {
          console.error('Document loader returned non-array:', documents);
          return [];
        }
        
        console.log(`Document loader: returning ${documents.length} documents`);
        return documents;
      } catch (error) {
        console.error('Error in document loader load():', error);
        throw error;
      }
    }
  };

  // Add loadAndSplit if the processor supports it
  if (processor.loadAndSplit && typeof processor.loadAndSplit === 'function') {
    wrappedLoader.loadAndSplit = async (): Promise<Document[]> => {
      try {
        console.log('Document loader: loadAndSplit() called');
        // We've already checked that loadAndSplit exists
        const documents = await processor.loadAndSplit!();
        
        // Ensure we always return an array
        if (!Array.isArray(documents)) {
          console.error('Document loader returned non-array:', documents);
          return [];
        }
        
        console.log(`Document loader: returning ${documents.length} split documents`);
        return documents;
      } catch (error) {
        console.error('Error in document loader loadAndSplit():', error);
        throw error;
      }
    };
  }

  return wrappedLoader;
} 