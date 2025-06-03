# n8n-nodes-google-vertex-embeddings-extended

This is an n8n community sub-node that provides Google Vertex AI Embeddings with additional features, including support for output dimensions. Use this node with vector store nodes in n8n.

## Features

- Support for any Google Vertex AI embedding model (specify by name)
- **Output dimensions configuration** (for supported models like text-embedding-004)
- Task type specification for optimized embeddings
- Region selection
- Project ID dropdown with auto-loading from your Google account
- Uses standard Google API credentials (same as other Google nodes)
- Works as a sub-node with vector stores and other AI nodes

## Installation

### Community Node (Recommended)

1. In n8n, go to **Settings** > **Community Nodes**
2. Search for `n8n-nodes-google-vertex-embeddings-extended`
3. Click **Install**

### Manual Installation

```bash
npm install n8n-nodes-google-vertex-embeddings-extended
```

## Setup

### Prerequisites

1. A Google Cloud Platform account
2. A project with Vertex AI API enabled
3. Google API credentials configured in n8n

### Authentication

This node uses the standard Google API credentials that you may already have configured for other Google nodes in n8n:

1. In n8n, create or use existing **Google API** credentials
2. Ensure your service account has the `Vertex AI User` role
3. The node will automatically load your available projects

## Usage

This is a **sub-node** that provides embeddings functionality to other n8n AI nodes.

### Using with Vector Stores

1. Add a vector store node to your workflow (e.g., Pinecone, Qdrant, Supabase Vector Store)
2. Connect the **Embeddings Google Vertex Extended** node to the embeddings input of the vector store
3. Select your Google API credentials
4. Choose your project from the dropdown (auto-loaded from your Google account)
5. Enter your model name (e.g., `text-embedding-004`)
6. Configure additional options as needed
7. The vector store will use these embeddings to process your documents

### Example Workflow

```
[Document Loader] → [Vector Store] ← [Embeddings Google Vertex Extended]
                          ↓
                    [AI Agent/Chain]
```

### Configuration Options

#### Model Name

Enter any valid Google Vertex AI embedding model name. Examples:
- `text-embedding-004` (Latest, supports output dimensions)
- `text-multilingual-embedding-002` (Multilingual support, supports output dimensions)
- `textembedding-gecko@003`
- `textembedding-gecko@002`
- `textembedding-gecko@001`
- `textembedding-gecko-multilingual@001`

#### Output Dimensions

For models that support it (like `text-embedding-004`), you can specify the number of output dimensions:

- Set to `0` to use the model's default dimensions
- Set to a specific number (e.g., `256`, `512`) to get embeddings of that size

#### Task Types

Optimize your embeddings by specifying the task type:

- **Retrieval Document**: For document storage in retrieval systems
- **Retrieval Query**: For search queries
- **Semantic Similarity**: For comparing text similarity
- **Classification**: For text classification tasks
- **Clustering**: For grouping similar texts

## Use Cases

- **Semantic Search**: Generate embeddings for documents and queries in vector stores
- **RAG Applications**: Build retrieval-augmented generation systems with custom embeddings
- **Document Similarity**: Find similar documents in your vector database
- **Multi-language Support**: Use multilingual models for international applications

## Differences from Official n8n Node

This community node extends the official Google Vertex AI Embeddings node with:

1. **Output Dimensions Support**: Configure the size of embedding vectors
2. **Flexible Model Selection**: Enter any model name instead of choosing from a fixed list
3. **Task Type Selection**: Optimize embeddings for specific use cases
4. **Standard Google Credentials**: Uses the same credentials as other Google nodes

## Compatible Nodes

This embeddings node can be used with:

- Simple Vector Store
- Pinecone Vector Store
- Qdrant Vector Store
- Supabase Vector Store
- PGVector Vector Store
- Milvus Vector Store
- MongoDB Atlas Vector Store
- Zep Vector Store
- Question and Answer Chain
- AI Agent nodes

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Ensure your Google API credentials are properly configured
   - Check that your service account has the `Vertex AI User` role
   - Verify the Vertex AI API is enabled in your selected project

2. **Project Not Showing in Dropdown**
   - Ensure your service account has access to the project
   - Check that the Cloud Resource Manager API is enabled

3. **Model Errors**
   - Verify the model name is spelled correctly
   - Ensure the model is available in your selected region
   - Check [Google's documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api) for valid model names
   - **Note:** `gemini-embedding-001` only supports one input at a time, which may slow down processing for large datasets

4. **Region Errors**
   - Make sure the selected region supports the chosen model
   - Default region is `us-central1`

5. **Dimension Errors**
   - Not all models support custom dimensions
   - Check model documentation for supported dimension values

6. **Connection Issues**
   - This is a sub-node and cannot be used standalone
   - Must be connected to a compatible root node (vector store, AI chain, etc.)

7. **Bad Request Errors with gemini-embedding-001**
   - This model only accepts one text input per request
   - The node automatically handles this limitation by processing texts individually
   - Consider using `text-embedding-004` or `text-multilingual-embedding-002` for better performance with multiple texts

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/danblah/n8n-nodes-google-vertex-embeddings-extended/issues).

## Changelog

### 0.3.2
- Fixed issue with gemini-embedding-001 model that only supports single input per request
- Added better error messages to show API response details
- Updated documentation about model limitations

### 0.3.1
- Fixed node structure to properly register as a sub-node in embeddings category
- Resolved issue where node was appearing as top-level instead of sub-node

### 0.3.0
- Switched to standard Google API credentials
- Added project ID dropdown with auto-loading
- Changed model selection to text input for flexibility
- Removed custom credentials requirement

### 0.2.0
- Converted to sub-node architecture for use with vector stores
- Improved compatibility with n8n AI nodes

### 0.1.0
- Initial release
- Support for Google Vertex AI embeddings
- Output dimensions configuration
- Task type selection 