#!/bin/bash

# test-sse-integration.sh - Quick test of the SSE integration

echo "🧪 Testing SSE server integration..."
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if dependencies exist
if [ ! -d "node_modules/express" ]; then
    echo "📦 Installing dependencies..."
    npm install express cors
fi

echo "🚀 Starting SSE test server..."
node test-sse-server.js > sse-test.log 2>&1 &
TEST_PID=$!

# Wait for server to start
sleep 2

echo "🔍 Testing endpoints..."

# Test health endpoint
echo "1. Health check:"
curl -s http://localhost:3001/health | jq -r '.status' 2>/dev/null || echo "  ❌ Health check failed"

# Test auth
echo "2. Authentication test:"
AUTH_RESULT=$(curl -s -H "x-api-key: test-key-123" http://localhost:3001/test | jq -r '.success' 2>/dev/null)
if [ "$AUTH_RESULT" = "true" ]; then
    echo "  ✅ Authentication working"
else
    echo "  ❌ Authentication failed"
fi

# Test SSE stream (3 seconds)
echo "3. SSE stream test (5 seconds):"
SSE_OUTPUT=$(timeout 5 curl -s -H "x-api-key: test-key-123" -N http://localhost:3001/events 2>/dev/null || true)
if echo "$SSE_OUTPUT" | grep -q "Test message"; then
    echo "  ✅ SSE streaming working"
    MESSAGE_COUNT=$(echo "$SSE_OUTPUT" | grep -c "Test message" || echo "0")
    echo "  📊 Received $MESSAGE_COUNT messages"
else
    echo "  ❌ SSE streaming failed"
fi

echo ""
echo "🎯 n8n Configuration for SSE Trigger Extended:"
echo "   URL: http://localhost:3001/events"
echo "   Headers: x-api-key = test-key-123"
echo "   Expected: New message every 2 seconds"
echo ""

# Cleanup
echo "🧹 Cleaning up test..."
kill $TEST_PID 2>/dev/null
rm -f sse-test.log

echo "✅ Test complete! Use ./start-n8n.sh to start both n8n and SSE server together."