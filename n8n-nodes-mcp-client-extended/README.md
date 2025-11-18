# n8n-nodes-mcp-client-extended

✅ **WORKING!** Extended MCP Client Tool for n8n with custom headers support for dynamic runtime configuration.

## Features

- **✨ Custom Headers**: Pass custom headers as dynamic expressions at runtime
- **🔧 Full MCP Support**: All features from the built-in MCP Client Tool
- **🔐 Multiple Authentication Methods**: Bearer, Header, OAuth2, Multiple Headers
- **🎯 Dynamic Tool Loading**: Select specific tools or exclude unwanted ones
- **🌐 SSE & HTTP Streamable**: Support for both transport methods
- **🚀 All 24 Tools Available**: Works seamlessly with AI Agents

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

### Custom Headers

The extended node adds a "Custom Headers" option in the Options collection:

1. Enable "Enable Custom Headers"
2. Add headers as JSON in the "Custom Headers" field
3. Use expressions for dynamic values

Example:

```json
{
  "X-Request-ID": "{{ $json.requestId }}",
  "X-User-Context": "{{ $json.userId }}",
  "X-Custom-Header": "static-value"
}
```

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

- [ ] Fix Execute step button to enable direct tool testing
- [ ] Add support for tool input validation
- [ ] Enhance error messages for custom header issues
- [ ] Add header name validation

## License

MIT

## Author

Reset Network

