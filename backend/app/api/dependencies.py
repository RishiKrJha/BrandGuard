from typing import Optional
from fastapi import Request
from chromadb.api import ClientAPI
from backend.app.services.vector_store import VectorStoreService


def get_chroma_client(request: Request) -> Optional[ClientAPI]:
    """Dependency retrieving the ChromaDB client from the application state."""
    return getattr(request.app.state, "chroma_client", None)


def get_vector_store(request: Request) -> VectorStoreService:
    """Dependency providing the VectorStoreService instance."""
    vector_store = getattr(request.app.state, "vector_store", None)
    if vector_store is None:
        client = get_chroma_client(request)
        vector_store = VectorStoreService(client=client)
    return vector_store
