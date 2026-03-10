#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# Deploy script for tseda-data-repo
# Usage: ./scripts/deploy.sh [version]
#   version: semver tag (e.g. v0.4.0). If omitted, uses current package.json version.
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn()  { echo -e "${YELLOW}[deploy]${NC} $1"; }
fail()  { echo -e "${RED}[deploy]${NC} $1"; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

info "Running pre-flight checks..."

npm run lint || fail "Lint failed"
npx tsc --noEmit || fail "Type check failed"
npm run build || fail "Build failed"
npm test || fail "Tests failed"
npm audit --audit-level=high || warn "Audit warnings found (non-blocking)"

info "Pre-flight checks passed."

# ---------------------------------------------------------------------------
# Version tag
# ---------------------------------------------------------------------------

VERSION="${1:-v$(node -p "require('./package.json').version")}"
info "Deploying version: $VERSION"

if git rev-parse "$VERSION" >/dev/null 2>&1; then
  warn "Tag $VERSION already exists, skipping tag creation."
else
  git tag -a "$VERSION" -m "Release $VERSION"
  info "Created tag: $VERSION"
fi

# ---------------------------------------------------------------------------
# Docker build
# ---------------------------------------------------------------------------

IMAGE_NAME="tseda:${VERSION}"
info "Building Docker image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" -t tseda:latest .
info "Docker image built: $IMAGE_NAME"

# ---------------------------------------------------------------------------
# Deployment instructions
# ---------------------------------------------------------------------------

echo ""
info "Build complete. Next steps:"
echo "  1. Push tag:    git push origin $VERSION"
echo "  2. Push image:  docker push <registry>/$IMAGE_NAME"
echo "  3. Deploy:      Update your deployment target with the new image"
echo ""
echo "  Or run with docker-compose:"
echo "    docker-compose up -d"
