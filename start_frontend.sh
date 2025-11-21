#!/bin/bash

echo "Starting MPDMS Frontend Development Server..."
echo "================================================"

# Check if node_modules exists
if [ ! -d "/workspace/frontend/node_modules" ]; then
    echo "Installing dependencies..."
    cd /workspace/frontend
    
    # Try to create a local npm config
    npm config set prefix ~/.npm-global
    
    # Install dependencies without global access
    npm install --unsafe-perm=true --allow-root
    
    if [ $? -eq 0 ]; then
        echo "✅ Dependencies installed successfully"
    else
        echo "⚠️  Some dependencies failed to install, continuing anyway..."
    fi
fi

# Start the development server
echo "Starting React development server..."
cd /workspace/frontend
PORT=3000 npm start