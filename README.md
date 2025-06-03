# n8n Custom Nodes Collection

This repository contains a collection of custom n8n nodes for enhanced document processing, text splitting, and embeddings generation, maintained by [Reset Network](https://github.com/ResetNetwork).

## 📦 Available Packages

All packages are published to npm under the `@resetnetwork` scope and can be installed individually:

| Package | Version | Description |
|---------|---------|-------------|
| [`n8n-nodes-contextual-document-loader`](./n8n-nodes-contextual-document-loader) | ![npm](https://img.shields.io/npm/v/n8n-nodes-contextual-document-loader) | Document loading with contextual retrieval support |
| [`n8n-nodes-semantic-text-splitter`](./n8n-nodes-semantic-text-splitter) | ![npm](https://img.shields.io/npm/v/n8n-nodes-semantic-text-splitter) | Semantic double-pass merging text splitting with embeddings-based chunking |
| [`n8n-nodes-google-gemini-embeddings-extended`](./n8n-nodes-google-gemini-embeddings-extended) | ![npm](https://img.shields.io/npm/v/n8n-nodes-google-gemini-embeddings-extended) | Google Gemini Embeddings with extended features like output dimensions support |
| [`n8n-nodes-google-vertex-embeddings-extended`](./n8n-nodes-google-vertex-embeddings-extended) | ![npm](https://img.shields.io/npm/v/n8n-nodes-google-vertex-embeddings-extended) | Google Vertex AI Embeddings with output dimensions support |
| [`n8n-nodes-documentloader`](./n8n-nodes-documentloader) | ![npm](https://img.shields.io/npm/v/n8n-nodes-documentloader) | Fully functional document loader that replicates the official DocumentDefaultDataLoader functionality with LangChain integration |

## 🚀 Quick Start

### Installing Individual Packages

Each node can be installed individually via npm:

```bash
# Install a specific node
npm install n8n-nodes-contextual-document-loader

# Or install multiple nodes
npm install n8n-nodes-contextual-document-loader n8n-nodes-semantic-text-splitter
```

### Development Setup

For local development and testing:

```bash
# Clone the repository
git clone https://github.com/ResetNetwork/n8n-nodes.git
cd n8n-nodes

# Install dependencies for all packages
npm install

# Build all packages
npm run build

# Set up local development environment
./setup-local.sh

# Start n8n
./start-n8n.sh
```

## 🛠️ Development

This repository uses npm workspaces to manage multiple packages. Here are the available commands:

### Root Level Commands

```bash
# Install dependencies for all packages
npm install

# Build all packages
npm run build

# Run linting on all packages
npm run lint

# Fix linting issues in all packages
npm run lintfix

# Format code in all packages
npm run format

# Run development mode for all packages
npm run dev

# Publish all packages to npm (requires proper permissions)
npm run publish-all
```

### Helper Scripts

- **`./setup-local.sh`** - Automatically builds and links all nodes for local testing
- **`./start-n8n.sh`** - Starts n8n with pre-flight checks
- **`./dev-watch.sh`** - Runs all nodes in watch mode for development
- **`./cleanup-local.sh`** - Removes all node links when you're done

### Working with Individual Packages

You can also work with individual packages:

```bash
# Work on a specific package
cd n8n-nodes-contextual-document-loader

# Install dependencies for this package only
npm install

# Build this package only
npm run build

# Run in development mode
npm run dev
```

## 📋 Prerequisites

- Node.js (version 18 or above)
- npm (version 8 or above)
- n8n installed globally or locally

## 🔧 Local Development Setup

### Quick Setup with Helper Scripts

```bash
# Clone and setup
git clone https://github.com/ResetNetwork/n8n-nodes.git
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

If you prefer manual setup:

1. **Install n8n globally** (if not already installed):
   ```bash
   npm install n8n -g
   ```

2. **Clone and prepare the repository**:
   ```bash
   git clone https://github.com/ResetNetwork/n8n-nodes.git
   cd n8n-nodes
   npm install
   ```

3. **Build all packages**:
   ```bash
   npm run build
   ```

4. **Link packages to n8n**:
   ```bash
   # Create the custom directory if it doesn't exist
   mkdir -p ~/.n8n/custom
   cd ~/.n8n/custom
   npm init -y

   # Link each package
   npm link n8n-nodes-contextual-document-loader
   npm link n8n-nodes-semantic-text-splitter
   npm link n8n-nodes-google-gemini-embeddings-extended
   npm link n8n-nodes-google-vertex-embeddings-extended
   npm link n8n-nodes-documentloader
   ```

5. **Start n8n**:
   ```bash
   n8n start
   ```

## 📦 Publishing to npm

### Prerequisites for Publishing

1. **npm Account**: You need an npm account with access to publish packages
2. **Organization Access**: For publishing under an organization scope, you need appropriate permissions
3. **Authentication**: Login to npm via `npm login`

### Publishing Individual Packages

To publish a single package:

```bash
cd n8n-nodes-contextual-document-loader
npm publish --access public
```

### Publishing All Packages

To publish all packages at once:

```bash
npm run publish-all
```

This will:
- Build all packages
- Run linting
- Publish all packages with public access

### Version Management

Before publishing, update the version in the package's `package.json`:

```bash
cd n8n-nodes-contextual-document-loader
npm version patch  # or minor, major
```

## 🧪 Testing

### Verify Installation

After installation, verify the nodes appear in n8n:

1. Open n8n in your browser (typically at http://localhost:5678)
2. Search for the following nodes in the nodes panel:
   - **Contextual Document Loader** (search for "contextual")
   - **Semantic Double-Pass Text Splitter** (search for "semantic")
   - **Google Gemini Embeddings Extended** (search for "gemini")
   - **Google Vertex Embeddings Extended** (search for "vertex")
   - **Document Loader** (search for "document loader")

### Development Testing

For development testing, use the provided test script:

```bash
#!/bin/bash
# test-nodes.sh

echo "Building all nodes..."
npm run build

echo "Starting n8n..."
n8n start
```

## 🐛 Troubleshooting

### Node not appearing in n8n

1. Ensure the node is properly built (`npm run build`)
2. Check that the node is linked correctly
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

If you encounter permission issues:
- Use `sudo` for global npm operations, or
- Configure npm to use a different directory for global packages

### Different custom extensions directory

If your n8n installation uses a different directory (set via `N8N_CUSTOM_EXTENSIONS`), use that directory instead of `~/.n8n/custom`.

### ESM Module Errors

If you encounter "Cannot use import statement outside a module" errors:
1. Clean node_modules and reinstall dependencies
2. Ensure you're using compatible package versions
3. Check that TypeScript target is set correctly (ES2019 or later)

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository** and create a feature branch
2. **Follow the existing code structure** and patterns
3. **Run linting** before committing: `npm run lint`
4. **Fix any linting issues**: `npm run lintfix`
5. **Format code**: `npm run format`
6. **Test your changes** thoroughly in a local n8n instance
7. **Submit a pull request** with a clear description of your changes

### Development Workflow

1. Make your changes in the respective node's source files
2. Run the build command: `npm run build`
3. Test in n8n
4. For active development, use watch mode: `npm run dev`

## 📄 License

MIT License - see individual package directories for specific license files.

## 🔗 Links

- [Reset Network](https://github.com/ResetNetwork)
- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ResetNetwork/n8n-nodes/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ResetNetwork/n8n-nodes/discussions)
- **Documentation**: Check individual package README files for specific documentation 