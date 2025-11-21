#!/bin/bash
cd /workspace/frontend
echo "Installing frontend dependencies..."
npm install --no-fund --no-audit --verbose
echo "Installation complete!"
echo "Checking installed packages..."
ls -la node_modules/ | head -10