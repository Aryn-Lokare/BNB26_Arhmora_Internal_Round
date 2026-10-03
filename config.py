import os
from dotenv import load_dotenv

load_dotenv()

PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()      # "groq" or "anthropic"
_DEFAULT_MODELS = {"groq": "openai/gpt-oss-120b", "anthropic": "claude-haiku-4-5-20251001"}
MODEL = os.getenv("MODEL", _DEFAULT_MODELS.get(PROVIDER, ""))
MAX_ITERS = 6
CACHE_PATH = os.getenv("LLM_CACHE_PATH", "llm_cache.db")


def database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Set DATABASE_URL (direct Neon connection string) in .env")
    return url


def agent_ro_url() -> str:
    url = os.getenv("AGENT_RO_URL")
    if not url:
        raise RuntimeError("Set AGENT_RO_URL (agent_ro role connection string) in .env")
    return url
