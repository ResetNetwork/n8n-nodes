# n8n-nodes-semantic-splitter-with-context

A custom n8n node that provides semantic text splitting with contextual enhancement using n8n's built-in LangChain integration. This node combines semantic double-pass merging with AI-generated contextual descriptions for improved retrieval performance. **Now with zero external dependencies** - uses n8n's built-in LangChain modules for seamless integration.

## Features

- **Semantic Double-Pass Merging**: Uses embeddings to identify semantic boundaries and merges similar adjacent chunks implementing the technique described in [Konrad Rucinski post](https://bitpeak.com/chunking-methods-in-rag-methods-comparison/)
- **Contextual Enhancement**: Generates contextual descriptions for each chunk using a chat model implementing the technique described in [Anthropic's post](https://www.anthropic.com/news/contextual-retrieval) and inspired by Jim Le's [workflow](https://community.n8n.io/t/building-the-ultimate-rag-setup-with-contextual-summaries-sparse-vectors-and-reranking/54861)
- **Customizable Prompts**: User-defined prompts for context generation
- **Multiple Threshold Methods**: Percentile, standard deviation, interquartile, and gradient-based breakpoint detection
- **Size Constraints**: Configurable minimum and maximum chunk sizes
- **Flexible Sentence Splitting**: Customizable regex patterns for sentence detection

## How It Works

1. **Document Input**: Receives documents from document loaders
2. **Semantic Splitting**: Splits text by using semantic similarity analysis
3. **Context Generation**: For each chunk, generates a contextual description using the chat model
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
Please generate a short succinct context summary to situate this text chunk within the overall document to enhance search retrieval, two or three sentances max. The chunk contains merged content from different document sections, so focus on the main topics and concepts rather than sequential flow. Answer only with the succinct context and nothing else.
```

The document and chunk content are automatically provided to the AI model in a structured format. You only need to customize the instructions for how the context should be generated.

### Output Format

You can choose whether to include labels in the output:

- **Without Labels** (default): Clean output with just context and chunk content separated by line breaks
- **With Labels**: Includes "Context:" and "Chunk:" labels for clarity

### Configuration Options

- **Buffer Size**: Number of sentences to combine for context when creating embeddings
- **Breakpoint Threshold Type**: Method for determining chunk boundaries
- **Second Pass Threshold**: Similarity threshold for merging chunks in the second pass
- **Min/Max Chunk Size**: Size constraints for generated chunks
- **Sentence Split Regex**: Pattern for splitting text into sentences

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
- **Semantic Coherence**: Chunks maintain semantic meaning through intelligent boundary detection
- **Flexible Configuration**: Adaptable to different document types and use cases
- **RAG Optimization**: Designed specifically for Retrieval-Augmented Generation workflows

## Changelog

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