# n8n-nodes-documentloader

A custom n8n node that provides document loading capabilities with LangChain integration. This node replicates the functionality of the official DocumentDefaultDataLoader sub-node, allowing you to load and process various document formats in your n8n workflows.

## Features

- **Dual Data Modes**:
  - **JSON Mode**: Process JSON data from workflow with two options:
    - "allInputData": Processes ALL items from the workflow
    - "expressionData": Evaluates expressions for specific data
  - **Binary Mode**: Handle multiple file formats

- **Supported File Formats**:
  - PDF (with page splitting support)
  - CSV (with column extraction)
  - DOCX
  - JSON (with JSON pointer support)
  - Text files
  - EPUB

- **Text Splitting**: Integration with LangChain text splitters for chunking documents
- **Metadata Support**: Add custom metadata to documents for filtering during retrieval
- **Error Handling**: Graceful fallback to text loader for unsupported formats

## Installation

### Prerequisites

- Node.js (version 18 or above)
- npm
- n8n installed globally or locally

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd n8n-nodes-documentloader
```

2. Install dependencies:
```bash
npm install
```

3. Build the node:
```bash
npm run build
```

4. Link the node to n8n:
```bash
npm link
cd ~/.n8n/custom
npm link n8n-nodes-documentloader
```

5. Start n8n:
```bash
n8n start
```

## Usage

1. In n8n, search for "Document Loader" in the nodes panel
2. Drag the node into your workflow
3. Connect a Text Splitter node (required)
4. Configure the node:
   - Choose data type (JSON or Binary)
   - Select the appropriate mode
   - Configure options based on your file format

### JSON Mode Options

- **Load All Input Data**: Uses all JSON data flowing into the node
- **Load Specific Data**: Allows you to specify expressions to load specific data

### Binary Mode Options

- **Data Format**: Choose between auto-detection or specific format
- **File-specific options**:
  - PDF: Split pages option
  - CSV: Separator and column selection
  - JSON: JSON pointer support

### Metadata

Add metadata to documents for later filtering:
- Click "Add Option" → "Metadata"
- Add key-value pairs that will be attached to each document

## Development

### Project Structure

```
n8n-nodes-documentloader/
├── nodes/
│   └── DocumentLoader/
│       ├── DocumentLoader.node.ts    # Main node implementation
│       └── documentLoader.svg        # Node icon
├── utils/
│   ├── N8nJsonLoader.ts             # JSON data loader
│   ├── N8nBinaryLoader.ts           # Binary file loader
│   ├── logWrapper.ts                # Logging wrapper
│   └── sharedFields.ts              # Shared field definitions
├── package.json
├── tsconfig.json
└── gulpfile.js
```

### Key Dependencies

- `@langchain/core`: Core LangChain types and interfaces
- `@langchain/textsplitters`: Text splitting functionality
- `d3-dsv`: CSV parsing
- `mammoth`: DOCX processing
- `pdf-parse`: PDF parsing
- `epub2`: EPUB file handling

### Building and Testing

```bash
# Build the node
npm run build

# Watch mode for development
npm run dev

# Lint the code
npm run lint

# Fix linting issues
npm run lintfix

# Format code
npm run format
```

## Troubleshooting

### ESM Module Errors

If you encounter "Cannot use import statement outside a module" errors:
1. Ensure you're not using the full `langchain` package (use `@langchain/core` instead)
2. Clean and reinstall dependencies:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```

### Node Not Appearing

1. Ensure the node is built (`npm run build`)
2. Check that it's properly linked
3. Restart n8n
4. Check n8n logs for errors

### Vector Store Integration

This node implements the DocumentLoader interface required by LangChain vector stores. The `logWrapper` ensures proper typing and error handling for the `load()` and `loadAndSplit()` methods.

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
1. Code follows the existing style
2. All tests pass
3. Documentation is updated
4. Linting passes (`npm run lint`) 