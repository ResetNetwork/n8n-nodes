# n8n-nodes-sse-trigger-extended

![n8n.io - Workflow Automation](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

An extended Server-Sent Events (SSE) trigger node for n8n that adds support for custom headers and additional configuration options.

## Features

- 🔗 **Custom Headers Support**: Send custom headers with your SSE connection using key-value pairs or JSON format
- 🔄 **Retry Logic**: Configurable retry attempts and delay for connection failures
- 🔐 **Credentials Support**: Option to include credentials with SSE requests
- ⏱️ **Connection Timeout**: Configurable connection timeout
- 📊 **Enhanced Metadata**: Additional event metadata including timestamps and origin information
- 🛡️ **Error Handling**: Improved error handling with detailed error information

## Installation

```bash
npm install n8n-nodes-sse-trigger-extended
```

## Usage

1. Add the "SSE Trigger Extended" node to your workflow
2. Configure the SSE endpoint URL
3. Optionally enable custom headers and configure them using:
   - **Key-Value Pairs**: Add individual header name-value pairs
   - **JSON**: Provide headers as a JSON object
4. Configure additional options like retry attempts, timeout, and credentials
5. Activate the workflow to start listening for Server-Sent Events

## Configuration Options

### Basic Settings
- **URL**: The Server-Sent Events endpoint URL
- **Authentication**: Choose how to authenticate with the SSE endpoint
- **Send Custom Headers**: Add additional headers beyond authentication

### Authentication Options

#### None
No authentication - for public SSE endpoints

#### Bearer Token
Uses the standard n8n **HTTP Bearer Auth** credential:
- Automatically adds `Authorization: Bearer <token>` header
- Secure token storage in n8n's credential system
- Compatible with JWT tokens, API tokens, etc.

#### Header Auth
Uses the standard n8n **HTTP Header Auth** credential:
- Send any custom header name/value pair
- Perfect for API keys (e.g., `x-api-key`, `api-key`)
- Flexible header-based authentication

### Custom Headers (Always Available)
Additional headers that can be used with any authentication method:
- **Send Custom Headers**: Enable/disable additional custom headers
- **Specify Headers**: Choose between key-value pairs or JSON format
- **Header Parameters**: Define individual headers using name/value fields

### Advanced Options
- **With Credentials**: Include credentials in the SSE connection
- **Connection Timeout**: Set connection timeout in milliseconds (default: 30000)
- **Retry Attempts**: Number of retry attempts on connection failure (default: 3)
- **Retry Delay**: Delay between retry attempts in milliseconds (default: 1000)

## Output

The node outputs the received SSE event data along with enhanced metadata:

```json
{
  "eventData": "your SSE event data",
  "$metadata": {
    "eventType": "message",
    "lastEventId": "123",
    "origin": "https://example.com",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Error Handling

If the SSE connection encounters errors or receives invalid JSON data, the node will output error information:

```json
{
  "error": "Error description",
  "rawData": "raw event data (if applicable)",
  "$metadata": {
    "eventType": "error",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Use Cases

- Connect to authenticated SSE endpoints requiring custom headers
- Monitor real-time data streams with enhanced reliability
- Process live events from APIs that require specific authentication headers
- Handle high-frequency SSE connections with retry logic

## Comparison with Standard SSE Trigger

| Feature | Standard SSE Trigger | SSE Trigger Extended |
|---------|---------------------|---------------------|
| Basic SSE connection | ✅ | ✅ |
| Custom headers | ❌ | ✅ |
| Standard n8n Credentials | ❌ | ✅ |
| HTTP Bearer Auth | ❌ | ✅ |
| HTTP Header Auth | ❌ | ✅ |
| Retry logic | ❌ | ✅ |
| Connection timeout | ❌ | ✅ |
| Enhanced metadata | ❌ | ✅ |
| Error handling | Basic | Enhanced |

## Development

```bash
# Install dependencies
npm install

# Build the node
npm run build

# Watch for changes during development
npm run dev

# Run linting
npm run lint

# Fix linting issues
npm run lintfix
```

## License

MIT

## Support

- **Issues**: [GitHub Issues](https://github.com/ResetNetwork/n8n-nodes/issues)
- **Documentation**: [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)