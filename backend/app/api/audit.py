"""AI Brand Audit API endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from backend.app.api.dependencies import get_vector_store
from backend.app.models.audit import AuditRequest, AuditResponse
from backend.app.services.auditor import evaluate_draft
from backend.app.services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["audit"])


@router.post(
    "/scan",
    response_model=AuditResponse,
    status_code=status.HTTP_200_OK,
    summary="Scan draft copy for brand guideline compliance",
    description="Audits draft text against brand guidelines indexed in ChromaDB using Gemini 1.5 structured output.",
)
async def scan_draft(
    request: AuditRequest,
    vector_store: VectorStoreService = Depends(get_vector_store),
) -> AuditResponse:
    """
    Accepts AuditRequest with draft_text, queries ChromaDB for relevant guidelines,
    and returns structured AuditResponse with compliance score, summary, and violations.
    """
    try:
        response = await evaluate_draft(
            draft_text=request.draft_text,
            vector_store=vector_store,
        )
        return response
    except ValueError as val_err:
        logger.warning("Validation or configuration issue in audit scan: %s", val_err)
        status_code = (
            status.HTTP_500_INTERNAL_SERVER_ERROR
            if "GEMINI_API_KEY" in str(val_err)
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(
            status_code=status_code,
            detail=str(val_err),
        )
    except RuntimeError as exc:
        detail = str(exc)
        if detail.startswith("RATE_LIMIT:"):
            # Surface Gemini quota exhaustion as HTTP 429 so the client can back off
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail.removeprefix("RATE_LIMIT:").strip(),
            )
        logger.error("Error executing draft audit scan: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Brand audit evaluation failed: {detail}",
        )
    except Exception as exc:
        logger.error("Error executing draft audit scan: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Brand audit evaluation failed: {str(exc)}",
        )
