# n8n-nodes-contextual-document-loader

This is an n8n community node that provides document loading with **Contextual Retrieval** support, implementing the technique described in [Anthropic's blog post](https://www.anthropic.com/news/contextual-retrieval). This node dramatically improves RAG (Retrieval-Augmented Generation) performance by adding context to document chunks before they are embedded.

## What is Contextual Retrieval?

Traditional RAG systems often fail because they split documents into chunks that lack sufficient context. For example, a chunk might say "The company's revenue grew by 3%" without specifying which company or time period.

Contextual Retrieval solves this by using an LLM to generate chunk-specific context that explains each chunk within the broader document. This context is prepended to the chunk before embedding, dramatically improving retrieval accuracy.

According to Anthropic's research, this technique can reduce retrieval failure rates by up to 67%.

## Features

- 🤖 **Automatic Context Generation**: Uses an LLM to generate contextual descriptions for each chunk
- 📄 **Flexible Text Splitting**: Works with any n8n text splitter node
- 🔄 **Batch Processing**: Processes chunks in configurable batches for efficiency
- 🔁 **Retry Logic**: Automatic retries for failed context generation
- 📊 **Rich Metadata**: Preserves original chunks and context in metadata
- 🎯 **Improved RAG Performance**: Significantly better retrieval accuracy

## Installation

### Community Node (Recommended)

1. In n8n, go to **Settings** > **Community Nodes**
2. Search for `n8n-nodes-contextual-document-loader`
3. Click **Install**

### Manual Installation

```bash
npm install n8n-nodes-contextual-document-loader
```

## Usage

### Important: How Document Loaders Work in n8n

The Contextual Document Loader is a **sub-node** that provides documents to other nodes. It cannot be used standalone and must be connected to nodes that accept document inputs.

### Compatible Nodes

The Contextual Document Loader works with:
- **Question and Answer Chain** - For RAG applications
- **Summarization Chain** - For document summarization
- **Other chain nodes** - That accept document inputs

### ⚠️ Simple Vector Store Limitation

The **Simple Vector Store** node in "insert" mode uses its own internal document loader and **does not use external document loaders**. This is why your Contextual Document Loader isn't being called when connected to a Simple Vector Store.

### Correct Usage Pattern

Here's how to properly use the Contextual Document Loader:

1. **With Question and Answer Chain:**
   ```
   [Data] → [QA Chain] ← [Contextual Document Loader]
                      ← [Embeddings]
                      ← [Chat Model]
   ```

2. **For Vector Store + Retrieval:**
   - First, use a regular document loader to insert into vector store
   - Then use the Contextual Document Loader with a retrieval chain

### Example Workflow

```json
{
  "nodes": [
    {
      "name": "Set Data",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "assignments": {
          "assignments": [{
            "name": "text",
            "value": "Your document content here"
          }]
        }
      }
    },
    {
      "name": "Contextual Document Loader",
      "type": "n8n-nodes-contextual-document-loader.contextualDocumentLoader",
      "parameters": {
        "contextPrompt": "Provide context for this chunk."
      }
    },
    {
      "name": "Question and Answer Chain",
      "type": "@n8n/n8n-nodes-langchain.chainRetrievalQa",
      "parameters": {
        "mode": "load"
      }
    }
  ]
}
```

## Configuration

### Context Prompt

The prompt used to generate contextual descriptions. The node automatically provides:
- The complete document in a `<document>` tag
- The current chunk in a `<chunk>` tag

Default prompt:
```
Please give a short succinct context to situate this chunk within the whole document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.
```

### Options

- **Batch Size**: Number of chunks to process in parallel (default: 10)
- **Context Prefix**: Text to prepend before the context (default: "Context: ")
- **Context Separator**: Separator between context and chunk (default: "\n\n")
- **Max Retries**: Maximum retry attempts for failed context generation (default: 3)
- **Metadata**: Additional metadata to add to all documents

## How It Works

1. **Document Input**: The node receives documents from the main input
2. **Text Splitting**: Documents are split into chunks using the connected text splitter
3. **Context Generation**: For each chunk, the LLM generates a contextual description
4. **Content Assembly**: Context is prepended to each chunk with the specified prefix and separator
5. **Output**: Enhanced documents with contextual information are output for further processing

### Example Output

Original chunk:
```
The company's revenue grew by 3% over the previous quarter.
```

Enhanced chunk with context:
```
Context: ACME Corporation Q2 2023 financial report discussing quarterly revenue performance.

The company's revenue grew by 3% over the previous quarter.
```

## Metadata

Each output document includes metadata:
- `chunkIndex`: The index of the chunk in the original document
- `originalChunk`: The original chunk text without context
- `hasContext`: Boolean indicating if context was successfully generated
- `context`: The generated context (if available)
- Any metadata from the input document

## Best Practices

1. **Choose the Right Model**: Use a capable model for context generation (GPT-4, Claude, etc.)
2. **Optimize Batch Size**: Adjust based on your rate limits and performance needs
3. **Custom Prompts**: Tailor the context prompt to your specific use case
4. **Monitor Costs**: Context generation adds LLM calls - monitor your usage

## Use Cases

- 📚 **Document Q&A**: Improve accuracy when answering questions about long documents
- 🔍 **Semantic Search**: Better search results in knowledge bases
- 📊 **Report Analysis**: Enhanced retrieval from financial reports, research papers
- 📖 **Book/Article Processing**: Maintain context across chapters and sections
- 🏢 **Enterprise Knowledge Management**: Better retrieval from company documents

## Troubleshooting

### No Context Generated
- Check your LLM connection and API limits
- Verify the model supports the required context length
- Check the error logs for specific failure reasons

### Performance Issues
- Reduce batch size for better rate limit handling
- Use a faster model for context generation
- Consider caching for repeated documents

## Example Workflow JSON

```json
{
  "nodes": [
    {
      "name": "Contextual Document Loader",
      "type": "n8n-nodes-contextual-document-loader.contextualDocumentLoader",
      "position": [500, 300],
      "parameters": {
        "contextPrompt": "Provide a brief context for this chunk within the document.",
        "options": {
          "batchSize": 5,
          "contextPrefix": "Context: ",
          "contextSeparator": "\n\n"
        }
      }
    }
  ]
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Credits

This node implements the Contextual Retrieval technique described in [Anthropic's blog post](https://www.anthropic.com/news/contextual-retrieval).

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/danblah/n8n-nodes-contextual-document-loader/issues). 