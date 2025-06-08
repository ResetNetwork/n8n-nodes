# Enhanced Query Retriever with ReRank Tool

This package provides a vector store retrieval tool for n8n with intelligent multi-query strategies, semantic reranking, and comprehensive debugging capabilities.

## Features

- **Multi-Query Strategy**: Generate and execute multiple query variations for comprehensive document retrieval
- **Intelligent Reranking**: Two-stage reranking system using custom embedding models for optimal relevance
- **Multiple Query Strategies**: Simple Query, Multi-Query, and None (documents only) options
- **Visual Feedback**: Integration with n8n's built-in progress indicators and status updates
- **Custom Prompt Templates**: Full control over query generation and answer formatting
- **Comprehensive Debugging**: Detailed execution metrics, timing information, and document flow tracking
- **Flexible Document Control**: Separate settings for documents to retrieve vs. documents to return
- **Source Document Citations**: Optional structured document metadata in responses

## Installation
### Community Nodes (Recommended)

1. Go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-semantic-splitter-with-context` in the search field
4. Select **Install**

### Prerequisites

- Node.js (version 18 or above)
- npm
- n8n installed globally or locally

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd n8n-nodes-semantic-splitter-with-context
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
npm link n8n-nodes-semantic-splitter-with-context
```

5. Start n8n:
```bash
n8n start
```

## Usage

1. **Add the node** to your n8n workflow
2. **Connect a Vector Store** (like Pinecone, Qdrant, etc.) to the first input
3. **Connect a Language Model** (like OpenAI, Claude, etc.) to the second input  
4. **Connect a Reranking Embeddings Model** to the third input (required for reranking)
5. **Configure the tool**:
   - **Name**: Tool identifier for AI agents (e.g., "knowledge-base")
   - **Description**: Purpose and capabilities description
   - **Query Strategy**: Choose between Simple Query, Multi-Query, or None
   - **Retrieval Options**: Set documents to retrieve (10) vs. documents to return (4)
   - **Custom Prompt Templates**: Override default query generation or answer templates
   - **Debugging**: Enable comprehensive execution insights

## Enhanced Features vs Built-in Node

This tool provides significant advances over n8n's built-in Vector Store Tool:

| Feature | Built-in | Enhanced |
|---------|----------|----------|
| Basic QA functionality | ✅ | ✅ |
| Multi-query strategies | ❌ | ✅ |
| Intelligent reranking | ❌ | ✅ |
| Two-stage document filtering | ❌ | ✅ |
| Custom embedding reranking | ❌ | ✅ |
| Comprehensive debugging | ❌ | ✅ |
| Query variation generation | ❌ | ✅ |
| Flexible document control | ❌ | ✅ |
| Performance timing metrics | ❌ | ✅ |
| Document movement tracking | ❌ | ✅ |
| Structured JSON responses | ❌ | ✅ |

## Configuration Options

### Basic Settings
- **Name**: Tool identifier for AI agents
- **Description**: Describes the tool's purpose and capabilities

### Query Strategy Options
- **Strategy Type**: 
  - `Simple Query`: Single query with immediate reranking (default)
  - `Multi-Query`: Generate multiple query variations for comprehensive retrieval
  - `None`: Return only ranked documents without generating answers
- **Query Variations**: Number of alternative queries to generate (2-8, default: 3)
- **Include Original Query**: Whether to search with the original query in addition to variations
- **Query Prompt Template**: Custom instructions for query generation or answer formatting

### Retrieval Options
- **Documents to Retrieve**: Initial number of documents to fetch per query (default: 10)
- **Documents to Return**: Final number of top-ranked documents to use (default: 4)
- **Return Ranked Documents**: Include structured document metadata in responses

### Advanced Options
- **Debugging**: Enable comprehensive execution metrics, timing, and document flow tracking

## Example Configurations

### Multi-Query Strategy Template
```
You are a research assistant generating diverse search queries to find comprehensive information about {query}. Create {count} different perspectives on this question to capture various aspects and terminologies.
```

### Answer Generation Template
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

### Example Debug Output
```json
{
  "answer": "The answer to your question...",
  "sourceDocuments": [...],
  "debug": {
    "strategy": "multi_query",
    "timing": {
      "queryGeneration": "250ms",
      "documentRetrieval": "800ms",
      "finalReranking": "400ms",
      "total": "1450ms"
    },
    "queryDetails": {
      "original": "What is machine learning?",
      "variations": ["How does ML work?", "What are ML algorithms?"],
      "documentsPerQuery": [8, 6, 7]
    },
    "documentFlow": {
      "totalRetrieved": 21,
      "afterDeduplication": 18,
      "finalCount": 4
    }
  }
}
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