#!/bin/bash

# cleanup-local.sh - Cleanup script to unlink custom n8n nodes
# This script removes the links created during local development setup

set -e  # Exit on error

echo "🧹 Cleaning up n8n custom nodes links, symlinks and old builds..."

# Get the current directory
ROOT_DIR=$(pwd)

# Stop SSE test server if running
SSE_PID_FILE="$ROOT_DIR/sse-server.pid"
if [ -f "$SSE_PID_FILE" ]; then
    SSE_PID=$(cat "$SSE_PID_FILE" 2>/dev/null)
    if [ -n "$SSE_PID" ] && kill -0 "$SSE_PID" 2>/dev/null; then
        echo "🛑 Stopping SSE test server (PID: $SSE_PID)..."
        kill "$SSE_PID" 2>/dev/null
        sleep 1
    fi
    rm -f "$SSE_PID_FILE"
    echo "   ✅ SSE test server stopped"
fi

# Clean up log files
if [ -f "$ROOT_DIR/sse-server.log" ]; then
    rm -f "$ROOT_DIR/sse-server.log"
    echo "   ✅ SSE server logs cleaned"
fi

# Array of node directories
NODE_DIRS=(
    "n8n-nodes-contextual-document-loader"
    "n8n-nodes-google-gemini-embeddings-extended"
    "n8n-nodes-google-vertex-embeddings-extended"
    "n8n-nodes-semantic-splitter-with-context"
    "n8n-nodes-query-retriever-rerank"
    "n8n-nodes-mcp-client-extended"
    "n8n-nodes-sse-trigger-extended"
    "n8n-nodes-recursive-language-model"
)

# n8n custom directory
N8N_CUSTOM_DIR="$HOME/.n8n/custom"

# Unlink from n8n custom directory and remove symlinks
if [ -d "$N8N_CUSTOM_DIR" ]; then
    echo "📦 Unlinking nodes from n8n and removing symlinks..."
    cd "$N8N_CUSTOM_DIR"

    for dir in "${NODE_DIRS[@]}"; do
        if [ -d "$ROOT_DIR/$dir" ]; then
            PACKAGE_NAME=$(cd "$ROOT_DIR/$dir" && node -p "require('./package.json').name")
            if [ -n "$PACKAGE_NAME" ]; then
                echo "  Unlinking $PACKAGE_NAME..."
                npm unlink "$PACKAGE_NAME" 2>/dev/null || true
                # Remove direct symlink if it exists
                if [ -L "node_modules/$PACKAGE_NAME" ] || [ -d "node_modules/$PACKAGE_NAME" ]; then
                    rm -rf "node_modules/$PACKAGE_NAME"
                    echo "    Removed symlink node_modules/$PACKAGE_NAME"
                fi
            fi
        fi
    done
else
    echo "⚠️  n8n custom directory not found at $N8N_CUSTOM_DIR"
fi

# Return to root directory
cd "$ROOT_DIR"

# Remove global npm links and local builds
echo "🔗 Removing global npm links and local dist builds..."
for dir in "${NODE_DIRS[@]}"; do
    if [ -d "$ROOT_DIR/$dir" ]; then
        echo "  Cleaning $dir..."
        cd "$ROOT_DIR/$dir"
        npm unlink 2>/dev/null || true
        # Remove dist/ and build logs to avoid stale code
        rm -rf dist build.log 2>/dev/null || true
    fi
done

# Return to root directory
cd "$ROOT_DIR"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📝 Note: All dist/ directories and build logs were removed to prevent stale builds."