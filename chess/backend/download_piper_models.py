#!/usr/bin/env python3
"""Download Piper TTS voice models for Indian languages.

Run this once inside the container (or as a Docker entrypoint hook):
    python download_piper_models.py

Models are saved to /app/piper_models/ (the path piper_tts_service.py expects).
Skips files that already exist and match the expected minimum size.
"""
import os
import sys
import urllib.request
from pathlib import Path

BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main"
MODELS_DIR = Path("/app/piper_models")

VOICES = {
    "ml_IN-meera-medium":    "ml/ml_IN/meera/medium",    # female Malayalam (default)
    "ml_IN-arjun-medium":    "ml/ml_IN/arjun/medium",    # male Malayalam (backup)
    "hi_IN-pratham-medium":  "hi/hi_IN/pratham/medium",
    "te_IN-venkatesh-medium": "te/te_IN/venkatesh/medium",
}

MIN_ONNX_BYTES = 1_000_000  # 1 MB — sanity check for partial downloads

def download(url: str, dest: Path) -> bool:
    try:
        tmp = dest.with_suffix(".tmp")
        urllib.request.urlretrieve(url, tmp)
        tmp.rename(dest)
        return True
    except Exception as exc:
        print(f"  FAILED: {exc}")
        tmp = dest.with_suffix(".tmp")
        if tmp.exists():
            tmp.unlink()
        return False

def main() -> int:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    ok = 0
    fail = 0
    for name, path in VOICES.items():
        for suffix in [".onnx", ".onnx.json"]:
            dest = MODELS_DIR / f"{name}{suffix}"
            url  = f"{BASE}/{path}/{name}{suffix}"
            min_size = MIN_ONNX_BYTES if suffix == ".onnx" else 0

            if dest.exists() and dest.stat().st_size >= max(min_size, 1):
                print(f"  already have {dest.name} ({dest.stat().st_size:,} bytes)")
                ok += 1
                continue

            print(f"  downloading {dest.name} …")
            if download(url, dest):
                print(f"  ok ({dest.stat().st_size:,} bytes)")
                ok += 1
            else:
                fail += 1

    print(f"\n{ok} file(s) ready, {fail} failed.")
    return 0 if fail == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
