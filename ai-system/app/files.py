"""
Zero-cost text extraction for the /file endpoint — PDF via pypdf,
Word via python-docx, anything else treated as plain text. Both
libraries are pure-Python/lightweight (no torch, no native ML
dependency), so they fit comfortably in Render's 512MB free instance
the same way rag.py's ONNX embedder does.
"""
import io

MAX_EXTRACTED_CHARS = 8000  # keep the council's prompt bounded regardless of file size


def extract_text(filename: str, data: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        text = _extract_pdf(data)
    elif lower.endswith(".docx"):
        text = _extract_docx(data)
    else:
        text = data.decode("utf-8", errors="ignore")
    return text[:MAX_EXTRACTED_CHARS]


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _extract_docx(data: bytes) -> str:
    import docx

    document = docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in document.paragraphs)
