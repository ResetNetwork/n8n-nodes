#!/bin/bash

# cleanup-local.sh - Cleanup script to unlink custom n8n nodes
# This script removes the links created during local development setup

set -e  # Exit on error

echo "🧹 Cleaning up n8n custom nodes links..."

# Get the current directory
ROOT_DIR=$(pwd)

# Array of node directories
NODE_DIRS=(
    "n8n-nodes-contextual-document-loader"
    "n8n-nodes-google-gemini-embeddings-extended"
    "n8n-nodes-google-vertex-embeddings-extended"
    "n8n-nodes-semantic-splitter-with-context"
    "n8n-nodes-query-retriever-rerank"
)

# n8n custom directory
N8N_CUSTOM_DIR="$HOME/.n8n/custom"

# Unlink from n8n custom directory
if [ -d "$N8N_CUSTOM_DIR" ]; then
    echo "📦 Unlinking nodes from n8n..."
    cd "$N8N_CUSTOM_DIR"
    
    for dir in "${NODE_DIRS[@]}"; do
        if [ -d "$ROOT_DIR/$dir" ]; then
            # Extract package name from package.json
            PACKAGE_NAME=$(cd "$ROOT_DIR/$dir" && node -p "require('./package.json').name")
            echo "  Unlinking $PACKAGE_NAME..."
            npm unlink "$PACKAGE_NAME" 2>/dev/null || echo "    Already unlinked or not found"
        fi
    done
else
    echo "⚠️  n8n custom directory not found at $N8N_CUSTOM_DIR"
fi

# Return to root directory
cd "$ROOT_DIR"

# Remove global npm links
echo "🔗 Removing global npm links..."
for dir in "${NODE_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  Unlinking $dir..."
        cd "$ROOT_DIR/$dir"
        npm unlink 2>/dev/null || echo "    Already unlinked or not found"
    fi
done

# Return to root directory
cd "$ROOT_DIR"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📝 Note: The built files in dist/ directories are preserved."
echo "   Run 'npm run clean' in each node directory to remove them if needed." 