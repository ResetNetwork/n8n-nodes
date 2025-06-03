# n8n Custom Nodes Collection

This repository contains a collection of custom n8n nodes for enhanced document processing, text splitting, and embeddings generation.

## Nodes Included

1. **n8n-nodes-contextual-document-loader** - Document loading with contextual retrieval support
2. **n8n-nodes-semantic-text-splitter** - Semantic double-pass merging text splitting with embeddings-based chunking
3. **n8n-nodes-google-gemini-embeddings-extended** - Google Gemini Embeddings with extended features like output dimensions support
4. **n8n-nodes-google-vertex-embeddings-extended** - Google Vertex AI Embeddings with output dimensions support
5. **n8n-nodes-documentloader** - Fully functional document loader that replicates the official DocumentDefaultDataLoader functionality with LangChain integration

## Prerequisites

- Node.js (version 18 or above)
- npm
- n8n installed globally or locally

## Local Development Setup

### Quick Start with Helper Scripts

This repository includes several helper scripts to make local development easier:

- **`./setup-local.sh`** - Automatically builds and links all nodes for local testing
- **`./start-n8n.sh`** - Starts n8n with pre-flight checks
- **`./dev-watch.sh`** - Runs all nodes in watch mode for development
- **`./cleanup-local.sh`** - Removes all node links when you're done

#### Quick setup:

```bash
# Clone the repository
git clone <your-repository-url>
cd n8n-nodes

# Run the setup script
./setup-local.sh

# Start n8n
./start-n8n.sh
```

For development with auto-reload:
```bash
# In one terminal, run the watchers
./dev-watch.sh

# In another terminal, start n8n
./start-n8n.sh
```

### Manual Setup

If you prefer to set up the nodes manually or need more control over the process:

### 1. Install n8n globally (if not already installed)

```bash
npm install n8n -g
```

### 2. Clone and prepare the repository

```bash
git clone <your-repository-url>
cd n8n-nodes
```

### 3. Build and link each node

You need to build and link each node package separately. Follow these steps for each node:

#### For Contextual Document Loader:

```bash
cd n8n-nodes-contextual-document-loader
npm install
npm run build
npm link
```

#### For Semantic Text Splitter:

```bash
cd ../n8n-nodes-semantic-text-splitter
npm install
npm run build
npm link
```

#### For Google Gemini Embeddings Extended:

```bash
cd ../n8n-nodes-google-gemini-embeddings-extended
npm install
npm run build
npm link
```

#### For Google Vertex Embeddings Extended:

```bash
cd ../n8n-nodes-google-vertex-embeddings-extended
npm install
npm run build
npm link
```

#### For Document Loader:

```bash
cd ../n8n-nodes-documentloader
npm install
npm run build
npm link
```

### 4. Link nodes to your n8n instance

First, ensure the custom nodes directory exists:

```bash
# Create the custom directory if it doesn't exist
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom

# Initialize npm if not already done
npm init -y
```

Then link each node package:

```bash
npm link n8n-nodes-contextual-document-loader
npm link n8n-nodes-semantic-text-splitter
npm link n8n-nodes-google-gemini-embeddings-extended
npm link n8n-nodes-google-vertex-embeddings-extended
npm link n8n-nodes-documentloader
```

### 5. Start n8n

```bash
n8n start
```

### 6. Verify installation

Open n8n in your browser (typically at http://localhost:5678) and search for the following nodes in the nodes panel:

- **Contextual Document Loader** (search for "contextual")
- **Semantic Double-Pass Text Splitter** (search for "semantic")
- **Google Gemini Embeddings Extended** (search for "gemini")
- **Google Vertex Embeddings Extended** (search for "vertex")
- **Document Loader** (search for "document loader")

## Development Workflow

### Making changes

1. Make your changes in the respective node's source files
2. Run the build command in the node's directory:
   ```bash
   npm run build
   ```
3. Restart n8n to see the changes

### Watch mode for development

For active development, you can use watch mode in each node directory:

```bash
npm run dev
```

This will automatically rebuild the node when you make changes to the TypeScript files.

## Troubleshooting

### Node not appearing in n8n

1. Ensure the node is properly built (`npm run build`)
2. Check that the node is linked correctly (`npm link` in node directory, then `npm link <package-name>` in `~/.n8n/custom`)
3. Restart n8n
4. Check the n8n logs for any error messages

### Custom directory doesn't exist

If `~/.n8n/custom` doesn't exist:

```bash
mkdir -p ~/.n8n/custom
cd ~/.n8n/custom
npm init -y
```

### Permission issues

If you encounter permission issues, you may need to use `sudo` for global npm operations or configure npm to use a different directory for global packages.

### Different custom extensions directory

If your n8n installation uses a different directory (set via `N8N_CUSTOM_EXTENSIONS`), use that directory instead of `~/.n8n/custom`.

### ESM Module Errors

If you encounter "Cannot use import statement outside a module" errors:
1. Clean node_modules and reinstall dependencies
2. Ensure you're using compatible package versions
3. Check that TypeScript target is set correctly (ES2019 or later)

## Testing Individual Nodes

### Quick Test Script

Create a test script to verify all nodes are loaded correctly:

```bash
#!/bin/bash
# test-nodes.sh

echo "Building all nodes..."
for dir in n8n-nodes-*/; do
    echo "Building $dir"
    cd "$dir"
    npm run build
    cd ..
done

echo "Starting n8n..."
n8n start
```

Make it executable:
```bash
chmod +x test-nodes.sh
./test-nodes.sh
```

## Contributing

When contributing to these nodes:

1. Follow the existing code structure
2. Run linting before committing: `npm run lint`
3. Fix any linting issues: `npm run lintfix`
4. Format code: `npm run format`
5. Test your changes thoroughly in a local n8n instance

## License

MIT 