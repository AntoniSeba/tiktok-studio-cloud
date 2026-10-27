"""Czasy słów z lektora: python3 words.py vo.wav [words.json].
Najpierw whisper.cpp (whisper-cli z Homebrew, model ggml-base), bo działa w każdym środowisku;
gdy go brak: faster-whisper "base", a potem openai-whisper "base"."""
import glob, json, os, shutil, subprocess, sys, tempfile

src = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 else "words.json"
HOME = os.path.expanduser("~")

def bin_(name):
    for d in os.environ.get("PATH", "").split(":") + ["/opt/homebrew/bin", "/usr/local/bin", HOME + "/.local/bin"]:
        p = os.path.join(d, name)
        if d and os.path.exists(p): return p
    return None

def whisper_cpp():
    cli = bin_("whisper-cli")
    model = os.environ.get("WHISPER_CPP_MODEL") or next((m for m in [HOME + "/remotion/scratch/whisper.cpp/ggml-base.bin", HOME + "/.cache/whisper/ggml-base.bin",
                                                                     "/opt/homebrew/share/whisper-cpp/ggml-base.bin"] if os.path.exists(m)), None)
    if not cli or not model: return None
    tmp = tempfile.mkdtemp()
    wav = os.path.join(tmp, "a.wav")
    subprocess.run([bin_("ffmpeg") or "ffmpeg", "-y", "-loglevel", "error", "-i", src, "-ar", "16000", "-ac", "1", wav], check=True)
    # -ml 1 -sow: one word per segment, split on words
    subprocess.run([cli, "-m", model, "-f", wav, "-l", "pl", "-ml", "1", "-sow", "-oj", "-of", os.path.join(tmp, "a")], check=True, capture_output=True)
    data = json.load(open(os.path.join(tmp, "a.json"), encoding="utf-8", errors="replace"))
    shutil.rmtree(tmp, ignore_errors=True)
    W = []
    for seg in data.get("transcription", []):
        t = seg.get("text", "").strip()
        if not t: continue
        W.append({"w": t, "s": round(seg["offsets"]["from"] / 1000, 3), "e": round(seg["offsets"]["to"] / 1000, 3)})
    return W or None

W = None
try:
    W = whisper_cpp()
except Exception as e:
    print("whisper.cpp nie zadziałał:", e, file=sys.stderr)
if not W:
    try:
        from faster_whisper import WhisperModel
        m = WhisperModel("base", device="cpu", compute_type="int8")
        segs, _ = m.transcribe(src, language="pl", word_timestamps=True, beam_size=5)
        W = [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]
    except ImportError:
        import whisper
        r = whisper.load_model("base").transcribe(src, language="pl", word_timestamps=True, fp16=False)
        W = [{"w": w["word"].strip(), "s": round(w["start"], 3), "e": round(w["end"], 3)} for s in r["segments"] for w in s["words"]]
json.dump(W, open(out, "w"), ensure_ascii=False)
print(len(W), "słów;", " ".join(f'{x["w"]}@{x["s"]}' for x in W[:40]))
