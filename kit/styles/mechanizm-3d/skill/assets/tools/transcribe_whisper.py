import json, sys, whisper
m = whisper.load_model("medium")
prompt = "Felix Wankel, silnik Wankla, NSU Ro 80, Volkswagen, Mazda, Le Mans, MX-30, wirnik, uszczelki, prądnica."
r = m.transcribe(sys.argv[1], language="pl", word_timestamps=True, initial_prompt=prompt, condition_on_previous_text=False)
words = [{"text": w["word"].strip(), "start": round(w["start"], 3), "end": round(w["end"], 3)} for s in r["segments"] for w in s["words"]]
json.dump(words, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
print(len(words), "words")
