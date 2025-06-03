#!/bin/bash

# setup-local.sh - Setup script for local n8n node development
# This script builds and links all custom n8n nodes for local testing

set -e  # Exit on error

echo "🚀 Setting up n8n custom nodes for local development..."

# Check if n8n is installed
if ! command -v n8n &> /dev/null; then
    echo "❌ n8n is not installed globally. Installing n8n..."
    npm install n8n -g
else
    echo "✅ n8n is already installed"
fi

# Get the current directory
ROOT_DIR=$(pwd)

# Array of node directories
NODE_DIRS=(
    "n8n-nodes-contextual-document-loader"
    "n8n-nodes-semantic-text-splitter"
    "n8n-nodes-google-gemini-embeddings-extended"
    "n8n-nodes-google-vertex-embeddings-extended"
    "n8n-nodes-documentloader"
)

# Build and link each node
echo "📦 Building and linking nodes..."
for dir in "${NODE_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  Processing $dir..."
        cd "$ROOT_DIR/$dir"
        
        # Install dependencies
        echo "    Installing dependencies..."
        npm install
        
        # Build the node
        echo "    Building..."
        npm run build
        
        # Create global link
        echo "    Creating npm link..."
        npm link
        
        echo "  ✅ $dir ready"
    else
        echo "  ⚠️  Directory $dir not found, skipping..."
    fi
done

# Return to root directory
cd "$ROOT_DIR"

# Setup n8n custom directory
echo "🔧 Setting up n8n custom directory..."
N8N_CUSTOM_DIR="$HOME/.n8n/custom"

# Create custom directory if it doesn't exist
if [ ! -d "$N8N_CUSTOM_DIR" ]; then
    echo "  Creating $N8N_CUSTOM_DIR..."
    mkdir -p "$N8N_CUSTOM_DIR"
    cd "$N8N_CUSTOM_DIR"
    npm init -y
else
    echo "  Custom directory already exists"
    cd "$N8N_CUSTOM_DIR"
fi

# Link all nodes to n8n
echo "🔗 Linking nodes to n8n..."
for dir in "${NODE_DIRS[@]}"; do
    if [ -d "$ROOT_DIR/$dir" ]; then
        # Extract package name from package.json
        PACKAGE_NAME=$(cd "$ROOT_DIR/$dir" && node -p "require('./package.json').name")
        echo "  Linking $PACKAGE_NAME..."
        npm link "$PACKAGE_NAME"
    fi
done

# Return to root directory
cd "$ROOT_DIR"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Start n8n with: n8n start"
echo "  2. Open http://localhost:5678 in your browser"
echo "  3. Search for these nodes in the nodes panel:"
echo "     - Contextual Document Loader"
echo "     - Semantic Double-Pass Text Splitter"
echo "     - Google Gemini Embeddings Extended"
echo "     - Google Vertex Embeddings Extended"
echo "     - Document Loader"
echo ""
echo "💡 For development with auto-reload:"
echo "  - Run 'npm run dev' in any node directory"
echo "  - Restart n8n after making changes" 