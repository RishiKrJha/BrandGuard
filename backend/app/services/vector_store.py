import logging
from typing import Optional
import chromadb
from chromadb.api import ClientAPI
from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    """Service abstraction managing ChromaDB vector operations."""

    def __init__(self, client: Optional[ClientAPI] = None):
        self._client = client

    @property
    def client(self) -> ClientAPI:
        if self._client is None:
            self._client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        return self._client

    def is_alive(self) -> bool:
        """Verify vector store connectivity."""
        try:
            self.client.heartbeat()
            return True
        except Exception as exc:
            logger.error("Vector store heartbeat failure: %s", exc)
            return False

