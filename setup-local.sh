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

# Get the current directory (absolute path)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "📁 Working from: $ROOT_DIR"

# Array of node directories
NODE_DIRS=(
    "n8n-nodes-contextual-document-loader"
    "n8n-nodes-google-gemini-embeddings-extended"
    "n8n-nodes-google-vertex-embeddings-extended"
    "n8n-nodes-semantic-splitter-with-context"
    "n8n-nodes-query-retriever-rerank"
    "n8n-nodes-sse-trigger-extended"
)

# Function to check and fix package structure
check_and_fix_package() {
    local dir="$1"
    echo "    Checking package structure for $dir..."
    
    # Check if package.json has main field
    local has_main=$(node -p "require('./package.json').main ? 'true' : 'false'" 2>/dev/null)
    if [ "$has_main" = "false" ]; then
        echo "    Adding missing 'main' field to package.json..."
        # Add main field after publishConfig
        sed -i '' 's/"publishConfig": {/"publishConfig": {\
    "access": "public"\
  },\
  "main": "index.js",/' package.json
    fi
    
    # Check if index.js exists
    if [ ! -f "index.js" ]; then
        echo "    Creating missing index.js file..."
        echo "// This file is required for n8n to load the node package" > index.js
        echo "module.exports = {};" >> index.js
    fi
    
    return 0
}

# Function to check if a node builds successfully
check_build() {
    local dir="$1"
    echo "    Checking build for $dir..."
    if npm run build > build.log 2>&1; then
        echo "    ✅ Build successful"
        return 0
    else
        echo "    ⚠️  Build failed. Showing last 40 lines of build.log:"
        tail -n 40 build.log || true
        echo "    ⚠️  Attempting to install common missing dependencies..."
        # Try to install common missing dependencies
        npm install @types/node @langchain/google-genai --save-dev > /dev/null 2>&1 || true
        if npm run build >> build.log 2>&1; then
            echo "    ✅ Build successful after installing dependencies"
            return 0
        else
            echo "    ❌ Build still failing, skipping this node"
            echo "    ℹ️  See $ROOT_DIR/$dir/build.log for full details"
            return 1
        fi
    fi
}

# Build and link each node
echo "📦 Building and linking nodes..."
SUCCESSFUL_NODES=()

for dir in "${NODE_DIRS[@]}"; do
    if [ -d "$ROOT_DIR/$dir" ]; then
        echo "  Processing $dir..."
        cd "$ROOT_DIR/$dir"
        
        # Install dependencies
        echo "    Installing dependencies..."
        npm install > /dev/null 2>&1
        
        # Check and fix package structure
        check_and_fix_package "$dir"
        
        # Check if build works
        if check_build "$dir"; then
            # Create global link
            echo "    Creating npm link..."
            npm link > /dev/null 2>&1
            
            # Add to successful nodes list
            SUCCESSFUL_NODES+=("$dir")
            echo "  ✅ $dir ready"
        else
            echo "  ❌ $dir failed to build, skipping..."
        fi
    else
        echo "  ⚠️  Directory $dir not found at $ROOT_DIR/$dir, skipping..."
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
    npm init -y > /dev/null 2>&1
else
    echo "  Custom directory already exists"
    cd "$N8N_CUSTOM_DIR"
fi

# Link all successful nodes to n8n using symlinks
echo "🔗 Linking nodes to n8n..."
cd "$N8N_CUSTOM_DIR"

# Ensure node_modules directory exists
mkdir -p node_modules

for dir in "${SUCCESSFUL_NODES[@]}"; do
    # Extract package name from package.json
    PACKAGE_NAME=$(cd "$ROOT_DIR/$dir" && node -p "require('./package.json').name" 2>/dev/null)
    if [ -n "$PACKAGE_NAME" ]; then
        echo "  Linking $PACKAGE_NAME..."
        
        # Remove existing link if it exists
        if [ -L "node_modules/$PACKAGE_NAME" ] || [ -d "node_modules/$PACKAGE_NAME" ]; then
            rm -rf "node_modules/$PACKAGE_NAME"
        fi
        
        # Create symlink directly
        ln -sf "$ROOT_DIR/$dir" "node_modules/$PACKAGE_NAME"
        
        if [ -L "node_modules/$PACKAGE_NAME" ]; then
            echo "  ✅ Successfully linked $PACKAGE_NAME"
        else
            echo "  ❌ Failed to link $PACKAGE_NAME"
        fi
    else
        echo "  ⚠️  Could not determine package name for $dir"
    fi
done

# Update package.json to include all linked packages  
echo "📝 Updating package.json with dependencies..."
PACKAGE_JSON="$N8N_CUSTOM_DIR/package.json"

if [ -f "$PACKAGE_JSON" ]; then
    # Create a temporary file with updated dependencies
    cat "$PACKAGE_JSON" | node -e "
        const fs = require('fs');
        const packageJson = JSON.parse(fs.readFileSync(0, 'utf8'));
        
        // Initialize dependencies if it doesn't exist
        if (!packageJson.dependencies) {
            packageJson.dependencies = {};
        }
        
        // Add all successful nodes as dependencies
        const nodes = process.argv.slice(1);
        nodes.forEach(dir => {
            try {
                const nodePackageJson = JSON.parse(fs.readFileSync(\`$ROOT_DIR/\${dir}/package.json\`, 'utf8'));
                packageJson.dependencies[nodePackageJson.name] = \`file:./node_modules/\${nodePackageJson.name}\`;
            } catch (e) {
                console.error('Error reading package.json for', dir);
            }
        });
        
        console.log(JSON.stringify(packageJson, null, 2));
    " "${SUCCESSFUL_NODES[@]}" > "$PACKAGE_JSON.tmp"
    
    mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"
fi

# Return to root directory
cd "$ROOT_DIR"

echo ""
echo "✅ Setup complete!"
echo ""
echo "📊 Summary:"
echo "  Successfully processed: ${#SUCCESSFUL_NODES[@]} nodes"
for node in "${SUCCESSFUL_NODES[@]}"; do
    PACKAGE_NAME=$(cd "$ROOT_DIR/$node" && node -p "require('./package.json').name" 2>/dev/null)
    echo "    - $PACKAGE_NAME"
done
echo ""
echo "📝 Next steps:"
echo "  1. Start n8n with: n8n start"
echo "  2. Open http://localhost:5678 in your browser"
echo "  3. Search for these nodes in the nodes panel"
echo ""
echo "💡 For development with auto-reload:"
echo "  - Run 'npm run dev' in any node directory"
echo "  - Restart n8n after making changes"
echo ""
echo "🔍 If nodes don't appear, try:"
echo "  - Restart n8n completely"
echo "  - Check n8n logs for any loading errors"
echo "  - Verify the nodes are in ~/.n8n/custom/node_modules/" 