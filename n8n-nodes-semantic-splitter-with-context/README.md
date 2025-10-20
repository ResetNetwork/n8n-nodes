# n8n-nodes-semantic-splitter-with-context

A custom n8n node that provides semantic text splitting with contextual enhancement using n8n's built-in LangChain integration. This node combines semantic double-pass merging with AI-generated contextual descriptions for improved retrieval performance. **Now with zero external dependencies** - uses n8n's built-in LangChain modules for seamless integration.

## Features

- **Semantic Double-Pass Merging**: Uses embeddings to identify semantic boundaries and merges similar adjacent chunks implementing the technique described in [Konrad Rucinski post](https://bitpeak.com/chunking-methods-in-rag-methods-comparison/)
- **Contextual Enhancement**: Generates contextual descriptions for each chunk using a chat model implementing the technique described in [Anthropic's post](https://www.anthropic.com/news/contextual-retrieval) and inspired by Jim Le's [workflow](https://community.n8n.io/t/building-the-ultimate-rag-setup-with-contextual-summaries-sparse-vectors-and-reranking/54861)
- **Customizable Prompts**: User-defined prompts for context generation
- **Multiple Threshold Methods**: Percentile, standard deviation, interquartile, and gradient-based breakpoint detection
- **Enhanced Size Constraints**: Sentence-boundary-aware splitting and merging with intelligent size management
- **Flexible Sentence Splitting**: Customizable regex patterns with safety fallbacks for invalid expressions
- **Global Summary**: Generate one document-level summary and reuse it for all chunks (dramatically reduces API calls)
- **Memory Leak Protection**: Instance caching and payload size validation prevent infinite retry loops
- **Production Ready**: Comprehensive error handling and resource management for stable operation

## How It Works

1. **Document Input**: Receives documents from document loaders
2. **Semantic Splitting**: Splits text by using semantic similarity analysis with intelligent merging
3. **Context Generation**: For each chunk, generates a contextual description using the chat model
   - Option 1: Generate specific context per chunk using full document
   - Option 2: Generate one global summary and reuse for all chunks (efficient for large documents)
4. **Output Format**: Returns chunks in the format: `[context]\n\n[chunk]`

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

### Dependencies

This node uses n8n's built-in LangChain integration. The package declares LangChain as peer dependencies to ensure type compatibility, but at runtime n8n provides the required modules. You typically do not need to install additional LangChain packages yourself when using this node inside n8n.

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

1. In n8n, search for "Semantic Splitter with Context" in the nodes panel
2. Drag the node into your workflow
3. Connect required inputs:
   - **Chat Model**: For generating contextual descriptions
   - **Embeddings**: For semantic similarity analysis
4. Configure the context prompt and options as needed

### Context Prompt

The context prompt is the instruction given to the AI model for generating contextual descriptions. The default prompt is:

```
Please generate a short succinct context summary to situate this text chunk within the overall document to enhance search retrieval, two or three sentences max. The chunk contains merged content from different document sections, so focus on the main topics and concepts rather than sequential flow. Answer only with the succinct context and nothing else.
```

The document and chunk content are automatically provided to the AI model in a structured format. You only need to customize the instructions for how the context should be generated.

### Output Format

You can choose whether to include labels in the output:

- **Without Labels** (default): Clean output with just context and chunk content separated by line breaks
- **With Labels**: Includes "Context:" and "Chunk:" labels for clarity

### Configuration Options

#### Basic Options
- **Buffer Size**: Number of sentences to combine for context when creating embeddings (default: 1)
- **Breakpoint Threshold Type**: Method for determining chunk boundaries (percentile, standard deviation, interquartile, gradient)
- **Second Pass Threshold**: Similarity threshold for merging chunks in the second pass (0-1, default: 0.8)
- **Min/Max Chunk Size**: Size constraints for generated chunks (default: 100-2000 characters)
- **Sentence Split Regex**: Pattern for splitting text into sentences (default: `(?<=[.?!])\\s+`)

#### Advanced Options
- **Use Global Summary**: Generate a single document summary and reuse it for all chunks (dramatically reduces API calls)
- **Global Summary Prompt**: Custom instruction for generating the global summary (default: document overview in 5-7 sentences)

## Example Workflow

```
[Document Loader] → [Semantic Splitter with Context] → [Vector Store]
                           ↑                    ↑
                    [Chat Model]        [Embeddings]
```

## Output Format

Each chunk is enhanced with contextual information. With labels disabled (default):

```
This section discusses the company's financial performance in Q2 2023.

The company's revenue grew by 3% over the previous quarter, reaching $314 million. This growth was primarily attributed to our SaaS offerings, which saw a 15% increase in subscriptions.
```

With labels enabled:

```
Context: This section discusses the company's financial performance in Q2 2023.

Chunk: The company's revenue grew by 3% over the previous quarter, reaching $314 million. This growth was primarily attributed to our SaaS offerings, which saw a 15% increase in subscriptions.
```

## Benefits

- **Improved Retrieval**: Contextual descriptions help with more accurate search results
- **Semantic Coherence**: Chunks maintain semantic meaning through intelligent boundary detection and merging
- **Token Efficiency**: Global summary option dramatically reduces API costs for large documents
- **Production Stability**: Memory leak protections and payload validation prevent system crashes
- **Flexible Configuration**: Adaptable to different document types and use cases
- **RAG Optimization**: Designed specifically for Retrieval-Augmented Generation workflows

## Performance & Limitations

### Size Limits
- **Maximum Document Size**: 10MB (10,000,000 characters)
- **Maximum Prompt Size**: 100KB per API call (prevents PayloadTooLargeError)
- **Recommended Document Size**: <50KB for optimal performance without global summary

### Memory Management
- **Instance Caching**: Prevents memory leaks during retries (max 10 cached instances)
- **Document Caching**: Global summaries cached per document (max 5 documents)
- **Fast Failure**: Large documents fail quickly with actionable error messages
- **Resource Optimization**: Global summary dramatically reduces memory and token usage

## Tips

- **For Large Documents**: Enable "Use Global Summary" to reduce token usage and prevent payload errors
- **For Token Efficiency**: Global Summary can reduce API calls from 100+ to 1 per document
- **For Debugging**: Set `N8N_NODES_DEBUG=1` to see detailed debug logs during development
- **For Production**: Monitor document sizes and consider pre-processing very large files

## Changelog

### v0.5.1 - Production Stability & Global Summary
- ✅ **New**: Global Summary option with document-level caching (reduces API calls from N to 1 per document)
- ✅ **New**: Enhanced size constraints with sentence-boundary awareness  
- ✅ **New**: Instance caching to prevent memory leaks during retries
- ✅ **New**: Payload size validation to prevent API errors
- ✅ **Improved**: Chat model response normalization (handles string/array/BaseMessage)
- ✅ **Improved**: Regex safety with automatic fallbacks
- ✅ **Fixed**: Constructor options wiring (all user settings now work correctly)
- ✅ **Fixed**: Connection type compatibility with n8n runtime
- ✅ **Fixed**: Endless summary generation bug (Global Summary now works correctly)

### v0.4.1 - Stability Improvements
- ✅ **Fixed**: TypeScript compatibility with newer n8n versions
- ✅ **Fixed**: Debug logging can be disabled in production
- ✅ **Updated**: Documentation links point to package README

### v0.3.0 - Zero External Dependencies
- ✅ **Breaking Change**: Removed external LangChain dependencies
- ✅ **Improved**: Now uses n8n's built-in LangChain modules
- ✅ **Enhanced**: Better compatibility with n8n Cloud
- ✅ **Faster**: No external package installation required
- ✅ **Reliable**: Dependencies managed by n8n core team

### v0.2.2 - Previous Version
- Used external `@langchain/core` and `@langchain/textsplitters` dependencies

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 