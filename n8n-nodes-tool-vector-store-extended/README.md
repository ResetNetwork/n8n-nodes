# n8n-nodes-tool-vector-store-extended

This package provides an extended Vector Store Question Answer Tool for n8n with enhanced features and visual feedback support.

## Features

- **Extended Configuration Options**: More control over vector store querying
- **Visual Feedback**: Green connection lines, item counters, and completion indicators  
- **Custom Prompt Templates**: Define your own QA prompt structure
- **Multiple Chain Types**: Support for stuff, map-reduce, and refine chains
- **Source Document Citations**: Optionally return source documents with answers
- **Verbose Logging**: Debug chain execution with detailed logs
- **No External Dependencies**: Uses LangChain as peer dependency for cleaner installs

## Installation

```bash
npm install n8n-nodes-tool-vector-store-extended
```

## Usage

1. **Add the node** to your n8n workflow
2. **Connect a Vector Store** (like Pinecone, Qdrant, etc.) to the first input
3. **Connect a Language Model** (like OpenAI, Claude, etc.) to the second input  
4. **Configure the tool**:
   - **Name**: Identifier for the AI agent (e.g., "knowledge-base")
   - **Description**: What the tool does (helps the agent know when to use it)
   - **Max Results**: Number of documents to retrieve (1-50)
   - **Chain Type**: How to combine multiple documents
   - **Custom Prompt**: Override the default QA prompt template

## Extended Features vs Built-in Node

This extended version adds several features not available in n8n's built-in Vector Store Tool:

| Feature | Built-in | Extended |
|---------|----------|----------|
| Basic QA functionality | ✅ | ✅ |
| Visual feedback | ❌ | ✅ |
| Custom prompt templates | ❌ | ✅ |
| Multiple chain types | ❌ | ✅ |
| Source document citations | ❌ | ✅ |
| Verbose logging | ❌ | ✅ |
| Configurable result limits | ❌ | ✅ |
| No external dependencies | ❌ | ✅ |

## Configuration Options

### Basic Settings
- **Name**: Tool identifier for AI agents
- **Description**: Describes the tool's purpose and capabilities

### Advanced Options
- **Max Results (topK)**: Number of documents to retrieve (default: 4)
- **Return Source Documents**: Include source citations in responses
- **Chain Type**: 
  - `stuff`: Combine all documents in one prompt (fastest)
  - `map_reduce`: Summarize documents first, then combine
  - `refine`: Iteratively improve the answer
- **Custom Prompt Template**: Use `{context}` and `{question}` placeholders
- **Verbose Logging**: Enable detailed execution logs

## Example Custom Prompt

```
Based on the following documents, provide a comprehensive answer:

{context}

Question: {question}

Instructions:
- Be specific and cite relevant information
- If the answer isn't in the documents, say so
- Provide step-by-step guidance when applicable

Answer:
```

## Visual Feedback

This node provides the same visual feedback as n8n's built-in nodes:
- **Green connection lines** during execution
- **Item counters** showing processing progress  
- **Completion checkboxes** when tasks finish
- **Console logs** for debugging

## Development

```bash
# Clone the repository
git clone https://github.com/ResetNetwork/n8n-nodes.git
cd n8n-nodes/n8n-nodes-tool-vector-store-extended

# Install dependencies
npm install

# Build the node
npm run build

# Run in development mode
npm run dev
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/ResetNetwork/n8n-nodes/issues)
- **Documentation**: [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)

## Related Packages

- [`n8n-nodes-google-gemini-embeddings-extended`](https://www.npmjs.com/package/n8n-nodes-google-gemini-embeddings-extended) - Extended Google Gemini embeddings
- [`n8n-nodes-google-vertex-embeddings-extended`](https://www.npmjs.com/package/n8n-nodes-google-vertex-embeddings-extended) - Extended Google Vertex embeddings
- [`n8n-nodes-semantic-splitter-with-context`](https://www.npmjs.com/package/n8n-nodes-semantic-splitter-with-context) - Contextual text splitting