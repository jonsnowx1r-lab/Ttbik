"""
Zero-cost RAG: a per-user ChromaDB collection (local, on-disk, free) for
conversation memory, plus DuckDuckGo web search (free, no API key) for
live/current information the model council wouldn't otherwise know
about. This is what keeps Nova "connected to the network" without any
paid search API.
"""
import chromadb
from chromadb.utils import embedding_functions
from duckduckgo_search import DDGS

_chroma_client = chromadb.PersistentClient(path="./chroma_data")
_embedder = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")


def _collection_for(user_id: str):
    return _chroma_client.get_or_create_collection(name=f"nova_memory_{user_id}", embedding_function=_embedder)


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
        # A search-provider hiccup should never take the whole chat
        # down — the council still answers from its own knowledge.
        return []


def build_context(user_id: str, message: str, query_type: str) -> str:
    parts: list[str] = []

    memory = recall(user_id, message)
    if memory:
        parts.append("ذاكرة سابقة مع هذا المستخدم:\n" + "\n---\n".join(memory))

    if query_type == "LIVE_INFO":
        results = web_search(message)
        if results:
            web_snippets = "\n".join(f"- {r.get('title', '')}: {r.get('body', '')}" for r in results)
            parts.append("نتائج بحث حية من الويب:\n" + web_snippets)

    return "\n\n".join(parts)
