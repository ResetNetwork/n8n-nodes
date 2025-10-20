# n8n-nodes-google-gemini-embeddings-extended

This is an n8n community sub-node that provides Google Gemini Embeddings with extended features, including support for task types, titles, and optimized handling for different Google embedding models.

## Features

- Support for any Google Gemini embedding model (dynamically loaded from Google's API)
- **Task type specification** for optimized embeddings (RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY, etc.)
- **Title support** for retrieval documents (improves embedding quality)
- **Optimized API handling** using official @google/genai library
- Uses standard Google API credentials (same as other Google AI nodes)
- Works as a sub-node with vector stores and other AI nodes
- Clean, production-ready implementation

## Installation

### Community Node (Recommended)

1. In n8n, go to **Settings** > **Community Nodes**
2. Search for `n8n-nodes-google-gemini-embeddings-extended`
3. Click **Install**

### Manual Installation

```bash
npm install n8n-nodes-google-gemini-embeddings-extended
```

## Setup

### Prerequisites

1. A Google AI Studio account
2. A Gemini API key

### Authentication

This node uses the standard Google PaLM/Gemini API credentials:

1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. In n8n, create **Google PaLM API** credentials
3. Enter your API key

## Usage

This is a **sub-node** that provides embeddings functionality to other n8n AI nodes.

### Using with Vector Stores

1. Add a vector store node to your workflow (e.g., Pinecone, Qdrant, Supabase Vector Store)
2. Connect the **Embeddings Google Gemini Extended** node to the embeddings input of the vector store
3. Configure your Google PaLM API credentials
4. Enter your model name (e.g., `text-embedding-004`, `gemini-embedding-001`)
5. Configure additional options as needed
6. The vector store will use these embeddings to process your documents

### Example Workflow

```
[Document Loader] → [Vector Store] ← [Embeddings Google Gemini Extended]
                          ↓
                    [AI Agent/Chain]
```

### Configuration Options

#### Model Name

Select any valid Google Gemini embedding model from the dropdown (dynamically loaded from Google's API). Examples:
- `text-embedding-004` (Latest model, 768 default dimensions)
- `gemini-embedding-001` (Advanced model, 3072 default dimensions)
- `embedding-001` (Legacy model, 768 default dimensions)

#### Task Types

Optimize your embeddings by specifying the task type:

- **Retrieval Document**: For document storage in retrieval systems
- **Retrieval Query**: For search queries
- **Semantic Similarity**: For comparing text similarity
- **Classification**: For text classification tasks
- **Clustering**: For grouping similar texts
- **Question Answering**: For Q&A systems
- **Fact Verification**: For fact-checking applications
- **Code Retrieval Query**: For code search

#### Additional Options

- **Title**: Add a title to documents (only for RETRIEVAL_DOCUMENT task type)
- **Strip New Lines**: Remove line breaks from input text (enabled by default)

## Use Cases

- **Semantic Search**: Generate embeddings for documents and queries in vector stores
- **RAG Applications**: Build retrieval-augmented generation systems
- **Document Similarity**: Find similar documents in your vector database
- **Multi-language Support**: Use models that support multiple languages
- **Code Search**: Use CODE_RETRIEVAL_QUERY for searching code repositories

## Model-Specific Notes

### gemini-embedding-001

- Advanced model with 3072 default dimensions
- High-quality embeddings for complex use cases
- Optimized for semantic similarity and retrieval tasks

### text-embedding-004

- Supports batch processing
- Default dimensions: 768
- Good balance of performance and quality

## Differences from Official n8n Node

This community node extends the official Google Gemini Embeddings node with:

1. **Extended Task Types**: More task type options for embedding optimization
2. **Title Support**: Add titles to documents for better retrieval quality
3. **Official Library**: Uses @google/genai library for better compatibility
4. **Model Flexibility**: Dynamic model loading from Google's available models
5. **Production Ready**: Clean implementation with optional debug logging

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
   - Ensure your Google PaLM API key is valid
   - Check that the API is enabled in your Google Cloud project
   - Verify you have sufficient quota

2. **Model Errors**
   - Verify the model name is spelled correctly
   - Check [Google's documentation](https://ai.google.dev/gemini-api/docs/models/gemini#text-embedding) for valid model names

3. **Rate Limit Errors**
   - Add delays between requests if processing large datasets
   - Check your Google API quota and rate limits

4. **Bad Request Errors**
   - Ensure text inputs are within token limits
   - Verify model names are valid and available

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/danblah/n8n-nodes-google-gemini-embeddings-extended/issues).

## Changelog

### 0.1.2
- Version bump for republishing to ensure package visibility

### 0.1.1
- Updated all dependencies to latest versions
- Fixed TypeScript compatibility issues
- Updated ESLint configuration for ESLint 9.x
- Updated `@langchain/google-genai` from 0.0.23 to 0.2.10
- Updated `n8n-workflow` peer dependency to match current version (1.82.0)
- Improved build stability and security

### 0.1.0
- Initial release
- Support for Google Gemini embeddings via API
- Output dimensions configuration
- Task type selection with extended options
- Title support for documents
- Batch size control
- Special handling for gemini-embedding-001 