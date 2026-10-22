import logging
import os
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from backend.app.api.dependencies import get_vector_store
from backend.app.models.schemas import GuidelineStatsResponse, GuidelineUploadResponse
from backend.app.services.document_parser import chunk_text, extract_text
from backend.app.services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["guidelines"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}


@router.post(
    "/upload",
    response_model=GuidelineUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload and ingest a brand guideline document",
)
async def upload_guideline(
    file: UploadFile = File(..., description="Guideline document (.pdf, .txt, .md)"),
    vector_store: VectorStoreService = Depends(get_vector_store),
) -> GuidelineUploadResponse:
    """
    Accepts multipart file (PDF, TXT, MD), extracts and chunks text,
    indexes into ChromaDB, and returns ingestion statistics.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename is missing.",
        )

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        extracted_text = extract_text(content, filename=file.filename)
        if not extracted_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No readable text could be extracted from the file.",
            )

        chunks = chunk_text(extracted_text)
        if not chunks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No text chunks generated from the document content.",
            )

        chunks_indexed = vector_store.add_chunks(
            chunks=chunks,
            source=file.filename,
        )
        total_chunks = vector_store.count_chunks()

        return GuidelineUploadResponse(
            filename=file.filename,
            chunks_indexed=chunks_indexed,
            total_chunks=total_chunks,
        )

    except HTTPException:
        raise
    except ValueError as val_err:
        logger.warning("Validation error processing %s: %s", file.filename, val_err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except Exception as exc:
        logger.error("Unexpected error processing guideline upload %s: %s", file.filename, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and index document: {str(exc)}",
        )


@router.get(
    "/stats",
    response_model=GuidelineStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get brand guideline vector store stats",
)
async def get_guideline_stats(
    vector_store: VectorStoreService = Depends(get_vector_store),
) -> GuidelineStatsResponse:
    """
    Returns total indexed chunks and current status of the guidelines vector store.
    """
    try:
        total = vector_store.count_chunks()
        current_status = "operational" if vector_store.is_alive() else "degraded"
        return GuidelineStatsResponse(
            total_chunks=total,
            status=current_status,
        )
    except Exception as exc:
        logger.error("Failed to retrieve guideline stats: %s", exc)
        return GuidelineStatsResponse(
            total_chunks=0,
            status="error",
        )

