# Query Retriever with Rerank

An n8n community node for advanced vector store question answering with intelligent reranking capabilities.

## Features

- **Multi-Strategy Retrieval**: Simple query, multi-query with variations, or document-only retrieval
- **Intelligent Reranking**: Uses embeddings to rerank documents for improved relevance
- **Modular Architecture**: Clean, efficient codebase with ~160 lines of code reduction
- **AI-Powered Debugging**: Comprehensive performance analysis when debugging is enabled

## Installation

```bash
npm install n8n-nodes-query-retriever-rerank
```

## Usage

### Basic Setup
1. Connect a Vector Store (required)
2. Connect a Chat Model (required) 
3. Connect Embeddings for reranking (required)
4. Configure retrieval and strategy options

### Strategy Types

**Simple Query**: Single query with reranking
- Retrieves documents using the original query
- Reranks results using embeddings similarity
- Generates answer from top-ranked documents

**Multi-Query**: Enhanced retrieval with query variations
- Generates multiple query variations using the language model
- Retrieves documents for each variation
- Combines and deduplicates results
- Applies final reranking against original query
- Generates answer from best documents

**None**: Document retrieval only
- Returns ranked documents without generating an answer
- Useful for citation systems or further processing

### Debugging

Enable debugging in Advanced Options to get comprehensive performance analysis:

- **What it does**: Sends detailed execution metrics and AI-generated analysis to the connected language model
- **Where to find it**: Check the Chat Model node's execution input/output logs
- **What you'll see**: 
  - System performance timing
  - Strategy effectiveness analysis
  - Document flow and reranking impact
  - Optimization recommendations

**To view debug analysis:**
1. Enable debugging in QueryRetriever settings
2. Run your workflow  
3. Go to the Chat Model node
4. View execution data → inputs/outputs
5. Look for "QUERY RETRIEVER DEBUG ANALYSIS" entries

### Configuration Options

**Retrieval Options:**
- Documents to Retrieve: Initial retrieval count (default: 10)
- Documents to Return: Final document count after reranking (default: 4)
- Return Ranked Documents: Include source documents in response

**Query Strategy Options:**
- Strategy Type: Choose retrieval approach
- Query Variations: Number of alternative queries for multi-query (2-8)
- Include Original Query: Add original query to multi-query search
- Prompt Template: Custom templates for answer generation or query generation

**Advanced Options:**
- Debugging: Enable performance analysis sent to language model

## Performance

The modular reranking system provides:
- Efficient document processing
- Intelligent relevance scoring
- Comprehensive debugging insights
- Clean separation of concerns

## Requirements

- n8n workflow environment
- Vector store with indexed documents
- Language model for answer generation
- Embeddings model for reranking

## License

MIT