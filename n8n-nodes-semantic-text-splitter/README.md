# @resettech/n8n-nodes-semantic-text-splitter


This is an n8n community node that provides a Semantic Double-Pass Merging text splitter for advanced document chunking in AI workflows.

## Description

The Semantic Double-Pass Merging Text Splitter is an advanced text splitting algorithm that uses embeddings to create semantically coherent chunks. It implements a two-pass approach:

1. **First Pass**: Splits text based on semantic similarity between sentences
2. **Second Pass**: Merges adjacent chunks that are semantically similar

This approach results in more coherent and contextually meaningful chunks compared to traditional character or token-based splitting methods.

## Features

- **Semantic-based splitting**: Uses embeddings to determine chunk boundaries
- **Double-pass merging**: Optimizes chunk coherence through a second merging pass
- **Flexible threshold options**: Multiple methods for determining split points
- **Size constraints**: Enforce minimum and maximum chunk sizes
- **Buffer context**: Include surrounding sentences for better embedding context
- **Customizable sentence splitting**: Configure how text is split into sentences

## Installation

### Community Nodes (Recommended)

1. Go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `@resettech/n8n-nodes-semantic-text-splitter` in the search field
4. Select **Install**

### Manual Installation

1. Navigate to your n8n installation's custom nodes folder:
   ```bash
   cd ~/.n8n/nodes
   ```
2. Clone this repository:
   ```bash
   git clone https://github.com/ResetNetwork/n8n-nodes.git
   cd n8n-nodes/n8n-nodes-semantic-text-splitter
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the node:
   ```bash
   npm run build
   ```
5. Restart n8n

## Usage

The Semantic Double-Pass Text Splitter node requires:
- An **Embeddings** input (e.g., OpenAI Embeddings, Google Gemini Embeddings)
- Either a **Document** input or **Text** input

### Node Parameters

#### Options

- **Buffer Size**: Number of sentences to include as context when creating embeddings (default: 1)
- **Breakpoint Threshold Type**: Method for determining chunk boundaries
  - Percentile: Use the 95th percentile of distances
  - Standard Deviation: Use mean + standard deviation
  - Interquartile: Use IQR method
  - Gradient: Find maximum gradient change
- **Breakpoint Threshold Amount**: Manual threshold override (0-1)
- **Number of Chunks**: Target number of chunks (overrides threshold)
- **Second Pass Threshold**: Similarity threshold for merging in second pass (0-1, default: 0.8)
- **Min Chunk Size**: Minimum characters per chunk (default: 100)
- **Max Chunk Size**: Maximum characters per chunk (default: 2000)
- **Sentence Split Regex**: Regular expression for sentence splitting

### Example Workflow

1. Add a **Document Loader** node (e.g., PDF, Text File)
2. Add an **Embeddings** node (e.g., OpenAI Embeddings)
3. Add the **Semantic Double-Pass Text Splitter** node
4. Connect:
   - Document Loader → Text Splitter (Document input)
   - Embeddings → Text Splitter (Embeddings input)
5. Connect the output to a Vector Store or further processing

## Algorithm Details

The algorithm works as follows:

1. **Sentence Splitting**: Text is split into sentences using a configurable regex
2. **Context Building**: Each sentence is combined with surrounding sentences based on buffer size
3. **Embedding Generation**: Embeddings are created for each contextualized sentence
4. **Distance Calculation**: Cosine distances between consecutive embeddings are calculated
5. **Breakpoint Detection**: Chunk boundaries are determined based on distance threshold
6. **Initial Chunking**: Text is split at detected breakpoints
7. **Second Pass Merging**: Adjacent chunks with high similarity are merged
8. **Size Constraints**: Chunks are adjusted to meet size requirements

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev

# Lint
npm run lint

# Format code
npm run format
```

## License

[MIT](LICENSE.md)

## Author

Reset Network - [https://github.com/ResetNetwork](https://github.com/ResetNetwork)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request to the [Reset Network n8n-nodes repository](https://github.com/ResetNetwork/n8n-nodes).

## Support

For issues and feature requests, please use the [GitHub issues page](https://github.com/ResetNetwork/n8n-nodes/issues). 