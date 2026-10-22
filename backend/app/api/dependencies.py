from typing import Optional
from fastapi import HTTPException, Request, status
from chromadb.api import ClientAPI
from backend.app.services.vector_store import VectorStoreService


def get_chroma_client(request: Request) -> Optional[ClientAPI]:
    """Dependency retrieving the ChromaDB client from the application state."""
    return getattr(request.app.state, "chroma_client", None)


def get_vector_store(request: Request) -> VectorStoreService:
    """
    Dependency providing the VectorStoreService instance.

    Raises HTTP 503 if ChromaDB failed to initialise during startup so callers
    receive an actionable error instead of a silent fallback that creates a
    second uninitialised client instance.
    """
    vector_store = getattr(request.app.state, "vector_store", None)
    if vector_store is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Vector store is currently unavailable. "
                "ChromaDB failed to initialise at startup — check server logs."
            ),
        )
    return vector_store
