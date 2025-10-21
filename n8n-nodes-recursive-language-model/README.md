# n8n-nodes-recursive-language-model

This is an n8n community node that implements **Recursive Language Models (RLM)** - a pattern for processing unbounded context through recursive LM calls within a REPL environment.

Based on the research paper: [Recursive Language Models](https://alexzhang13.github.io/blog/2025/rlm/) by Alex Zhang and Omar Khattab.

## What is RLM?

Recursive Language Models allow LLMs to:
- Process extremely large contexts (10M+ tokens) without context rot
- Recursively call themselves to decompose and analyze data
- Write and execute code in a REPL environment
- Dynamically choose retrieval strategies at runtime

The key innovation: Instead of passing huge contexts to the LM, the LM writes JavaScript code that processes context stored in variables, making recursive sub-queries as needed.

## Installation

```bash
npm install n8n-nodes-recursive-language-model
```

Or install directly in n8n:
1. Go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-recursive-language-model`

## Node: Recursive Language Model

An AI Tool node that acts like an agent internally but outputs as a tool to parent agents.

### Inputs

1. **LLM** (required) - Chat model for root LM and recursive calls
2. **Tools** (optional, multiple) - AI tools for retrieval (vector search, query tools, etc.)
3. **Memory** (optional) - For storing execution traces
4. **Context** (optional) - Pre-load context data (< 50MB recommended)

### How It Works

```
User Query → Parent Agent → RLM Tool
                               ├─ Root LM writes JavaScript code
                               ├─ Code executes in REPL sandbox
                               ├─ Can call connected tools: vectorSearch()
                               ├─ Can recurse: rlm(subQuery, subContext)
                               └─ Returns FINAL(answer)
```

### Example Workflows

#### Pattern 1: Post-Retrieval Synthesis

```
[Vector Store] → [Query Retriever Tool] → [RLM Tool] → [AI Agent]
                                              ↑
                              [Chat Model] ──┘
```

The RLM receives many documents from retrieval and recursively processes them to avoid context rot.

#### Pattern 2: Iterative Retrieval

```
[Vector Store] ──┐
                 ├─ [Query Tool] ──┐
[Chat Model] ────┼──────────────────┼─→ [RLM Tool] → [AI Agent]
                 └─ [Keyword Tool] ─┘
```

The RLM can call tools multiple times with refined queries based on what it learns.

#### Pattern 3: Direct Context Processing

```
[File Reader] → [RLM Tool] → [AI Agent]
                    ↑
    [Chat Model] ──┘
```

For smaller contexts, the RLM processes them directly using code.

### Configuration

#### Tool Options
- **Tool Name**: Identifier for the tool (e.g., `document_analyzer`)
- **Tool Description**: What the tool does (shown to parent agent)

#### REPL Options
- **Max Iterations**: Safety limit for code execution loops (default: 20)
- **Output Truncation**: Max output length returned to LM (default: 5000 chars)
- **Iteration Timeout**: Timeout per code execution (default: 60s)

#### Recursion Options
- **Max Recursion Depth**: How many levels of rlm() calls allowed (default: 1)
  - 0 = Root LM only, no recursion
  - 1 = Root + one level of recursive calls (paper's approach)
  - 2+ = Deeper recursion (experimental)

#### Context Options
- **Max Context Size**: Maximum pre-loaded context size (default: 10M chars)
- **Context Variable Name**: Variable name in REPL (default: `context`)

#### Advanced Options
- **Enable Debugging**: Store execution trace in Memory node

### REPL Environment

The root LM has access to a JavaScript REPL with:

**Built-in Functions:**
```javascript
rlm(query, context)      // Recursive LM call
FINAL(answer)            // Return final answer
FINAL_VAR(varName)       // Return variable as answer
```

**Connected Tools** (if any):
```javascript
vectorSearch(query, k)   // Your connected vector search tool
queryRetriever(query)    // Your connected query tool
// ... any other connected AI tools
```

**Standard JavaScript**:
```javascript
JSON, String, Array, Object, Math, console
```

**Variables**:
```javascript
context  // Pre-loaded context (if provided)
// ... any variables you create
```

### Example LM Behavior

When the parent agent calls the RLM tool with "What are the main findings?", the root LM might write:

```javascript
// Strategy 1: Small context, work directly
if (context && context.length < 100000) {
  const sections = context.split('\n\n');
  const summaries = [];
  for (const section of sections.slice(0, 10)) {
    const summary = await rlm("extract key findings", section);
    summaries.push(summary);
  }
  FINAL(summaries.join('\n'));
}

// Strategy 2: Large context, use tools
const docs = await vectorSearch("main findings methodology", 30);
const topDocs = docs.slice(0, 5);
const synthesis = await rlm("synthesize findings from these documents", topDocs);
FINAL(synthesis);

// Strategy 3: Hybrid
const candidates = await queryRetriever("key findings");
const verified = candidates.filter(c => context.includes(c.text));
const answer = await rlm("summarize verified findings", verified);
FINAL(answer);
```

## Comparison to Standard Agent

| Feature | Standard Agent | RLM Tool |
|---------|---------------|----------|
| Tool calling | JSON function calling | Executable code |
| Iteration | Predefined loop | Code-driven REPL |
| Context | All in LM window | Stored in variables |
| Recursion | None | Built-in rlm() |
| Connected to | Chat nodes | Other agents (as tool) |

## Key Benefits

1. **Avoid Context Rot**: Process 10M+ tokens without degradation
2. **LM-Driven Strategy**: LM decides how to decompose context at runtime
3. **Flexible Integration**: Works with vector stores, document loaders, any AI tools
4. **Memory Efficient**: Aligns with n8n's sub-workflow pattern for memory management
5. **Programmatic Control**: Code gives LM more power than function calling

## Limitations

1. **Latency**: Multiple LM calls can be slow (not optimized for speed yet)
2. **Cost**: Each recursive call costs tokens
3. **Requires Code-Capable Models**: Works best with GPT-4, Claude, etc.
4. **Memory Limits**: Respect n8n Docker memory constraints (< 50MB between nodes)
5. **No Async**: Recursive calls are blocking (future optimization)

## Comparison to Paper

**Same as paper:**
- ✅ Root LM writes code in REPL environment
- ✅ Recursive rlm() calls at depth=1
- ✅ FINAL() / FINAL_VAR() pattern
- ✅ Context-centric decomposition

**Different from paper:**
- Uses JavaScript instead of Python (n8n is Node.js based)
- Integrates with n8n's AI tool ecosystem
- Supports on-demand retrieval via connected tools (in addition to pre-loaded context)
- Uses vm2 sandbox instead of Python REPL

## Use Cases

- **Long Document Q&A**: Process 500-page reports without context rot
- **Multi-Hop Reasoning**: Search → analyze → refine query → search again
- **Post-Retrieval Synthesis**: Combine 50+ retrieved documents intelligently
- **Structured Data Processing**: Parse and analyze large JSON/CSV datasets
- **Code Analysis**: Process large codebases or diffs

## Resources

- [RLM Paper](https://alexzhang13.github.io/blog/2025/rlm/)
- [GitHub Implementation](https://github.com/alexzhang13/rlm)
- [n8n AI Documentation](https://docs.n8n.io/advanced-ai/)

## License

MIT

## Contributing

Contributions welcome! Please open issues or PRs on the GitHub repository.

