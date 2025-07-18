#!/bin/bash

# start-n8n.sh - Start n8n with custom nodes
# This script checks if nodes are linked and starts n8n

echo "🚀 Starting n8n with custom nodes and SSE test server..."

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if n8n is installed
if ! command -v n8n &> /dev/null; then
    echo "❌ n8n is not installed. Please run ./setup-local.sh first"
    exit 1
fi

# Check if custom directory exists
N8N_CUSTOM_DIR="$HOME/.n8n/custom"
if [ ! -d "$N8N_CUSTOM_DIR" ]; then
    echo "❌ n8n custom directory not found. Please run ./setup-local.sh first"
    exit 1
fi

# Check if any nodes are linked
cd "$N8N_CUSTOM_DIR"
if [ ! -f "package.json" ] || [ -z "$(npm ls --depth=0 --link=true 2>/dev/null | grep -E 'n8n-nodes-')" ]; then
    echo "⚠️  No custom nodes appear to be linked."
    echo "   Run ./setup-local.sh to set up the nodes"
    echo ""
fi

# Return to original directory
cd - > /dev/null

# Check if SSE test server dependencies are installed
cd "$SCRIPT_DIR"
if [ ! -d "node_modules/express" ]; then
    echo "📦 Installing SSE test server dependencies..."
    npm install express cors > /dev/null 2>&1
fi

# Start SSE test server in background
echo "🌐 Starting SSE test server on port 3001..."
SSE_LOG_FILE="$SCRIPT_DIR/sse-server.log"
SSE_PID_FILE="$SCRIPT_DIR/sse-server.pid"

# Kill existing SSE server if running
if [ -f "$SSE_PID_FILE" ]; then
    SSE_PID=$(cat "$SSE_PID_FILE" 2>/dev/null)
    if [ -n "$SSE_PID" ] && kill -0 "$SSE_PID" 2>/dev/null; then
        echo "   Stopping existing SSE server (PID: $SSE_PID)..."
        kill "$SSE_PID" 2>/dev/null
        sleep 1
    fi
fi

# Start new SSE server
node test-sse-server.js > "$SSE_LOG_FILE" 2>&1 &
SSE_PID=$!
echo $SSE_PID > "$SSE_PID_FILE"

# Wait a moment for the server to start
sleep 2

# Check if SSE server started successfully
if kill -0 "$SSE_PID" 2>/dev/null; then
    echo "   ✅ SSE test server started (PID: $SSE_PID)"
    echo "   📡 SSE endpoint: http://localhost:3001/events"
    echo "   🔑 Auth headers: x-api-key=test-key-123 OR authorization=Bearer test-token-456"
    echo "   📄 Server logs: $SSE_LOG_FILE"
else
    echo "   ❌ Failed to start SSE test server"
    echo "   📄 Check logs: $SSE_LOG_FILE"
fi

echo ""

# Enable debug logging
export N8N_LOG_LEVEL=debug
export N8N_LOG_OUTPUT=console
export CODE_ENABLE_STDOUT=true

echo "📝 Starting n8n with debug logging enabled..."
echo "   n8n URL: http://localhost:5678"
echo "   Log level: debug"
echo "   Press Ctrl+C to stop both n8n and SSE server"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    
    # Stop SSE server
    if [ -f "$SSE_PID_FILE" ]; then
        SSE_PID=$(cat "$SSE_PID_FILE" 2>/dev/null)
        if [ -n "$SSE_PID" ] && kill -0 "$SSE_PID" 2>/dev/null; then
            echo "   Stopping SSE server (PID: $SSE_PID)..."
            kill "$SSE_PID" 2>/dev/null
        fi
        rm -f "$SSE_PID_FILE"
    fi
    
    echo "   Services stopped. Goodbye! 👋"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Start n8n
n8n start 