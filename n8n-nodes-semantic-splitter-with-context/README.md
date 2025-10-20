# n8n-nodes-semantic-splitter-with-context

A production-ready n8n node that provides semantic text splitting with intelligent contextual enhancement. This node combines semantic double-pass merging with a Global Summary approach for optimal token efficiency and retrieval performance. **Zero external dependencies** - uses n8n's built-in LangChain modules for seamless integration.

## Features

- **Semantic Double-Pass Merging**: Uses embeddings to identify semantic boundaries and intelligently merges similar adjacent chunks
- **Global Summary Approach**: Generates one document summary and uses it to create specific context for each chunk (dramatically reduces API calls)
- **Dual Customizable Prompts**: Separate user-defined prompts for document summarization and chunk context generation
- **Multiple Threshold Methods**: Percentile, standard deviation, interquartile, and gradient-based breakpoint detection
- **Enhanced Size Constraints**: Sentence-boundary-aware splitting and merging with intelligent size management
- **Flexible Sentence Splitting**: Customizable regex patterns with safety fallbacks
- **Memory Leak Protection**: Instance and document caching prevent infinite retry loops and memory exhaustion
- **Production Ready**: Comprehensive error handling, payload validation, and visual feedback integration

## How It Works

1. **Document Input**: Receives documents from document loaders
2. **Global Summary Generation**: Creates a single document-level summary (1 API call per document)
3. **Semantic Splitting**: Splits text using semantic similarity analysis with intelligent double-pass merging
4. **Context Generation**: For each chunk, generates specific contextual description using the global summary + chunk (1 API call per chunk)
5. **Output Format**: Returns chunks in the format: `[chunk-specific context]\n\n[chunk content]`

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

### Dual Prompt Configuration

The node uses two separate prompts for optimal contextual enhancement:

**Summary Prompt** (for document-level summary):
```
Summarize the following document in 5-7 sentences, focusing on the main topics and concepts that would help retrieve relevant chunks.
```

**Context Prompt** (for chunk-specific context):
```
Using the document summary above, generate a brief contextual description that explains what this specific chunk covers and how it relates to the overall document. Focus on the unique aspects of this chunk. Keep it to 2-3 sentences and answer only with the context.
```

Both prompts are fully customizable. The document summary and chunk content are automatically provided in a structured format.

### Output Format

You can choose whether to include labels in the output:

- **Without Labels** (default): Clean output with just context and chunk content separated by line breaks
- **With Labels**: Includes "Context:" and "Chunk:" labels for clarity

### Configuration Options

#### Prompt Configuration
- **Summary Prompt**: Instructions for generating the global document summary
- **Context Prompt**: Instructions for generating chunk-specific context using the summary
- **Include Labels**: Whether to include "Context:" and "Chunk:" labels in the output

#### Splitting Options
- **Buffer Size**: Number of sentences to combine for context when creating embeddings (default: 1)
- **Breakpoint Threshold Type**: Method for determining chunk boundaries (percentile, standard deviation, interquartile, gradient)
- **Number of Chunks**: Target number of chunks to create (overrides threshold settings if set)
- **Second Pass Threshold**: Similarity threshold for merging chunks in the second pass (0-1, default: 0.8)
- **Min/Max Chunk Size**: Size constraints for generated chunks (default: 100-2000 characters)
- **Sentence Split Regex**: Pattern for splitting text into sentences (default: `(?<=[.?!])\\s+`)

## Example Workflow

```
[Document Loader] → [Semantic Splitter with Context] → [Vector Store]
                           ↑                    ↑
                    [Chat Model]        [Embeddings]
```

## Output Format

Each chunk is enhanced with contextual information generated using the Global Summary approach. With labels disabled (default):

```
Parents of Orange County teen Adam Raine and 153 other families urged Governor Gavin Newsom to sign AB 56 and AB 1064 after their children died by suicide linked to AI chatbots or harmful social media content.

SAN FRANCISCO, October 6, 2025 — The parents of Orange County teenager Adam Raine, who died by suicide after using an artificial intelligence (AI) chatbot, and 153 other parents whose children died related to their use of social media or AI, today called on Governor Gavin Newsom to sign into law two bills...
```

With labels enabled:

```
Context: Parents of Orange County teen Adam Raine and 153 other families urged Governor Gavin Newsom to sign AB 56 and AB 1064 after their children died by suicide linked to AI chatbots or harmful social media content.

Chunk: SAN FRANCISCO, October 6, 2025 — The parents of Orange County teenager Adam Raine, who died by suicide after using an artificial intelligence (AI) chatbot, and 153 other parents whose children died related to their use of social media or AI, today called on Governor Gavin Newsom to sign into law two bills...
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

- **Token Efficiency**: Global Summary approach reduces API calls from N to 1+N (1 summary + N contexts vs N full-document contexts)
- **Prompt Customization**: Adjust Summary Prompt for better document overviews, Context Prompt for better chunk descriptions
- **Chunk Control**: Use `numberOfChunks` for predictable output size, or threshold methods for semantic-driven splitting
- **Large Documents**: Node handles up to 10MB documents with automatic payload size validation
- **Debugging**: Set `N8N_NODES_DEBUG=1` to see detailed debug logs during development

## Changelog

### v0.6.0 - Global Summary Only (Breaking Change)
- 🔥 **Breaking**: Simplified to Global Summary approach only (no legacy modes)
- ✅ **New**: Dual prompt configuration (separate Summary and Context prompts)
- ✅ **New**: Enhanced size constraints with sentence-boundary awareness
- ✅ **New**: Instance and document caching to prevent memory leaks
- ✅ **New**: Payload size validation to prevent API errors
- ✅ **Improved**: Visual feedback integration matching n8n's built-in nodes
- ✅ **Improved**: Chat model response normalization (handles string/array/BaseMessage)
- ✅ **Improved**: Token efficiency (1+N API calls vs N full-document calls)
- ✅ **Fixed**: Connection type compatibility with n8n runtime
- ✅ **Fixed**: Endless summary generation bug

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