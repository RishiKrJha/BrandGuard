import logging
import os
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from backend.app.api.dependencies import get_vector_store
from backend.app.models.schemas import (
    GuidelineResetResponse,
    GuidelineStatsResponse,
    GuidelineUploadResponse,
)
from backend.app.services.document_parser import chunk_text, extract_text
from backend.app.services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["guidelines"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


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

        if len(content) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"File size ({len(content) // 1024} KB) exceeds the maximum allowed "
                    f"size of {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB."
                ),
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

        chunks_indexed = await vector_store.async_add_chunks(
            chunks=chunks,
            source=file.filename,
        )
        total_chunks = await vector_store.async_count_chunks()

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
    Returns total indexed chunks, list of active source documents, and status of the guidelines vector store.
    """
    try:
        total = await vector_store.async_count_chunks()
        sources = await vector_store.async_get_sources()
        current_status = "operational" if await vector_store.async_is_alive() else "degraded"
        return GuidelineStatsResponse(
            total_chunks=total,
            status=current_status,
            sources=sources,
        )
    except Exception as exc:
        logger.error("Failed to retrieve guideline stats: %s", exc)
        return GuidelineStatsResponse(
            total_chunks=0,
            status="error",
            sources=[],
        )


@router.delete(
    "/reset",
    response_model=GuidelineResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset and clear all brand guidelines from vector store",
)
async def reset_guidelines(
    vector_store: VectorStoreService = Depends(get_vector_store),
) -> GuidelineResetResponse:
    """
    Wipes all indexed guideline chunks from ChromaDB and re-initializes a fresh collection.
    """
    try:
        await vector_store.async_reset()
        remaining = await vector_store.async_count_chunks()
        logger.info("Brand guidelines collection reset. Remaining chunks: %d", remaining)
        return GuidelineResetResponse(
            message="Brand guidelines knowledge base has been completely reset.",
            total_chunks=remaining,
        )
    except Exception as exc:
        logger.error("Failed to reset brand guidelines: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset guidelines: {str(exc)}",
        )


@router.delete(
    "/file/{filename}",
    response_model=GuidelineResetResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete all chunks for a specific guideline document",
)
async def delete_guideline_file(
    filename: str,
    vector_store: VectorStoreService = Depends(get_vector_store),
) -> GuidelineResetResponse:
    """
    Deletes all chunks associated with a specific guideline filename from ChromaDB.
    """
    try:
        await vector_store.async_delete_by_source(filename)
        remaining = await vector_store.async_count_chunks()
        logger.info("Deleted guideline file '%s'. Remaining chunks: %d", filename, remaining)
        return GuidelineResetResponse(
            message=f"Guideline document '{filename}' has been deleted.",
            total_chunks=remaining,
        )
    except Exception as exc:
        logger.error("Failed to delete guideline document '%s': %s", filename, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(exc)}",
        )

