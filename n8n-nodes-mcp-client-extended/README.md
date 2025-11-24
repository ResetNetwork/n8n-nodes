# n8n-nodes-mcp-client-extended

✅ **WORKING!** Extended MCP Client Tool for n8n with custom headers support for dynamic runtime configuration.

## Features

- **✨ Custom Headers**: Pass custom headers as dynamic expressions at runtime
- **🎯 Dynamic Tool Filtering**: Control which tools are available based on workflow data with rule-based filtering
- **🔧 Full MCP Support**: All features from the built-in MCP Client Tool
- **🔐 Multiple Authentication Methods**: Bearer, Header, OAuth2, Multiple Headers
- **📋 Smart Tool Selection**: Select specific tools or exclude unwanted ones
- **🌐 SSE & HTTP Streamable**: Support for both transport methods
- **🚀 Seamless Integration**: Works seamlessly with AI Agents

## Installation

For local development:
```bash
cd /path/to/n8n-nodes
./cleanup-local.sh && ./setup-local.sh
```

For npm installation:
```bash
npm install n8n-nodes-mcp-client-extended
```

## Usage

### Dynamic Tool Filtering

Control which tools are available to the AI Agent based on workflow data using rule-based filtering:

1. Click **"Add Tool Filtering"** to enable dynamic filtering
2. Set **Default Behavior**: What to do when no rule matches
3. Add **Evaluation Expression**: Expression that returns a value to match against rules
   - Example: `{{ $json.team }}` or `{{ $json.role }}`
4. Add **Tool Access Rules**: Define which tools to expose for different values
   - **Match Values**: Comma-separated values to match (e.g., `dev,ext-dev,admin`)
   - **Rule Action**: Include Specific Tools, Include All Tools, or Exclude All Tools
   - **Tools**: Select specific tools when using "Include Specific Tools"

#### Example: Team-Based Access Control

```
Evaluation Expression: {{ $json.team }}

Rule 1:
  Match Values: dev,ext-dev
  Action: Include Specific Tools
  Tools: search_code, read_file, write_file

Rule 2:
  Match Values: admin
  Action: Include All Tools

Rule 3:
  Match Values: guest
  Action: Exclude All Tools

Default Behavior: Use Base Mode Filter
```

**Result:**
- `{ team: "dev" }` → Gets search_code, read_file, write_file
- `{ team: "admin" }` → Gets all tools
- `{ team: "guest" }` → Gets no tools
- `{ team: "other" }` → Falls back to base mode (Tools to Include setting)

### Custom Headers

The extended node adds a "Custom Headers" option in the Options collection:

1. Add headers using the "Add Header" button
2. Specify header name and value
3. Use expressions for dynamic values

Example headers:
- Name: `X-Request-ID`, Value: `{{ $json.requestId }}`
- Name: `X-User-Context`, Value: `{{ $json.userId }}`
- Name: `X-Custom-Header`, Value: `static-value`

### Authentication

All standard authentication methods are supported:
- None
- Bearer Auth
- Header Auth
- Multiple Headers Auth
- MCP OAuth2

Custom headers are merged with authentication headers, with custom headers taking precedence.

## Technical Implementation

### Key Architecture Decisions

To work with n8n's AI Agents while being a community node:

1. **Lazy Loading**: @langchain modules loaded dynamically at runtime using `import()`
2. **DynamicTool**: Uses simple string I/O (not DynamicStructuredTool with schemas)
3. **Array Return**: Returns tools array directly, not wrapped in Toolkit
4. **Peer Dependencies**: All @langchain deps are peer-only, resolved from n8n
5. **No node_modules**: Build process removes node_modules to prevent loader conflicts

This ensures tools are created from n8n's @langchain module instances and serialize correctly.

## Known Limitations

### Execute Step Button

The "Execute step" testing/debugging button is currently disabled (`usableAsTool: false`). This feature requires additional work to ensure the `tool.invoke()` method is properly preserved through our tool wrapping mechanism.

**Workaround:** Test tools directly through the AI Agent or use the built-in MCP Client Tool for testing individual tools.

**Status:** Planned for future enhancement

## Roadmap

- [x] Dynamic tool filtering with rule-based access control
- [x] Custom headers support with expressions
- [ ] Fix Execute step button to enable direct tool testing
- [ ] Add support for tool input validation
- [ ] Enhance error messages for custom header issues
- [ ] Add header name validation

## License

MIT

## Author

Reset Network

