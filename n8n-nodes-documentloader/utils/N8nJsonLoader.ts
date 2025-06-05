import { Document } from '@langchain/core/documents';
import type { TextSplitter } from '@langchain/textsplitters';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

export class N8nJsonLoader {
  private context: IExecuteFunctions;
  private optionsPrefix: string;
  private textSplitter?: TextSplitter;

  constructor(
    context: IExecuteFunctions,
    optionsPrefix: string,
    textSplitter?: TextSplitter,
  ) {
    this.context = context;
    this.optionsPrefix = optionsPrefix;
    this.textSplitter = textSplitter;
  }

  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    const itemIndex = 0; // We use 0 for getting parameters, but process all items

    const dataType = this.context.getNodeParameter('dataType', itemIndex) as string;
    const jsonMode = this.context.getNodeParameter('jsonMode', itemIndex) as string;

    // Get metadata configuration
    const metadata = this.context.getNodeParameter(
      `${this.optionsPrefix}metadata.metadataValues`,
      itemIndex,
      [],
    ) as Array<{ name: string; value: string }>;

    const metadataObject: Record<string, any> = {};
    for (const item of metadata) {
      if (item.name) {
        metadataObject[item.name] = item.value;
      }
    }

    if (jsonMode === 'allInputData') {
      // Process ALL items from the workflow
      const items = this.context.getInputData();
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const jsonData = item.json;

        if (jsonData && typeof jsonData === 'object') {
          const pageContent = JSON.stringify(jsonData, null, 2);
          
          const doc = new Document({
            pageContent,
            metadata: {
              ...metadataObject,
              itemIndex: i,
              source: 'json',
            },
          });

          documents.push(doc);
        }
      }
    } else if (jsonMode === 'expressionData') {
      // Process expression data for each item
      const items = this.context.getInputData();
      
      for (let i = 0; i < items.length; i++) {
        try {
          // Get the expression data for this specific item
          const jsonDataExpression = this.context.getNodeParameter('jsonData', i) as string;
          
          let jsonData: any;
          if (typeof jsonDataExpression === 'string') {
            try {
              jsonData = JSON.parse(jsonDataExpression);
            } catch {
              // If it's not valid JSON, use it as is
              jsonData = jsonDataExpression;
            }
          } else {
            jsonData = jsonDataExpression;
          }

          const pageContent = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
          
          const doc = new Document({
            pageContent,
            metadata: {
              ...metadataObject,
              itemIndex: i,
              source: 'json-expression',
            },
          });

          documents.push(doc);
        } catch (error) {
          // Skip items where expression evaluation fails
          console.warn(`Failed to process item ${i}:`, error);
        }
      }
    }

    // Apply text splitting if available
    if (this.textSplitter && documents.length > 0) {
      const splitDocuments = await this.textSplitter.splitDocuments(documents);
      return splitDocuments;
    }

    return documents;
  }

  async loadAndSplit(): Promise<Document[]> {
    return this.load();
  }
} 