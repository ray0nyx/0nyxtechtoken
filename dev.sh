#!/bin/bash

# Run the application with TypeScript checking disabled
echo "Starting development server with TypeScript checking disabled..."
export TSC_COMPILE_ON_ERROR=true
export ESLINT_NO_DEV_ERRORS=true
export DISABLE_ESLINT_PLUGIN=true
export SKIP_PREFLIGHT_CHECK=true
export TS_NODE_PROJECT="tsconfig.dev.json"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm could not be found. Please install Node.js and npm."
    exit 1
fi

# Run the development server
npm run dev
