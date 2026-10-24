"""Vector store service wrapping ChromaDB for brand guidelines storage and retrieval."""

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid
import chromadb
from chromadb.api import ClientAPI
from backend.app.core.config import settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    """Service abstraction managing ChromaDB vector operations for brand guidelines."""

    def __init__(
        self,
        client: Optional[ClientAPI] = None,
        persist_directory: Optional[str] = None,
        collection_name: Optional[str] = None,
    ):
        self._client = client
        self.persist_directory = persist_directory or settings.CHROMA_PERSIST_DIRECTORY
        self.collection_name = collection_name or settings.CHROMA_COLLECTION_NAME
        self._collection = None

    @property
    def client(self) -> ClientAPI:
        """Lazily initialize and return the persistent ChromaDB client."""
        if self._client is None:
            # Resolve directory path
            persist_path = Path(self.persist_directory)
            if not persist_path.is_absolute():
                # Anchored to workspace backend directory or current execution root
                persist_path = Path(os.getcwd()) / self.persist_directory
            os.makedirs(persist_path, exist_ok=True)
            self._client = chromadb.PersistentClient(path=str(persist_path))
        return self._client

    @property
    def collection(self):
        """Lazily retrieve or create the brand guidelines collection."""
        if self._collection is None:
            self._collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    def is_alive(self) -> bool:
        """Verify vector store connectivity."""
        try:
            self.client.heartbeat()
            return True
        except Exception as exc:
            logger.error("Vector store heartbeat failure: %s", exc)
            return False

    def add_chunks(
        self,
        chunks: List[str],
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        Add text chunks to the ChromaDB collection with source and metadata.

        Args:
            chunks: List of text chunk strings.
            source: Source identifier (e.g. filename).
            metadata: Optional additional metadata dict to attach to each chunk.

        Returns:
            Number of chunks successfully indexed.
        """
        if not chunks:
            return 0

        ids = [f"{uuid.uuid4().hex}" for _ in range(len(chunks))]
        metadatas: List[Dict[str, Any]] = []

        for i, _ in enumerate(chunks):
            meta: Dict[str, Any] = {
                "source": source,
                "chunk_index": i,
            }
            if metadata:
                for k, v in metadata.items():
                    if isinstance(v, (str, int, float, bool)):
                        meta[k] = v
                    else:
                        meta[k] = str(v)
            metadatas.append(meta)

        self.collection.add(
            documents=chunks,
            ids=ids,
            metadatas=metadatas,
        )
        logger.info(
            "Successfully indexed %d chunks for source '%s' in collection '%s'",
            len(chunks),
            source,
            self.collection_name,
        )
        return len(chunks)

    def query_rules(
        self,
        query: str,
        n_results: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Query guideline rules from the ChromaDB collection.

        Args:
            query: Semantic search query string.
            n_results: Maximum number of guideline rule chunks to retrieve.

        Returns:
            List of dictionaries containing text, distance, and source metadata.
        """
        total = self.count_chunks()
        if total == 0:
            return []

        limit = min(max(1, n_results), total)
        results = self.collection.query(
            query_texts=[query],
            n_results=limit,
        )

        matches: List[Dict[str, Any]] = []
        docs = results.get("documents", [[]])[0] if results.get("documents") else []
        distances = results.get("distances", [[]])[0] if results.get("distances") else []
        metadatas = results.get("metadatas", [[]])[0] if results.get("metadatas") else []

        for i, doc in enumerate(docs):
            dist = distances[i] if i < len(distances) else 0.0
            meta = metadatas[i] if i < len(metadatas) and metadatas[i] is not None else {}
            matches.append({
                "text": doc,
                "distance": dist,
                "metadata": meta,
                "source": meta.get("source", ""),
            })

        return matches

    def count_chunks(self) -> int:
        """Return the total number of chunks currently stored in the collection."""
        try:
            return self.collection.count()
        except Exception as exc:
            logger.error("Failed to retrieve chunk count: %s", exc)
            return 0

    def get_sources(self) -> List[str]:
        """Return a sorted list of unique source document names indexed in the collection."""
        try:
            if self.count_chunks() == 0:
                return []
            result = self.collection.get(include=["metadatas"])
            metas = result.get("metadatas") or []
            sources = sorted(list(set(m.get("source") for m in metas if m and "source" in m)))
            return sources
        except Exception as exc:
            logger.error("Failed to retrieve indexed sources: %s", exc)
            return []

    def delete_by_source(self, source: str) -> int:
        """
        Delete all chunks indexed under a specific source document identifier.

        Args:
            source: Source identifier (e.g. filename).

        Returns:
            Remaining chunk count in the collection.
        """
        try:
            self.collection.delete(where={"source": source})
            logger.info("Deleted chunks for source '%s' in collection '%s'", source, self.collection_name)
            return self.count_chunks()
        except Exception as exc:
            logger.error("Failed to delete chunks for source '%s': %s", source, exc)
            raise

    def reset(self) -> None:
        """Reset the collection for testing and re-indexing."""
        try:
            self.client.delete_collection(name=self.collection_name)
            logger.info("Deleted collection '%s'", self.collection_name)
        except Exception as exc:
            logger.debug("Reset: collection '%s' did not exist or failed to delete: %s", self.collection_name, exc)
        self._collection = None

    # ------------------------------------------------------------------
    # Async wrappers — offload blocking ChromaDB calls to a thread pool
    # so they never block the uvicorn async event loop.
    # ------------------------------------------------------------------

    async def async_add_chunks(
        self,
        chunks: List[str],
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Thread-safe async wrapper around :meth:`add_chunks`."""
        return await asyncio.to_thread(self.add_chunks, chunks, source, metadata)

    async def async_query_rules(
        self,
        query: str,
        n_results: int = 5,
    ) -> List[Dict[str, Any]]:
        """Thread-safe async wrapper around :meth:`query_rules`."""
        return await asyncio.to_thread(self.query_rules, query, n_results)

    async def async_count_chunks(self) -> int:
        """Thread-safe async wrapper around :meth:`count_chunks`."""
        return await asyncio.to_thread(self.count_chunks)

    async def async_get_sources(self) -> List[str]:
        """Thread-safe async wrapper around :meth:`get_sources`."""
        return await asyncio.to_thread(self.get_sources)

    async def async_delete_by_source(self, source: str) -> int:
        """Thread-safe async wrapper around :meth:`delete_by_source`."""
        return await asyncio.to_thread(self.delete_by_source, source)

    async def async_reset(self) -> None:
        """Thread-safe async wrapper around :meth:`reset`."""
        await asyncio.to_thread(self.reset)

    async def async_is_alive(self) -> bool:
        """Thread-safe async wrapper around :meth:`is_alive`."""
        return await asyncio.to_thread(self.is_alive)
