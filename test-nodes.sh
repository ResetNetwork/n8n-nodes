#!/bin/bash

# test-nodes.sh - Test script to verify n8n can load custom nodes
# This script starts n8n briefly and checks if custom nodes are loaded

echo "🧪 Testing n8n custom nodes loading..."

# Set environment variables for testing
export N8N_CUSTOM_EXTENSIONS="$HOME/.n8n/custom"

# Start n8n in the background and capture output
echo "🚀 Starting n8n to test node loading..."
if command -v timeout >/dev/null 2>&1; then
    timeout 10s n8n start > n8n_test_output.log 2>&1 &
else
    n8n start > n8n_test_output.log 2>&1 &
fi
N8N_PID=$!

# Wait a bit for n8n to start
sleep 8

# Kill n8n
kill -TERM $N8N_PID 2>/dev/null || true
sleep 2
kill -KILL $N8N_PID 2>/dev/null || true
wait $N8N_PID 2>/dev/null || true

echo "📋 Checking n8n startup logs for custom nodes..."

# Check if our custom nodes were loaded
NODES_FOUND=0

if grep -q "n8n-nodes-contextual-document-loader" n8n_test_output.log; then
    echo "  ✅ Contextual Document Loader found"
    ((NODES_FOUND++))
fi

if grep -q "n8n-nodes-semantic-splitter-with-context" n8n_test_output.log; then
    echo "  ✅ Semantic Splitter with Context found"
    ((NODES_FOUND++))
fi

if grep -q "n8n-nodes-google-gemini-embeddings-extended" n8n_test_output.log; then
    echo "  ✅ Google Gemini Embeddings Extended found"
    ((NODES_FOUND++))
fi

if grep -q "n8n-nodes-google-vertex-embeddings-extended" n8n_test_output.log; then
    echo "  ✅ Google Vertex Embeddings Extended found"
    ((NODES_FOUND++))
fi


if grep -q "n8n-nodes-query-retriever-rerank" n8n_test_output.log; then
    echo "  ✅ Query Retriever with Rerank found"
    ((NODES_FOUND++))
fi

if grep -q "n8n-nodes-mcp-client-extended" n8n_test_output.log; then
    echo "  ✅ MCP Client Extended found"
    ((NODES_FOUND++))
fi

if grep -q "n8n-nodes-sse-trigger-extended" n8n_test_output.log; then
    echo "  ✅ SSE Trigger Extended found"
    ((NODES_FOUND++))
fi

if grep -q "n8n-nodes-recursive-language-model" n8n_test_output.log; then
    echo "  ✅ Recursive Language Model found"
    ((NODES_FOUND++))
fi

# Check for any loading errors
if grep -i "error" n8n_test_output.log | grep -v "No encryption key" | grep -v "SIGTERM"; then
    echo "⚠️  Potential errors found in logs:"
    grep -i "error" n8n_test_output.log | grep -v "No encryption key" | grep -v "SIGTERM" | head -5
fi

echo ""
echo "📊 Test Results:"
echo "  Nodes detected in logs: $NODES_FOUND/8"

if [ $NODES_FOUND -eq 8 ]; then
    echo "  🎉 All nodes appear to be loading correctly!"
elif [ $NODES_FOUND -gt 0 ]; then
    echo "  ⚠️  Some nodes may not be loading properly"
else
    echo "  ❌ No custom nodes detected in logs"
fi

echo ""
echo "📝 Full log saved to: n8n_test_output.log"
echo "💡 To view full logs: cat n8n_test_output.log"
echo ""
echo "🚀 To start n8n normally: n8n start" 