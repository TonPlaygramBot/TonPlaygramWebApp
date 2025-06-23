#!/bin/bash
# Fetch and build the Ludo game assets from the original repository
set -e
REPO_URL="https://github.com/eze4acme/Ludo-Built-With-React.git"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Cloning Ludo game..."
git clone --depth 1 "$REPO_URL" "$TMP_DIR/src"

cd "$TMP_DIR/src"

echo "Installing dependencies..."
npm install

echo "Building Ludo game..."
npm run build

cd "$OLDPWD"
DEST="webapp/public/games/ludo"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$TMP_DIR/src/dist/"* "$DEST/"
echo "Ludo game installed to $DEST"
