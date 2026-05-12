# Showood Pool Royale table asset

The Pool Royale Showood table is configured to load `seven_foot_showood.glb` from this directory first for faster in-app loading.

Do **not** commit the GLB binary to git. Place/sync the file here out-of-band during deployment or local setup. If the local file is missing at runtime, Pool Royale falls back to the remote Pooltool raw GLB URL configured in `webapp/src/config/poolRoyaleTableModels.js`.
