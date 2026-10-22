from typing import Any, Dict
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for application health check response."""

    status: str = Field(..., description="Application operational status")
    app_name: str = Field(..., description="Application name")
    version: str = Field(..., description="Application version")
    chroma_status: str = Field(..., description="ChromaDB connection status")


class GuidelineUploadResponse(BaseModel):
    """Schema for guideline file upload and indexing response."""

    filename: str = Field(..., description="Uploaded guideline filename")
    chunks_indexed: int = Field(..., description="Number of chunks indexed from this document")
    total_chunks: int = Field(..., description="Total chunks currently stored in vector store")


class GuidelineStatsResponse(BaseModel):
    """Schema for guideline store statistics response."""

    total_chunks: int = Field(..., description="Total indexed chunks in vector store")
    status: str = Field(..., description="Vector store health/operational status")


class GuidelineRuleMatch(BaseModel):
    """Schema for a matched guideline rule chunk."""

    text: str = Field(..., description="Rule chunk text")
    distance: float = Field(..., description="Vector similarity distance score")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata associated with chunk")
    source: str = Field(default="", description="Source document identifier")
