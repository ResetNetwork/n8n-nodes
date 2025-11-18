# n8n-nodes-mcp-client-extended

Extended MCP Client Tool for n8n with custom headers support for dynamic runtime configuration.

## Features

- **Custom Headers**: Pass custom headers as dynamic expressions at runtime
- **Full MCP Support**: All features from the built-in MCP Client Tool
- **Multiple Authentication Methods**: Bearer, Header, OAuth2, Multiple Headers
- **Dynamic Tool Loading**: Select specific tools or exclude unwanted ones
- **SSE & HTTP Streamable**: Support for both transport methods

## Installation

```bash
npm install n8n-nodes-mcp-client-extended
```

## Usage

### Custom Headers

The extended node adds a "Custom Headers" option that allows you to:

1. Add headers dynamically from expressions
2. Override authentication headers if needed
3. Pass context-specific headers based on workflow data

Example:

```javascript
// In the Custom Headers field, you can use expressions like:
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

## License

MIT

## Author

Reset Network

