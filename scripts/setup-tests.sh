#!/bin/bash
# Install OS level dependencies required for optional native modules such as
# `canvas`. Package installation (via `npm ci` in each package) is handled
# separately in the CI workflow.
set -e

# Update apt and install build tools required for the `canvas` package
sudo apt-get update
sudo apt-get install -y \
  libcairo2-dev \
  libjpeg-dev \
  libpango1.0-dev \
  libgif-dev \
  build-essential

