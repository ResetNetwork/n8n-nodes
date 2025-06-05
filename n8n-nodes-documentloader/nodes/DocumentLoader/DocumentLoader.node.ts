/* eslint-disable n8n-nodes-base/node-dirname-against-convention */
import type { TextSplitter } from '@langchain/textsplitters';
import {
  type INodeType,
  type INodeTypeDescription,
  type INodeExecutionData,
  type IExecuteFunctions,
  NodeConnectionType,
} from 'n8n-workflow';

import { logWrapper } from '../../utils/logWrapper';
import { N8nBinaryLoader } from '../../utils/N8nBinaryLoader';
import { N8nJsonLoader } from '../../utils/N8nJsonLoader';
import { metadataFilterField } from '../../utils/sharedFields';

export class DocumentLoader implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Document Loader',
    name: 'documentLoader',
    icon: 'file:documentLoader.svg',
    group: ['transform'],
    version: 1,
    description: 'Load data from previous steps in the workflow',
    defaults: {
      name: 'Document Loader',
    },
    codex: {
      categories: ['AI'],
      subcategories: {
        AI: ['Document Loaders'],
      },
      resources: {
        primaryDocumentation: [
          {
            url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.documentloader/',
          },
        ],
      },
    },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    outputNames: ['Documents'],
    properties: [
      {
        displayName: 'This will load data from a previous step in the workflow',
        name: 'notice',
        type: 'notice',
        default: '',
      },
      {
        displayName: 'Enable Text Splitting',
        name: 'enableSplitting',
        type: 'boolean',
        default: false,
        description: 'Whether to split documents using a text splitter',
      },
      {
        displayName: 'Text Splitter Type',
        name: 'splitterType',
        type: 'options',
        default: 'recursive',
        displayOptions: {
          show: {
            enableSplitting: [true],
          },
        },
        options: [
          {
            name: 'Recursive Character Text Splitter',
            value: 'recursive',
            description: 'Split text recursively by characters',
          },
          {
            name: 'Character Text Splitter',
            value: 'character',
            description: 'Split text by characters',
          },
        ],
      },
      {
        displayName: 'Chunk Size',
        name: 'chunkSize',
        type: 'number',
        default: 1000,
        description: 'Maximum size of each chunk',
        displayOptions: {
          show: {
            enableSplitting: [true],
          },
        },
      },
      {
        displayName: 'Chunk Overlap',
        name: 'chunkOverlap',
        type: 'number',
        default: 200,
        description: 'Number of characters to overlap between chunks',
        displayOptions: {
          show: {
            enableSplitting: [true],
          },
        },
      },
      {
        displayName: 'Type of Data',
        name: 'dataType',
        type: 'options',
        default: 'json',
        required: true,
        noDataExpression: true,
        options: [
          {
            name: 'JSON',
            value: 'json',
            description: 'Process JSON data from previous step in the workflow',
          },
          {
            name: 'Binary',
            value: 'binary',
            description: 'Process binary data from previous step in the workflow',
          },
        ],
      },
      {
        displayName: 'Mode',
        name: 'jsonMode',
        type: 'options',
        default: 'allInputData',
        required: true,
        displayOptions: {
          show: {
            dataType: ['json'],
          },
        },
        options: [
          {
            name: 'Load All Input Data',
            value: 'allInputData',
            description: 'Use all JSON data that flows into the parent agent or chain',
          },
          {
            name: 'Load Specific Data',
            value: 'expressionData',
            description: 'Load a subset of data, and/or data from any previous step in the workflow',
          },
        ],
      },
      {
        displayName: 'Mode',
        name: 'binaryMode',
        type: 'options',
        default: 'allInputData',
        required: true,
        displayOptions: {
          show: {
            dataType: ['binary'],
          },
        },
        options: [
          {
            name: 'Load All Input Data',
            value: 'allInputData',
            description: 'Use all Binary data that flows into the parent agent or chain',
          },
          {
            name: 'Load Specific Data',
            value: 'specificField',
            description: 'Load data from a specific field in the parent agent or chain',
          },
        ],
      },
      {
        displayName: 'Data Format',
        name: 'loader',
        type: 'options',
        default: 'auto',
        required: true,
        displayOptions: {
          show: {
            dataType: ['binary'],
          },
        },
        options: [
          {
            name: 'Automatically Detect by Mime Type',
            value: 'auto',
            description: 'Uses the mime type to detect the format',
          },
          {
            name: 'CSV',
            value: 'csvLoader',
            description: 'Load CSV files',
          },
          {
            name: 'Docx',
            value: 'docxLoader',
            description: 'Load Docx documents',
          },
          {
            name: 'EPub',
            value: 'epubLoader',
            description: 'Load EPub files',
          },
          {
            name: 'JSON',
            value: 'jsonLoader',
            description: 'Load JSON files',
          },
          {
            name: 'PDF',
            value: 'pdfLoader',
            description: 'Load PDF documents',
          },
          {
            name: 'Text',
            value: 'textLoader',
            description: 'Load plain text files',
          },
        ],
      },
      {
        displayName: 'Data',
        name: 'jsonData',
        type: 'string',
        typeOptions: {
          rows: 6,
        },
        default: '',
        required: true,
        description: 'Drag and drop fields from the input pane, or use an expression',
        displayOptions: {
          show: {
            dataType: ['json'],
            jsonMode: ['expressionData'],
          },
        },
      },
      {
        displayName: 'Input Data Field Name',
        name: 'binaryDataKey',
        type: 'string',
        default: 'data',
        required: true,
        description: 'The name of the field in the agent or chain\'s input that contains the binary file to be processed',
        displayOptions: {
          show: {
            dataType: ['binary'],
          },
          hide: {
            binaryMode: ['allInputData'],
          },
        },
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'JSON Pointers',
            name: 'pointers',
            type: 'string',
            default: '',
            description: 'Pointers to extract from JSON, e.g. "/text" or "/text, /meta/title"',
            displayOptions: {
              show: {
                '/loader': ['jsonLoader', 'auto'],
              },
            },
          },
          {
            displayName: 'CSV Separator',
            name: 'separator',
            type: 'string',
            description: 'Separator to use for CSV',
            default: ',',
            displayOptions: {
              show: {
                '/loader': ['csvLoader', 'auto'],
              },
            },
          },
          {
            displayName: 'CSV Column',
            name: 'column',
            type: 'string',
            default: '',
            description: 'Column to extract from CSV',
            displayOptions: {
              show: {
                '/loader': ['csvLoader', 'auto'],
              },
            },
          },
          {
            displayName: 'Split Pages in PDF',
            description: 'Whether to split PDF pages into separate documents',
            name: 'splitPages',
            type: 'boolean',
            default: true,
            displayOptions: {
              show: {
                '/loader': ['pdfLoader', 'auto'],
              },
            },
          },
          {
            ...metadataFilterField,
            displayName: 'Metadata',
            description: 'Metadata to add to each document. Could be used for filtering during retrieval',
            placeholder: 'Add property',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const returnData: INodeExecutionData[] = [];
    const items = this.getInputData();

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const dataType = this.getNodeParameter('dataType', itemIndex, 'json') as 'json' | 'binary';
        const enableSplitting = this.getNodeParameter('enableSplitting', itemIndex, false) as boolean;
        
        let textSplitter: TextSplitter | undefined;
        
        if (enableSplitting) {
          const { RecursiveCharacterTextSplitter, CharacterTextSplitter } = await import('@langchain/textsplitters');
          const splitterType = this.getNodeParameter('splitterType', itemIndex, 'recursive') as string;
          const chunkSize = this.getNodeParameter('chunkSize', itemIndex, 1000) as number;
          const chunkOverlap = this.getNodeParameter('chunkOverlap', itemIndex, 200) as number;
          
          textSplitter = splitterType === 'recursive' 
            ? new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap })
            : new CharacterTextSplitter({ chunkSize, chunkOverlap });
        }

        const binaryDataKey = this.getNodeParameter('binaryDataKey', itemIndex, '') as string;

        const processor =
          dataType === 'binary'
            ? new N8nBinaryLoader(this, 'options.', binaryDataKey, textSplitter)
            : new N8nJsonLoader(this, 'options.', textSplitter);

        const documents = await logWrapper(processor, this).load();
        
        // Convert documents to n8n data format
        for (const doc of documents) {
          returnData.push({
            json: {
              pageContent: doc.pageContent,
              metadata: doc.metadata,
            },
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: errorMessage },
          });
        } else {
          throw error;
        }
      }
    }

    return [returnData];
  }
} 