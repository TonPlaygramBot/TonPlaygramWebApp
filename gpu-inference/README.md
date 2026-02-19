# GPU Inference Server (PersonaPlex wrapper)

Run on a CUDA GPU host:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

Update `main.py` integration points with the exact `NVIDIA/personaplex` pipeline calls used by your selected checkpoint.
