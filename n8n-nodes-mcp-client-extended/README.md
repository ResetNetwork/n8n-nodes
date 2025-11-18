# n8n-nodes-mcp-client-extended

This is an n8n community node that provides an **extended MCP (Model Context Protocol) Client** with support for **dynamic headers at execution time**.

This node extends the standard MCP Client functionality to allow you to set custom headers dynamically for each request, similar to how the HTTP Request node works in n8n.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Features

- **Dynamic Headers**: Set custom headers at execution time using expressions
- **Multiple Authentication Methods**: Support for Bearer, Header Auth, OAuth2, and Multiple Headers Auth
- **Transport Options**: Choose between HTTP Streamable and SSE (Server-Sent Events)
- **Tool Filtering**: Select specific tools to include or exclude
- **Flexible Configuration**: Headers can be converted to lowercase automatically
- **Expression Support**: All header values support n8n expressions for dynamic values

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### npm

```bash
npm install n8n-nodes-mcp-client-extended
```

### Manual Installation

1. Clone or download this repository
2. Navigate to the package directory
3. Run `npm install` to install dependencies
4. Run `npm run build` to build the node
5. Link the package to your n8n installation:
   ```bash
   npm link
   cd ~/.n8n/nodes
   npm link n8n-nodes-mcp-client-extended
   ```

## Operations

This node allows you to:

1. **Connect to MCP Servers** with custom headers
2. **Call MCP Tools** with dynamic parameters
3. **Filter Tools** based on include/exclude lists
4. **Authenticate** using various methods

## Node Parameters

### Connection Settings

- **Endpoint**: The URL of your MCP server
- **Server Transport**: Choose between HTTP Streamable (default) or SSE
- **Authentication**: Select authentication method (None, Bearer, Header Auth, OAuth2, Multiple Headers)

### Dynamic Headers

- **Send Headers**: Enable to add custom headers
- **Header Parameters**: Add name/value pairs for headers
  - Supports n8n expressions in values (e.g., `{{ $json.apiKey }}`)
  - Headers can be set dynamically per execution

### Tool Configuration

- **Tool Name**: Name of the MCP tool to call
- **Tool Arguments**: JSON object with arguments for the tool
- **Tools to Include**: Filter which tools are available
  - **All**: Include all tools from the server
  - **Selected**: Only include specified tools
  - **All Except**: Include all except specified tools

### Options

- **Timeout**: Maximum time (in ms) to wait for tool execution (default: 60000)
- **Lowercase Headers**: Convert all header names to lowercase (default: true)

## Usage Examples

### Basic Example with Static Headers

```javascript
// Set up the node with:
Endpoint: https://mcp.example.com/api
Send Headers: true
Header Parameters:
  - Name: X-API-Key
    Value: your-api-key-here
  - Name: X-Custom-Header
    Value: custom-value
Tool Name: search_documents
Tool Arguments: {"query": "example search"}
```

### Dynamic Headers from Previous Node

```javascript
// If previous node output contains headers:
{
  "apiKey": "dynamic-key-123",
  "userId": "user-456"
}

// Configure headers with expressions:
Header Parameters:
  - Name: Authorization
    Value: Bearer {{ $json.apiKey }}
  - Name: X-User-ID
    Value: {{ $json.userId }}
```

### Using Multiple Authentication Methods

The node supports combining credential-based authentication with dynamic headers:

1. Select an authentication method (e.g., Bearer Auth)
2. Configure credentials as normal
3. Enable "Send Headers" to add additional headers
4. The authentication header and custom headers will be merged

## Comparison with Standard MCP Client

| Feature | Standard MCP Client | MCP Client Extended |
|---------|-------------------|-------------------|
| Basic MCP connection | ✓ | ✓ |
| Authentication | ✓ | ✓ |
| Tool filtering | ✓ | ✓ |
| **Dynamic headers** | ✗ | **✓** |
| **Expression-based values** | ✗ | **✓** |
| **Per-execution customization** | ✗ | **✓** |

## Use Cases

1. **API Key Rotation**: Pass different API keys per execution based on previous node data
2. **Multi-tenant Applications**: Set tenant-specific headers dynamically
3. **Rate Limiting**: Add request IDs or tracking headers per execution
4. **Testing**: Easily test different header configurations without changing node configuration
5. **Conditional Headers**: Use n8n expressions to set headers based on workflow logic

## Development

```bash
# Install dependencies
npm install

# Build the node
npm run build

# Watch mode for development
npm run dev

# Lint
npm run lint

# Format code
npm run format
```

## Compatibility

- Requires n8n version 1.25.1 or higher
- Compatible with @modelcontextprotocol/sdk v1.0.2+

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [MCP SDK on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)

## License

[MIT](LICENSE)

## Support

For issues, feature requests, or contributions, please visit the [GitHub repository](https://github.com/ResetNetwork/n8n-nodes).

## Version History

### 0.1.0 (Initial Release)

- Initial release with dynamic headers support
- Support for HTTP Streamable and SSE transports
- Multiple authentication methods
- Tool filtering capabilities
- Expression support in header values
