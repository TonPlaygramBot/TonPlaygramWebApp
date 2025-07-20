#!/bin/bash
# Install dependencies for the root package, bot and webapp. Run this before
# executing `npm test` when setting up a fresh environment so required modules
# like `express` and `socket.io-client` are available. Also installs OS level
# packages needed to compile optional native modules such as `canvas`.
set -e

# Update apt and install build tools required for the `canvas` package
sudo apt-get update
sudo apt-get install -y \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  libgif-dev \
  build-essential

npm run install-all
