#!/bin/bash

# dev-watch.sh - Development script to watch all nodes for changes
# This script runs the dev command for all nodes in parallel

echo "👀 Starting development watch mode for all nodes..."
echo "   Press Ctrl+C to stop all watchers"
echo ""

# Function to run npm dev in a directory
run_dev() {
    local dir=$1
    echo "📦 Watching $dir..."
    cd "$dir" && npm run dev
}

# Export the function so it's available to subshells
export -f run_dev

# Array of node directories
NODE_DIRS=(
    "n8n-nodes-contextual-document-loader"
    "n8n-nodes-semantic-splitter-with-context"
    "n8n-nodes-google-gemini-embeddings-extended"
    "n8n-nodes-google-vertex-embeddings-extended"
    "n8n-nodes-query-retriever-rerank"
)

# Check if all directories exist
for dir in "${NODE_DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "❌ Directory $dir not found!"
        exit 1
    fi
done

# Run all watchers in parallel
# Using GNU parallel if available, otherwise fall back to background processes
if command -v parallel &> /dev/null; then
    echo "Using GNU parallel..."
    parallel -j 4 --line-buffer run_dev ::: "${NODE_DIRS[@]}"
else
    echo "GNU parallel not found, using background processes..."
    echo "💡 Tip: Install GNU parallel for better output handling"
    echo ""
    
    # Store PIDs to kill them on exit
    pids=()
    
    # Trap to kill all background processes on exit
    trap 'echo ""; echo "Stopping all watchers..."; kill "${pids[@]}" 2>/dev/null; exit' INT TERM
    
    # Start each watcher in the background
    for dir in "${NODE_DIRS[@]}"; do
        (cd "$dir" && npm run dev) &
        pids+=($!)
    done
    
    # Wait for all background processes
    wait
fi 