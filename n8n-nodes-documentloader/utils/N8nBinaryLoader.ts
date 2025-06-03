import { Document } from '@langchain/core/documents';
import type { TextSplitter } from '@langchain/textsplitters';
import type { ISupplyDataFunctions, IBinaryData } from 'n8n-workflow';
import { dsvFormat } from 'd3-dsv';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

interface CSVRow {
  [key: string]: string | undefined;
}

export class N8nBinaryLoader {
  private context: ISupplyDataFunctions;
  private optionsPrefix: string;
  private binaryDataKey: string;
  private textSplitter?: TextSplitter;

  constructor(
    context: ISupplyDataFunctions,
    optionsPrefix: string,
    binaryDataKey: string,
    textSplitter?: TextSplitter,
  ) {
    this.context = context;
    this.optionsPrefix = optionsPrefix;
    this.binaryDataKey = binaryDataKey;
    this.textSplitter = textSplitter;
  }

  private async getLoaderForMimeType(
    mimeType: string,
    buffer: Buffer,
    fileName: string,
  ): Promise<Document[]> {
    const itemIndex = 0;
    const loader = this.context.getNodeParameter('loader', itemIndex, 'auto') as string;
    
    // Get loader-specific options
    const pointers = this.context.getNodeParameter(`${this.optionsPrefix}pointers`, itemIndex, '') as string;
    const separator = this.context.getNodeParameter(`${this.optionsPrefix}separator`, itemIndex, ',') as string;
    const column = this.context.getNodeParameter(`${this.optionsPrefix}column`, itemIndex, '') as string;
    const splitPages = this.context.getNodeParameter(`${this.optionsPrefix}splitPages`, itemIndex, true) as boolean;

    let documents: Document[] = [];

    // Determine which loader to use
    let selectedLoader = loader;
    if (loader === 'auto') {
      // Auto-detect based on MIME type
      if (mimeType.includes('pdf')) {
        selectedLoader = 'pdfLoader';
      } else if (mimeType.includes('csv') || mimeType.includes('text/csv')) {
        selectedLoader = 'csvLoader';
      } else if (mimeType.includes('json') || mimeType.includes('application/json')) {
        selectedLoader = 'jsonLoader';
      } else if (mimeType.includes('docx') || mimeType.includes('document') || mimeType.includes('vnd.openxmlformats-officedocument.wordprocessingml')) {
        selectedLoader = 'docxLoader';
      } else if (mimeType.includes('epub')) {
        selectedLoader = 'epubLoader';
      } else if (mimeType.includes('text/')) {
        selectedLoader = 'textLoader';
      } else {
        // Default to text loader for unknown types
        selectedLoader = 'textLoader';
      }
    }

    try {
      switch (selectedLoader) {
        case 'pdfLoader': {
          try {
            const pdfData = await pdfParse(buffer);
            
            if (splitPages && pdfData.numpages > 1) {
              // Split by pages if requested
              const pages = pdfData.text.split('\n\n');
              for (let i = 0; i < pages.length; i++) {
                if (pages[i].trim()) {
                  documents.push(new Document({
                    pageContent: pages[i],
                    metadata: {
                      source: fileName,
                      pdf: {
                        version: pdfData.version,
                        info: pdfData.info,
                        metadata: pdfData.metadata,
                        totalPages: pdfData.numpages,
                        pageNumber: i + 1,
                      },
                    },
                  }));
                }
              }
            } else {
              // Single document for all content
              documents.push(new Document({
                pageContent: pdfData.text,
                metadata: {
                  source: fileName,
                  pdf: {
                    version: pdfData.version,
                    info: pdfData.info,
                    metadata: pdfData.metadata,
                    totalPages: pdfData.numpages,
                  },
                },
              }));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse PDF: ${errorMessage}`);
          }
          break;
        }
        
        case 'csvLoader': {
          const text = buffer.toString('utf-8');
          const csvParser = dsvFormat(separator);
          const rows = csvParser.parse(text) as unknown as CSVRow[];
          
          if (column) {
            // Extract specific column
            const columnData = rows.map((row: CSVRow) => row[column] || '').filter((val: string) => val);
            documents.push(new Document({
              pageContent: columnData.join('\n'),
              metadata: { source: fileName, column },
            }));
          } else {
            // Convert all data to documents
            documents.push(new Document({
              pageContent: text,
              metadata: { source: fileName },
            }));
          }
          break;
        }
        
        case 'jsonLoader': {
          const text = buffer.toString('utf-8');
          try {
            const jsonData = JSON.parse(text);
            
            if (pointers) {
              // Extract specific pointers
              const pointerList = pointers.split(',').map(p => p.trim());
              const extractedData: any = {};
              
              for (const pointer of pointerList) {
                const path = pointer.split('/').filter(p => p);
                let current = jsonData;
                
                for (const segment of path) {
                  if (current && typeof current === 'object' && segment in current) {
                    current = current[segment];
                  } else {
                    current = undefined;
                    break;
                  }
                }
                
                if (current !== undefined) {
                  extractedData[pointer] = current;
                }
              }
              
              documents.push(new Document({
                pageContent: JSON.stringify(extractedData, null, 2),
                metadata: { source: fileName, pointers: pointerList },
              }));
            } else {
              documents.push(new Document({
                pageContent: JSON.stringify(jsonData, null, 2),
                metadata: { source: fileName },
              }));
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse JSON: ${errorMessage}`);
          }
          break;
        }
        
        case 'docxLoader': {
          try {
            const result = await mammoth.extractRawText({ buffer });
            documents.push(new Document({
              pageContent: result.value,
              metadata: { source: fileName },
            }));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse DOCX: ${errorMessage}`);
          }
          break;
        }
        
        case 'epubLoader': {
          // For now, treat EPUB as text since epub2 requires more complex handling
          const text = buffer.toString('utf-8');
          documents.push(new Document({
            pageContent: text,
            metadata: { source: fileName, note: 'EPUB parsed as plain text' },
          }));
          break;
        }
        
        case 'textLoader':
        default: {
          const text = buffer.toString('utf-8');
          documents.push(new Document({
            pageContent: text,
            metadata: { source: fileName },
          }));
          break;
        }
      }
    } catch (error: any) {
      console.error(`Failed to load file ${fileName} with ${selectedLoader}:`, error);
      // Fallback to text loader
      try {
        const text = buffer.toString('utf-8');
        documents.push(new Document({
          pageContent: text,
          metadata: { source: fileName, error: error.message, fallback: true },
        }));
      } catch (fallbackError: any) {
        throw new Error(`Failed to load file ${fileName}: ${error.message}`);
      }
    }

    return documents;
  }

  async load(): Promise<Document[]> {
    const documents: Document[] = [];
    const itemIndex = 0;

    const binaryMode = this.context.getNodeParameter('binaryMode', itemIndex, 'allInputData') as string;

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

    const items = this.context.getInputData();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.binary) {
        continue;
      }

      if (binaryMode === 'allInputData') {
        // Process all binary data from this item
        for (const binaryKey of Object.keys(item.binary)) {
          try {
            const binaryData = item.binary[binaryKey];
            const buffer = await this.context.helpers.getBinaryDataBuffer(i, binaryKey);
            
            const docs = await this.getLoaderForMimeType(
              binaryData.mimeType || 'text/plain',
              buffer,
              binaryData.fileName || binaryKey,
            );

            // Add metadata to each document
            docs.forEach(doc => {
              doc.metadata = {
                ...doc.metadata,
                ...metadataObject,
                itemIndex: i,
                binaryKey,
              };
            });

            documents.push(...docs);
          } catch (error) {
            console.error(`Failed to process binary data ${binaryKey} from item ${i}:`, error);
          }
        }
      } else if (binaryMode === 'specificField' && this.binaryDataKey) {
        // Process only the specified field
        const binaryData = item.binary[this.binaryDataKey];
        
        if (binaryData) {
          try {
            const buffer = await this.context.helpers.getBinaryDataBuffer(i, this.binaryDataKey);
            
            const docs = await this.getLoaderForMimeType(
              binaryData.mimeType || 'text/plain',
              buffer,
              binaryData.fileName || this.binaryDataKey,
            );

            // Add metadata to each document
            docs.forEach(doc => {
              doc.metadata = {
                ...doc.metadata,
                ...metadataObject,
                itemIndex: i,
                binaryKey: this.binaryDataKey,
              };
            });

            documents.push(...docs);
          } catch (error) {
            console.error(`Failed to process binary data ${this.binaryDataKey} from item ${i}:`, error);
          }
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