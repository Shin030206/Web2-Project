#!/usr/bin/env bash
# Verification gate for Ky Uc Studio
set -e

echo "=== 1. Checking Backend Syntax ==="
cd server
node -c index.js
echo "✅ Backend syntax valid."

echo "=== 2. Building Angular Frontend ==="
cd ../ky-uc-studio-v2
npm run build
echo "✅ Frontend build successful."

echo "=== All Verification Gates Passed ==="
