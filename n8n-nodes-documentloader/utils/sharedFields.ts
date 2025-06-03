import type { INodeProperties } from 'n8n-workflow';

export const metadataFilterField: INodeProperties = {
  displayName: 'Metadata',
  name: 'metadata',
  type: 'fixedCollection',
  typeOptions: {
    multipleValues: true,
  },
  default: {},
  options: [
    {
      name: 'metadataValues',
      displayName: 'Metadata',
      values: [
        {
          displayName: 'Name',
          name: 'name',
          type: 'string',
          default: '',
        },
        {
          displayName: 'Value',
          name: 'value',
          type: 'string',
          default: '',
        },
      ],
    },
  ],
}; 