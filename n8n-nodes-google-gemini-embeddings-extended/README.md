# n8n-nodes-google-gemini-embeddings-extended

This is an n8n community sub-node that provides Google Gemini Embeddings with extended features, including support for output dimensions, task types, and special handling for models like `gemini-embedding-001`.

## Features

- Support for any Google Gemini embedding model (specify by name)
- **Output dimensions configuration** (for supported models)
- **Task type specification** for optimized embeddings
- **Title support** for retrieval documents
- **Batch size control** for rate limit management
- **Special handling for gemini-embedding-001** (single input per request)
- Uses standard Google API credentials (same as other Google AI nodes)
- Works as a sub-node with vector stores and other AI nodes

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

Enter any valid Google Gemini embedding model name. Examples:
- `text-embedding-004` (Latest, supports output dimensions)
- `gemini-embedding-001` (Supports output dimensions, processes one input at a time)
- `embedding-001` (Legacy model)

#### Output Dimensions

For models that support it, you can specify the number of output dimensions:

- Set to `0` to use the model's default dimensions
- Set to a specific number (e.g., `256`, `768`, `3072`) to get embeddings of that size

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
- **Batch Size**: Control how many texts are processed at once (default: 100)

## Use Cases

- **Semantic Search**: Generate embeddings for documents and queries in vector stores
- **RAG Applications**: Build retrieval-augmented generation systems
- **Document Similarity**: Find similar documents in your vector database
- **Multi-language Support**: Use models that support multiple languages
- **Code Search**: Use CODE_RETRIEVAL_QUERY for searching code repositories

## Model-Specific Notes

### gemini-embedding-001

This model has special requirements:
- Only accepts **one text input per request**
- The node automatically handles this limitation
- Processing may be slower for large datasets
- Supports output dimensions up to 3072

### text-embedding-004

- Supports batch processing
- Default dimensions: 768
- Good balance of performance and quality

## Differences from Official n8n Node

This community node extends the official Google Gemini Embeddings node with:

1. **Output Dimensions Support**: Configure the size of embedding vectors
2. **Extended Task Types**: More task type options for optimization
3. **Title Support**: Add titles to documents for better retrieval
4. **Batch Size Control**: Manage rate limits effectively
5. **Better Error Messages**: More detailed error information

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
   - Reduce the batch size in options
   - Add delays between requests if processing large datasets

4. **Dimension Errors**
   - Not all models support custom dimensions
   - Check model documentation for supported dimension values

5. **Bad Request Errors**
   - `gemini-embedding-001` only accepts one input at a time (handled automatically)
   - Ensure text inputs are within token limits

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/danblah/n8n-nodes-google-gemini-embeddings-extended/issues).

## Changelog

### 0.1.0
- Initial release
- Support for Google Gemini embeddings via API
- Output dimensions configuration
- Task type selection with extended options
- Title support for documents
- Batch size control
- Special handling for gemini-embedding-001 