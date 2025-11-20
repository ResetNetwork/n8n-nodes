# n8n-nodes-sse-trigger-extended

![n8n.io - Workflow Automation](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

An extended Server-Sent Events (SSE) trigger node for n8n that adds support for custom headers and additional configuration options.

## Features

- 🔗 **Custom Headers Support**: Send custom headers with your SSE connection using key-value pairs or JSON format
- 🔐 **Standard n8n Authentication**: Seamless integration with n8n's built-in credential system
- 🔑 **Bearer Token Authentication**: Built-in support for JWT tokens and API keys
- 🗝️ **Header-based Authentication**: Flexible custom header authentication (e.g., x-api-key)
- 🔄 **Advanced Retry Logic**: Configurable retry attempts and delay for connection failures
- ⏱️ **Connection Timeout**: Configurable connection timeout with automatic reconnection
- 🌐 **Fetch-based Streaming**: Uses modern fetch API instead of EventSource for full header control
- 📊 **Enhanced Metadata**: Rich event metadata including timestamps, origin, and event IDs
- 🛡️ **Comprehensive Error Handling**: Detailed error reporting with retry information
- 🧪 **Built-in Test Server**: Included SSE test server for development and testing

## Installation

```bash
npm install n8n-nodes-sse-trigger-extended
```

## Usage

1. Add the "SSE Trigger Extended" node to your workflow
2. Configure the SSE endpoint URL
3. Choose your authentication method:
   - **None**: For public endpoints
   - **Bearer Auth**: For JWT/API token authentication
   - **Header Auth**: For custom header authentication (e.g., x-api-key)
4. If using authentication, select or create the appropriate n8n credential
5. Optionally enable custom headers and configure them using:
   - **Key-Value Pairs**: Add individual header name-value pairs
   - **JSON**: Provide headers as a JSON object
6. Configure advanced options like retry attempts and timeout
7. Activate the workflow to start listening for Server-Sent Events

## Configuration Options

### Basic Settings
- **SSE Endpoint**: The Server-Sent Events endpoint URL
- **Authentication**: Choose how to authenticate with the SSE endpoint (None, Bearer Auth, Header Auth)
- **Credentials**: Select the appropriate n8n credential when using authentication
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
    "origin": "https://example.com/events",
    "timestamp": "2025-06-17T12:00:00.000Z",
    "retry": 1000
  }
}
```

## Error Handling

If the SSE connection encounters errors or receives invalid JSON data, the node will output error information:

```json
{
  "error": "SSE connection failed after max retries",
  "details": "HTTP 401: Unauthorized",
  "$metadata": {
    "eventType": "error",
    "timestamp": "2025-06-17T12:00:00.000Z"
  }
}
```

## Use Cases

- **Real-time notifications**: Monitor chat applications, live feeds, or system alerts
- **Authenticated streaming**: Connect to secured SSE endpoints with Bearer tokens or API keys
- **API monitoring**: Process live events from APIs that require specific authentication headers
- **High-reliability streaming**: Handle intermittent connections with automatic retry logic
- **Development and testing**: Use the included test server for rapid prototyping

## Comparison with Standard SSE Trigger

| Feature | Standard SSE Trigger | SSE Trigger Extended |
|---------|---------------------|---------------------|
| Basic SSE connection | ✅ | ✅ |
| Custom headers | ❌ | ✅ |
| Standard n8n Credentials | ❌ | ✅ |
| HTTP Bearer Auth | ❌ | ✅ |
| HTTP Header Auth | ❌ | ✅ |
| Fetch-based streaming | ❌ | ✅ |
| Retry logic | ❌ | ✅ |
| Connection timeout | ❌ | ✅ |
| Enhanced metadata | ❌ | ✅ |
| Test server included | ❌ | ✅ |
| Error handling | Basic | Enhanced |

## Development

```bash
# Install dependencies
npm install

# Build the node
npm run build

# Watch for changes during development
npm run dev

# Start the test SSE server (optional)
node ../test-sse-server.js
```

### Test Server

The package includes a built-in SSE test server for development:

- **Endpoint**: `http://localhost:3001/events`
- **Authentication**: Supports both Bearer tokens and header-based auth
- **Test credentials**:
  - Bearer token: `test-token-456`
  - Header auth: `x-api-key: test-key-123`
- **Behavior**: Sends a message every 2 seconds with timestamp

```bash
# Test with Bearer token
curl -H "Authorization: Bearer test-token-456" http://localhost:3001/events

# Test with API key
curl -H "x-api-key: test-key-123" http://localhost:3001/events
```

## License

MIT

## Support

- **Issues**: [GitHub Issues](https://github.com/ResetNetwork/n8n-nodes/issues)
- **Documentation**: [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)