# n8n Custom Nodes Collection

This repository contains a collection of custom n8n nodes for enhanced document processing, text splitting, and embeddings generation, maintained by [Reset Network](https://github.com/ResetNetwork).

## 📦 Available Packages

All packages are published to npm under the `@resetnetwork` scope and can be installed individually:

| Package | Version | Description |
|---------|---------|-------------|
| [`n8n-nodes-contextual-document-loader`](./n8n-nodes-contextual-document-loader) | ![npm](https://img.shields.io/npm/v/n8n-nodes-contextual-document-loader) | ⚠️ **DEPRECATED** - Use `n8n-nodes-semantic-splitter-with-context` instead |
| [`n8n-nodes-semantic-splitter-with-context`](./n8n-nodes-semantic-splitter-with-context) | ![npm](https://img.shields.io/npm/v/n8n-nodes-semantic-splitter-with-context) | Semantic text splitter with contextual information for enhanced document processing |
| [`n8n-nodes-google-gemini-embeddings-extended`](./n8n-nodes-google-gemini-embeddings-extended) | ![npm](https://img.shields.io/npm/v/n8n-nodes-google-gemini-embeddings-extended) | Google Gemini Embeddings with extended features like output dimensions support |
| [`n8n-nodes-google-vertex-embeddings-extended`](./n8n-nodes-google-vertex-embeddings-extended) | ![npm](https://img.shields.io/npm/v/n8n-nodes-google-vertex-embeddings-extended) | Google Vertex AI Embeddings with output dimensions and configurable batch size support |
| [`n8n-nodes-query-retriever-rerank`](./n8n-nodes-query-retriever-rerank) | ![npm](https://img.shields.io/npm/v/n8n-nodes-query-retriever-rerank) | Advanced query retrieval with multi-step reasoning, reranking, and comprehensive debugging |
| [`n8n-nodes-sse-trigger-extended`](./n8n-nodes-sse-trigger-extended) | ![npm](https://img.shields.io/npm/v/n8n-nodes-sse-trigger-extended) | Extended Server-Sent Events trigger with custom headers support and enhanced reliability |

## 🚀 Quick Start

### Installing Individual Packages

Each node can be installed individually via npm:

```bash
# Install a specific node
npm install n8n-nodes-semantic-splitter-with-context

# Or install multiple nodes
npm install n8n-nodes-semantic-splitter-with-context n8n-nodes-google-gemini-embeddings-extended n8n-nodes-query-retriever-rerank n8n-nodes-sse-trigger-extended
```

### Development Setup

For local development and testing:

```bash
# Clone the repository
git clone https://github.com/ResetNetwork/n8n-nodes.git
cd n8n-nodes

# Install dependencies for all packages
npm install

# Build all packages (optimized with Turborepo caching)
npm run build:all

# Set up local development environment
./setup-local.sh

# Start n8n
./start-n8n.sh
```

## 🛠️ Development

This repository uses npm workspaces with [Turborepo](https://turborepo.com/) for optimized build caching and task orchestration, plus [Changesets](https://github.com/changesets/changesets) for version management.

### Root Level Commands

```bash
# Install dependencies for all packages
npm install

# Build all packages (optimized with Turborepo caching)
npm run build:all

# Build all packages (legacy npm workspaces method)
npm run build

# Build only packages that changed since last commit
npm run build:changed

# Run linting on all packages
npm run lint

# Fix linting issues in all packages
npm run lintfix

# Format code in all packages
npm run format

# Run development mode for all packages (with watch mode)
npm run dev

# Run tests across all packages
npm run test
```

### Release Management Commands

```bash
# Create a changeset after making changes
npm run changeset

# Update package versions based on changesets
npm run version-packages

# Publish updated packages to npm
npm run release

# Legacy publish method (backup)
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
cd n8n-nodes-semantic-splitter-with-context

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
   npm link n8n-nodes-semantic-splitter-with-context
   npm link n8n-nodes-google-gemini-embeddings-extended
   npm link n8n-nodes-google-vertex-embeddings-extended
   npm link n8n-nodes-query-retriever-rerank
   npm link n8n-nodes-sse-trigger-extended
   ```

5. **Start n8n**:
   ```bash
   n8n start
   ```

## 📦 Publishing to npm

This repository uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

### Prerequisites for Publishing

1. **npm Account**: You need an npm account with access to publish packages
2. **Organization Access**: For publishing under an organization scope, you need appropriate permissions
3. **Authentication**: Login to npm via `npm login`

### Release Workflow with Changesets

#### 1. Create a Changeset

After making changes to any package, create a changeset to document the changes:

```bash
npm run changeset
```

This will:
- Prompt you to select which packages have changed
- Ask for the type of change (patch, minor, major)
- Let you write a summary of the changes
- Create a changeset file in `.changeset/`

#### 2. Version Packages

When ready to release, update package versions based on changesets:

```bash
npm run version-packages
```

This will:
- Update package.json versions according to changesets
- Update CHANGELOG.md files
- Remove consumed changeset files

#### 3. Publish to npm

Publish the updated packages:

```bash
npm run release
```

This will:
- Publish all packages with updated versions to npm
- Use the configured public access

### Legacy Publishing (Backup)

The old publishing method is still available:

```bash
npm run publish-all
```

### Changeset Best Practices

- **Create changesets immediately** after making changes
- **Use semantic versioning** appropriately:
  - `patch`: Bug fixes and non-breaking changes
  - `minor`: New features that are backward compatible
  - `major`: Breaking changes
- **Write clear changeset summaries** that explain the impact to users
- **Group related changes** in a single changeset when appropriate

## 🧪 Testing

### Verify Installation

After installation, verify the nodes appear in n8n:

1. Open n8n in your browser (typically at http://localhost:5678)
2. Search for the following nodes in the nodes panel:
   - **Semantic Splitter with Context** (search for "semantic splitter")
   - **Google Gemini Embeddings Extended** (search for "gemini")
   - **Google Vertex Embeddings Extended** (search for "vertex")
   - **Query Retriever with Rerank** (search for "query retriever" or "rerank")
   - **SSE Trigger Extended** (search for "sse trigger" or "server-sent events")

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

### SSE Test Server

For testing the **SSE Trigger Extended** node, the repository includes a built-in test server that automatically starts with n8n:

- **Endpoint:** `http://localhost:3001/events`
- **Authentication:** Requires either:
  - `x-api-key: test-key-123` header
  - `authorization: Bearer test-token-456` header
- **Behavior:** Sends a new message every 2 seconds with unique timestamps
- **Auto-start:** Automatically runs when using `./start-n8n.sh`

**Manual SSE server commands:**
```bash
# Start SSE server only
npm run test-sse-server

# Test with API key (Header Auth)
curl -H "x-api-key: test-key-123" http://localhost:3001/events

# Test with Bearer token
curl -H "authorization: Bearer test-token-456" http://localhost:3001/events

# Check server health
curl http://localhost:3001/health
```

**n8n Configuration Examples:**
- **Header Auth**: Header Name = `x-api-key`, Header Value = `test-key-123`
- **Bearer Token**: Token = `test-token-456`

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
2. Run the build command: `npm run build:all` (or `npm run build` for legacy method)
3. Test in n8n
4. For active development, use watch mode: `npm run dev`
5. Before committing, create a changeset: `npm run changeset`

### Turborepo Benefits

- **Build caching**: Only rebuilds packages that have changed
- **Parallel execution**: Runs tasks across packages simultaneously  
- **Incremental builds**: Use `npm run build:changed` to build only modified packages
- **Task orchestration**: Optimizes task dependencies and execution order

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