from typing import Optional
from fastapi import Request
from chromadb.api import ClientAPI


def get_chroma_client(request: Request) -> Optional[ClientAPI]:
    """Dependency retrieving the ChromaDB client from the application state."""
    return getattr(request.app.state, "chroma_client", None)

