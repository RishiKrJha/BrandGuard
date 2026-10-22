from typing import Optional
from fastapi import APIRouter, Depends
from chromadb.api import ClientAPI
from backend.app.api.dependencies import get_chroma_client
from backend.app.core.config import settings
from backend.app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(
    chroma_client: Optional[ClientAPI] = Depends(get_chroma_client),
) -> HealthResponse:
    """
    Check the health status of the API and its backing ChromaDB service.
    """
    chroma_status = "uninitialized"
    if chroma_client is not None:
        try:
            chroma_client.heartbeat()
            chroma_status = "connected"
        except Exception:
            chroma_status = "error"

    return HealthResponse(
        status="ok",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        chroma_status=chroma_status,
    )

