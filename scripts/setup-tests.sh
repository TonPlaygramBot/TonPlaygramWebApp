#!/bin/bash
# Install dependencies for the root package, bot and webapp. Run this before
# executing `npm test` when setting up a fresh environment so required modules
# like `express` and `socket.io-client` are available.
set -e
npm run install-all
