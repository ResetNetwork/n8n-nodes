#!/bin/bash

# start-n8n.sh - Start n8n with custom nodes
# This script checks if nodes are linked and starts n8n

echo "🚀 Starting n8n with custom nodes..."

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

# Enable debug logging
export N8N_LOG_LEVEL=debug
export N8N_LOG_OUTPUT=console

echo "📝 Starting n8n with debug logging enabled..."
echo "   URL: http://localhost:5678"
echo "   Log level: debug"
echo "   Press Ctrl+C to stop"
echo ""

# Start n8n
n8n start 