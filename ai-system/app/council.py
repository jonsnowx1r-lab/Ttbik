"""
The "council of models" — Mixture-of-Agents over genuinely free APIs
only. This is the honest, working version of the "merge multiple
models into one brain" idea: we can't merge closed models (Claude,
Grok, Gemini) since nobody outside their own companies holds their
weights, and Claude/Grok's real APIs are paid — neither belongs in a
$0 pipeline. Instead:

  - Groq (free, always-on, hosts big open models like Llama 3.3 70B)
    is the primary voice AND the final synthesizer.
  - Gemini's free tier is a second, independent opinion for
    cross-checking.
  - An optional self-merged open-weight specialist model (produced by
    ai-system/colab/merge_and_finetune.py, served for free via
    Hugging Face Inference) is consulted for CODE queries specifically
    — this is where real Mergekit/LoRA weight-merging actually lives
    in this system.

If only Groq is configured (HF_SPECIALIST_MODEL_ID / GEMINI_API_KEY
left empty), the system still works end-to-end on Groq alone — every
other council seat is a bonus, not a hard dependency.
"""
from groq import Groq
from huggingface_hub import InferenceClient

from app.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GROQ_API_KEY,
    GROQ_MODEL,
    HF_SPECIALIST_MODEL_ID,
    HF_TOKEN,
)

_SYSTEM_PROMPT = (
    "أنت Nova، مساعد ذكاء اصطناعي عربي/إنجليزي متعدد المصادر. أجب بدقة ووضوح، "
    "واستخدم أي سياق أو نتائج بحث مُعطاة لك إن وُجدت بدل تجاهلها."
)


def _groq_client() -> Groq:
    if not GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY غير مُعدّ — راجع ai-system/.env.example")
    return Groq(api_key=GROQ_API_KEY)


def call_groq(message: str, context: str) -> str:
    client = _groq_client()
    user_content = f"السياق:\n{context}\n\nسؤال المستخدم:\n{message}" if context else message
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )
    return completion.choices[0].message.content or ""


def call_gemini(message: str, context: str) -> str | None:
    if not GEMINI_API_KEY:
        return None
    import google.generativeai as genai

    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=_SYSTEM_PROMPT)
    user_content = f"السياق:\n{context}\n\nسؤال المستخدم:\n{message}" if context else message
    try:
        response = model.generate_content(user_content)
        return response.text
    except Exception:
        # A second opinion is a bonus, never a hard requirement.
        return None


def call_hf_specialist(message: str) -> str | None:
    if not HF_SPECIALIST_MODEL_ID or not HF_TOKEN:
        return None
    try:
        client = InferenceClient(model=HF_SPECIALIST_MODEL_ID, token=HF_TOKEN)
        return client.text_generation(message, max_new_tokens=512)
    except Exception:
        # HF's free Inference API is rate-limited and can be cold —
        # never let it block the answer the user actually gets.
        return None


def synthesize(message: str, groq_answer: str, gemini_answer: str | None, specialist_answer: str | None) -> str:
    """Mixture-of-agents: if we only have one voice, return it as-is —
    no wasted extra call. Otherwise ask Groq itself to merge the
    perspectives into one final answer."""
    if not gemini_answer and not specialist_answer:
        return groq_answer

    perspectives = [f"رأي النموذج الأساسي:\n{groq_answer}"]
    if gemini_answer:
        perspectives.append(f"رأي ثانٍ للمقارنة:\n{gemini_answer}")
    if specialist_answer:
        perspectives.append(f"رأي متخصص (برمجي):\n{specialist_answer}")

    synthesis_prompt = (
        f"سؤال المستخدم الأصلي:\n{message}\n\n"
        + "\n\n".join(perspectives)
        + "\n\nادمج هذه الآراء في إجابة نهائية واحدة دقيقة وموجزة للمستخدم، "
        "دون ذكر أنك تقارن بين نماذج — فقط أعطه أفضل إجابة ممكنة."
    )
    client = _groq_client()
    completion = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": synthesis_prompt}],
    )
    return completion.choices[0].message.content or groq_answer


def answer(message: str, context: str, query_type: str) -> str:
    groq_answer = call_groq(message, context)
    gemini_answer = call_gemini(message, context)
    specialist_answer = call_hf_specialist(message) if query_type == "CODE" else None
    return synthesize(message, groq_answer, gemini_answer, specialist_answer)
