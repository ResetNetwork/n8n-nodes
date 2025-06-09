# Query Retriever with Rerank

An advanced n8n community node for intelligent document retrieval and question answering with multiple query strategies, reranking, and comprehensive debugging.

## Features

- **🧠 Multi-Strategy Architecture**: Four distinct query approaches for different use cases
- **🔄 Progressive Reasoning**: Multi-step query decomposition with context building
- **⚡ Intelligent Reranking**: Embeddings-based relevance scoring for improved results
- **🎯 Smart Early Stopping**: Automatic termination when sufficient information is gathered
- **🐛 Advanced Debugging**: Memory-based debug storage with optional AI analysis
- **🏗️ Modular Design**: Clean, extensible architecture (61% code reduction from refactoring)

## Installation

```bash
npm install n8n-nodes-query-retriever-rerank
```

## Usage

### Basic Setup
1. **Vector Store** (required): Connect your indexed document store
2. **LLM** (required): Language model for answer generation and reasoning
3. **Embed** (required): Embeddings model for document reranking
4. **Debug** (optional): Memory node for storing debug data

### Query Strategies

#### 🎯 **Simple Query**
Direct retrieval with intelligent reranking
- Retrieves documents using the original query
- Reranks results using embeddings similarity
- Generates answer from top-ranked documents
- **Best for**: Straightforward questions with clear intent

#### 🔀 **Multi-Query** 
Enhanced retrieval with query variations
- Generates multiple query variations using LLM
- Retrieves documents for each variation independently
- Combines and deduplicates results across all queries
- Applies final reranking against original query
- **Best for**: Complex questions that benefit from multiple perspectives

#### 🧠 **Multi-Step Query** ⭐ *NEW*
Progressive reasoning with context accumulation
- Breaks complex queries into sequential reasoning steps
- Each step builds on previous context and findings
- Intelligent early stopping when sufficient information is gathered
- Comprehensive synthesis from all reasoning steps
- **Best for**: Complex analytical questions requiring step-by-step reasoning

#### 📄 **None**
Document retrieval without answer generation
- Returns ranked documents without generating an answer
- **Best for**: Citation systems, document discovery, or custom processing

### Advanced Configuration

#### **Retrieval Options**
- **Documents to Retrieve**: Initial retrieval count (1-100, default: 10)
- **Documents to Return**: Final count after reranking (1-50, default: 4)
- **Return Ranked Documents**: Include source documents in response

#### **Multi-Query Options**
- **Query Variations**: Number of alternative queries (2-8, default: 3)
- **Include Original Query**: Add original to variations (default: true)

#### **Multi-Step Options** ⭐ *NEW*
- **Max Reasoning Steps**: Sequential reasoning limit (1-8, default: 3)
- **Enable Early Stopping**: Stop when sufficient info gathered (default: true)

#### **Prompt Customization**
- **Query Prompt Template**: Custom templates for answer generation or query generation

### Debugging & Performance Analysis

#### **Memory-Based Debug Storage** ⭐ *NEW*
Connect a memory node to store comprehensive debug data:
- **System Performance**: Detailed timing for each operation
- **Strategy Effectiveness**: Analysis of chosen approach
- **Document Flow**: Tracking of retrieval and reranking
- **Step-by-Step Analysis**: For multi-step queries, see each reasoning step
- **AI-Generated Insights**: Optional LLM analysis of performance data

#### **Debug Configuration**
- **Debugging**: Enable comprehensive metrics collection
- **LLM Debug Analysis**: Generate AI-powered performance insights (⚠️ slower)

#### **What You'll Find in Debug Data**
```json
{
  "strategy": "multi_step_query",
  "timing": {
    "step_1": "17626ms",
    "step_2": "37228ms", 
    "finalSynthesis": "15219ms",
    "total": "70074ms"
  },
  "queryDetails": {
    "original": "your question",
    "stoppedEarly": true,
    "stoppedAtStep": 2
  },
  "stepResults": [
    {
      "step": 1,
      "subQuery": "generated sub-question",
      "documentsRetrieved": 5,
      "stepAnswer": "intermediate answer..."
    }
  ]
}
```

## Strategy Selection Guide

| Use Case | Recommended Strategy | Why |
|----------|---------------------|-----|
| Simple facts | **Simple Query** | Direct and efficient |
| Complex topics | **Multi-Query** | Multiple perspectives |
| Analytical research | **Multi-Step Query** | Progressive reasoning |
| Document discovery | **None** | Just the documents |

## Architecture

**Modular Strategy System:**
```
QueryRetrieverRerank/
├── strategies/           # Individual query strategies
│   ├── SimpleQueryStrategy.ts
│   ├── MultiQueryStrategy.ts  
│   ├── MultiStepQueryStrategy.ts ⭐ NEW
│   └── NoneStrategy.ts
├── shared/              # Reusable utilities
│   ├── debugging.ts     # Debug data management
│   ├── reranking.ts     # Document reranking logic
│   └── types.ts         # Shared interfaces
└── QueryRetrieverRerank.node.ts  # Clean orchestration
```

## Performance

**Intelligent Optimizations:**
- **Embeddings Reranking**: Improves relevance over distance-based similarity
- **Document Deduplication**: Prevents redundant content across strategies
- **Early Stopping**: Reduces unnecessary processing in multi-step queries
- **Memory Debugging**: Persistent analysis without performance impact (when disabled)

## Requirements

- **n8n**: Workflow automation platform
- **Vector Store**: Pre-indexed document collection
- **Language Model**: For answer generation and reasoning
- **Embeddings Model**: For document reranking
- **Memory Node**: (Optional) For debug data storage

## Development

**Adding New Strategies:**
1. Create new strategy file in `strategies/`
2. Extend `BaseStrategy` class
3. Register in `strategies/index.ts`
4. Zero changes to main node required!

## License

MIT

---

*Built with a modular architecture for maximum extensibility and maintainability. The multi-step reasoning capability brings sophisticated analytical processing to n8n workflows.*