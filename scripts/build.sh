#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# build.sh  –  Copy shared utils.py into every Lambda package before SAM build
# Usage: ./scripts/build.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SHARED="backend/lambdas/shared/utils.py"
LAMBDA_DIRS=(
  backend/lambdas/auth
  backend/lambdas/cars
  backend/lambdas/parts
  backend/lambdas/miles
  backend/lambdas/reports
  backend/lambdas/upload
)

echo "Distributing shared utils.py to all Lambda packages..."
for dir in "${LAMBDA_DIRS[@]}"; do
  cp "$SHARED" "$dir/utils.py"
  echo "  → $dir/utils.py"
done

echo ""
echo "Installing Python dependencies for upload Lambda (openpyxl)..."
pip install openpyxl -t backend/lambdas/upload/ --quiet

echo ""
echo "Running sam build..."
sam build

echo ""
echo "Build complete. Run 'sam deploy --guided' to deploy."
