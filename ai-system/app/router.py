"""
MoE-style router: a lightweight, zero-cost classifier that decides
which council member(s) to consult for a given message, BEFORE we
spend any API call. This is the "smart router" piece from the
project's own spec — implemented as fast local heuristics rather than
an extra model call, so classification itself never costs anything or
adds latency.
"""
import re

_CODE_HINTS = re.compile(
    r"```|traceback|error:|exception|def |function\s*\(|class \w+|"
    r"import \w+|npm |pip |sql|python|javascript|typescript|"
    r"كود|برمجة|دالة|خطأ في|السطر",
    re.IGNORECASE,
)

_LIVE_INFO_HINTS = re.compile(
    r"\b(today|now|latest|current|price|news|weather)\b|"
    r"اليوم|الآن|الآن|سعر|آخر|جديد|طقس|أخبار|حالياً",
    re.IGNORECASE,
)


def classify(message: str) -> str:
    """Returns one of CODE | LIVE_INFO | GENERAL."""
    if _CODE_HINTS.search(message):
        return "CODE"
    if _LIVE_INFO_HINTS.search(message):
        return "LIVE_INFO"
    return "GENERAL"
