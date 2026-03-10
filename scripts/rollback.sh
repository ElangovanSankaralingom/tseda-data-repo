#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Rollback script for tseda-data-repo
# Usage: ./scripts/rollback.sh [version]
#   version: specific tag to roll back to. If omitted, uses the previous tag.
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[rollback]${NC} $1"; }
warn()  { echo -e "${YELLOW}[rollback]${NC} $1"; }
fail()  { echo -e "${RED}[rollback]${NC} $1"; exit 1; }

# ---------------------------------------------------------------------------
# Find target version
# ---------------------------------------------------------------------------

if [ -n "${1:-}" ]; then
  TARGET="$1"
else
  # Get the second most recent tag (previous release)
  TARGET=$(git tag --sort=-creatordate | head -2 | tail -1)
fi

if [ -z "$TARGET" ]; then
  fail "No previous tag found. Specify a version: ./scripts/rollback.sh v0.2.0"
fi

info "Rolling back to: $TARGET"

# Verify the tag exists
if ! git rev-parse "$TARGET" >/dev/null 2>&1; then
  fail "Tag $TARGET does not exist."
fi

# ---------------------------------------------------------------------------
# Checkout and rebuild
# ---------------------------------------------------------------------------

info "Checking out $TARGET..."
git checkout "$TARGET"

info "Installing dependencies..."
npm ci

info "Building..."
npm run build

# ---------------------------------------------------------------------------
# Docker rebuild
# ---------------------------------------------------------------------------

IMAGE_NAME="tseda:${TARGET}"
info "Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" -t tseda:latest .

echo ""
info "Rollback to $TARGET complete."
echo "  Deploy with: docker-compose up -d"
echo "  Or return to main: git checkout main"
