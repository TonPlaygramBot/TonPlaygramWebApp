"""Generate 3 sample local voice prompt WAV files for testing uploads."""
import math
import wave
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "storage" / "sample-voices"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PRESETS = {
    "male": 130,
    "female": 210,
    "friendly": 175,
}


def write_tone(path: Path, freq: int, duration_sec: int = 2, sample_rate: int = 22050) -> None:
    frames = bytearray()
    amplitude = 7000
    for n in range(duration_sec * sample_rate):
        wobble = math.sin(2 * math.pi * 3 * n / sample_rate) * 0.03
        sample = int(amplitude * math.sin(2 * math.pi * freq * (1 + wobble) * (n / sample_rate)))
        frames.extend(sample.to_bytes(2, "little", signed=True))

    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(bytes(frames))


if __name__ == "__main__":
    for label, freq in PRESETS.items():
        out = OUTPUT_DIR / f"{label}.wav"
        write_tone(out, freq)
        print(f"Generated {out}")
