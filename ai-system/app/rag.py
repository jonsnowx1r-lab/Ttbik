"""
Zero-cost RAG: a per-user ChromaDB collection (local, on-disk, free) for
conversation memory, a SHARED "knowledge bank" collection that
accumulates real web-search results across every user, plus DuckDuckGo
web search (free, no API key) for live/current information the model
council wouldn't otherwise know about. This is what keeps Nova
"connected to the network" without any paid search API.

Uses Chroma's own bundled ONNX embedding function (a small ~80MB
MiniLM model via onnxruntime), NOT sentence-transformers/PyTorch —
importing PyTorch alone uses several hundred MB of RAM before the app
even finishes starting, which reliably OOM-killed this service on
Render's free instance type (512MB total). The ONNX path needs no
torch at all and fits comfortably.
"""
import logging
import time

import chromadb
from chromadb.utils import embedding_functions
from ddgs import DDGS

logger = logging.getLogger("nova")

_chroma_client = chromadb.PersistentClient(path="./chroma_data")
_embedder = embedding_functions.DefaultEmbeddingFunction()

# How long a cached knowledge-bank answer stays trustworthy before we
# treat it as stale and search again. Live facts (prices, news) go bad
# fast — 6 hours is a deliberate middle ground between "never re-search
# the same question twice" (useless for prices) and "re-search every
# single time" (defeats the whole point of a growing knowledge bank).
_KNOWLEDGE_MAX_AGE_SECONDS = 6 * 3600


def _collection_for(user_id: str):
    return _chroma_client.get_or_create_collection(name=f"nova_memory_{user_id}", embedding_function=_embedder)


def _knowledge_bank():
    # ONE shared collection across every user/channel — this is the
    # "bank of information" that grows over time from real search
    # results, instead of each user's search vanishing after their own
    # reply. A price looked up for one user on Telegram is immediately
    # available for the next user asking the same thing on the web UI.
    return _chroma_client.get_or_create_collection(name="nova_knowledge_bank", embedding_function=_embedder)


def remember(user_id: str, message: str, answer: str) -> None:
    col = _collection_for(user_id)
    doc_id = f"{user_id}-{col.count()}"
    col.add(documents=[f"سؤال سابق: {message}\nإجابة سابقة: {answer}"], ids=[doc_id])


def recall(user_id: str, query: str, n_results: int = 3) -> list[str]:
    col = _collection_for(user_id)
    if col.count() == 0:
        return []
    results = col.query(query_texts=[query], n_results=min(n_results, col.count()))
    return results["documents"][0] if results["documents"] else []


def web_search(query: str, max_results: int = 3) -> list[dict]:
    try:
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results))
    except Exception:
        # A search-provider hiccup (rate limiting is common on shared
        # cloud IPs like Render's) should never take the whole chat
        # down — the council still answers from its own knowledge.
        # But it must never be invisible: without this log line, a
        # search that silently fails on every request looks identical
        # to one that never runs, and the model quietly starts
        # guessing/hallucinating "live" answers instead of admitting
        # it has no current data (exactly what showed up as fabricated
        # gold-price figures with wrong currency and raw LaTeX).
        logger.exception("web_search failed for query: %s", query)
        return []


def _recall_knowledge(query: str) -> str | None:
    """Returns a still-fresh cached answer from the shared knowledge
    bank for a semantically similar past query, or None if nothing
    fresh enough exists — in which case the caller must search live."""
    bank = _knowledge_bank()
    if bank.count() == 0:
        return None
    results = bank.query(query_texts=[query], n_results=1)
    docs = results.get("documents") or []
    metas = results.get("metadatas") or []
    if not docs or not docs[0]:
        return None
    age = time.time() - float(metas[0][0].get("ts", 0))
    if age > _KNOWLEDGE_MAX_AGE_SECONDS:
        return None
    return docs[0][0]


def _store_knowledge(query: str, snippets: str) -> None:
    bank = _knowledge_bank()
    doc_id = f"k-{abs(hash(query))}-{int(time.time())}"
    bank.add(documents=[snippets], metadatas=[{"ts": time.time()}], ids=[doc_id])


def build_context(user_id: str, message: str, query_type: str) -> str:
    parts: list[str] = []

    memory = recall(user_id, message)
    if memory:
        parts.append("ذاكرة سابقة مع هذا المستخدم:\n" + "\n---\n".join(memory))

    if query_type == "LIVE_INFO":
        cached = _recall_knowledge(message)
        if cached:
            parts.append("معلومات محفوظة حديثاً في بنك معلومات Nova (من بحث سابق قريب):\n" + cached)
        else:
            results = web_search(message)
            if results:
                web_snippets = "\n".join(f"- {r.get('title', '')}: {r.get('body', '')}" for r in results)
                parts.append("نتائج بحث حية من الويب:\n" + web_snippets)
                _store_knowledge(message, web_snippets)

    return "\n\n".join(parts)
