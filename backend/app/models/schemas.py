from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for application health check response."""

    status: str = Field(..., description="Application operational status")
    app_name: str = Field(..., description="Application name")
    version: str = Field(..., description="Application version")
    chroma_status: str = Field(..., description="ChromaDB connection status")

