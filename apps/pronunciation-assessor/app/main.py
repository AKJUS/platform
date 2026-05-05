import json
import os
import tempfile
from functools import lru_cache
from typing import Any

import librosa
import numpy as np
import torch
from fastapi import FastAPI, File, Form, UploadFile
from rapidfuzz.distance import Levenshtein
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

MODEL_ID = os.getenv("PRONUNCIATION_ASSESSOR_MODEL", "facebook/wav2vec2-base-960h")
PRELOAD_MODEL = os.getenv("PRONUNCIATION_ASSESSOR_PRELOAD", "true").lower() != "false"
SAMPLE_RATE = 16_000

app = FastAPI(title="Tuturuuu Pronunciation Assessor")


def clamp_score(value: float) -> int:
    return max(0, min(100, int(round(value))))


def score_to_level(score: int) -> str:
    if score >= 85:
        return "green"
    if score >= 70:
        return "amber"
    if score >= 50:
        return "orange"
    return "red"


def normalize_token(value: str) -> str:
    return "".join(ch.lower() for ch in value if ch.isalnum())


def tokenize_words(value: str) -> list[str]:
    return value.split()


def compare_tokens(expected: str, heard: str) -> int:
    left = normalize_token(expected)
    right = normalize_token(heard)
    max_length = max(len(left), len(right))
    if max_length == 0:
        return 100
    distance = Levenshtein.distance(left, right)
    return clamp_score((1 - distance / max_length) * 100)


def build_character_grades(expected: str, heard: str, word_score: int) -> list[dict[str, Any]]:
    normalized_heard = normalize_token(heard)
    heard_index = 0
    characters: list[dict[str, Any]] = []

    for character in expected:
        normalized_character = normalize_token(character)
        if not normalized_character:
            characters.append({"character": character, "level": "green", "score": 100})
            continue

        heard_character = normalized_heard[heard_index] if heard_index < len(normalized_heard) else ""
        heard_index += 1
        score = max(word_score, 88) if normalized_character == heard_character else max(0, word_score - 25)
        score = clamp_score(score)
        characters.append(
            {
                "character": character,
                "level": score_to_level(score),
                "score": score,
            }
        )

    return characters


def parse_valsea_response(value: str | None) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


@lru_cache(maxsize=1)
def load_model() -> tuple[Wav2Vec2Processor, Wav2Vec2ForCTC, torch.device]:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
    model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID).to(device)
    model.eval()
    return processor, model, device


def run_local_ctc(audio_path: str) -> tuple[str, int]:
    processor, model, device = load_model()
    audio, _ = librosa.load(audio_path, sr=SAMPLE_RATE, mono=True)
    if audio.size == 0:
        return "", 0

    inputs = processor(audio, sampling_rate=SAMPLE_RATE, return_tensors="pt", padding=True)
    input_values = inputs.input_values.to(device)

    with torch.inference_mode():
        logits = model(input_values).logits
        probabilities = torch.softmax(logits, dim=-1)
        confidence = probabilities.max(dim=-1).values.mean().item()
        predicted_ids = torch.argmax(logits, dim=-1)

    transcript = processor.batch_decode(predicted_ids)[0].strip()
    return transcript, clamp_score(confidence * 100)


def build_grade(
    *,
    acoustic_confidence: int,
    local_transcript: str,
    reference_text: str,
    valsea_response: dict[str, Any],
    valsea_transcript: str,
) -> dict[str, Any]:
    expected_words = tokenize_words(reference_text)
    valsea_words = tokenize_words(valsea_transcript)
    local_words = tokenize_words(local_transcript)
    corrections = valsea_response.get("corrections")
    correction_count = len(corrections) if isinstance(corrections, list) else 0
    correction_penalty = min(18, correction_count * 3)

    words = []
    for index, expected in enumerate(expected_words):
        valsea_heard = valsea_words[index] if index < len(valsea_words) else ""
        local_heard = local_words[index] if index < len(local_words) else ""
        valsea_score = compare_tokens(expected, valsea_heard)
        local_score = compare_tokens(expected, local_heard)
        score = clamp_score((valsea_score * 0.5) + (local_score * 0.35) + (acoustic_confidence * 0.15))
        native_score = clamp_score((score * 0.72) + (acoustic_confidence * 0.28) - correction_penalty)
        heard = valsea_heard or local_heard
        words.append(
            {
                "characters": build_character_grades(expected, heard, score),
                "expected": expected,
                "heard": heard,
                "level": score_to_level(score),
                "nativeScore": native_score,
                "score": score,
            }
        )

    overall_score = clamp_score(np.mean([word["score"] for word in words])) if words else 0
    native_similarity = clamp_score(np.mean([word["nativeScore"] for word in words])) if words else 0

    if native_similarity >= 85:
        summary = "Native-like delivery with stable acoustic confidence and strong phrase alignment."
    elif native_similarity >= 70:
        summary = "Understandable delivery with a few words that would benefit from another pass."
    elif native_similarity >= 50:
        summary = "Partly understandable delivery; focus on the highlighted amber and orange sounds."
    else:
        summary = "The phrase needs focused pronunciation practice before using it live."

    return {
        "heardText": valsea_transcript or local_transcript,
        "nativeSimilarity": native_similarity,
        "overallScore": overall_score,
        "provider": "local-model",
        "raw": {
            "acousticConfidence": acoustic_confidence,
            "localTranscript": local_transcript,
            "model": MODEL_ID,
        },
        "referenceText": reference_text,
        "summary": summary,
        "words": words,
    }


@app.on_event("startup")
def warm_model() -> None:
    if PRELOAD_MODEL:
        load_model()


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "model": MODEL_ID,
        "modelLoaded": load_model.cache_info().currsize > 0,
        "ok": True,
    }


@app.post("/assess")
async def assess(
    file: UploadFile = File(...),
    language: str = Form("english"),
    referenceText: str = Form(...),
    valseaTranscript: str = Form(""),
    valseaResponse: str | None = Form(None),
) -> dict[str, Any]:
    suffix = os.path.splitext(file.filename or "")[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as temp_file:
        temp_file.write(await file.read())
        temp_file.flush()
        local_transcript, acoustic_confidence = run_local_ctc(temp_file.name)

    valsea_response = parse_valsea_response(valseaResponse)
    return build_grade(
        acoustic_confidence=acoustic_confidence,
        local_transcript=local_transcript,
        reference_text=referenceText,
        valsea_response=valsea_response,
        valsea_transcript=valseaTranscript,
    )
