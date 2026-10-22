"""Pydantic v2 schemas for the AI Brand Audit service."""

from typing import List, Literal
from pydantic import BaseModel, Field, field_validator

# Constrained literal types for Violation fields.
# A pre-validation normalizer lowercases and strips the raw string from Gemini
# so typos like 'CRITICAL' or ' High ' are coerced to the canonical form rather
# than falling through to the default badge in the UI.
SeverityLevel = Literal["low", "medium", "high", "critical"]
ViolationType = Literal["tone", "typography", "terminology", "color", "logo", "claims"]


class AuditRequest(BaseModel):
    """Schema for draft text brand audit request."""

    draft_text: str = Field(
        ...,
        min_length=1,
        max_length=50_000,
        description=(
            "The draft text content to evaluate against brand guidelines. "
            "Maximum 50,000 characters to stay within Gemini context limits."
        ),
    )


class Violation(BaseModel):
    """Schema for an individual brand guideline violation."""

    id: str = Field(
        ...,
        description="Unique identifier for the violation (e.g., viol-1)",
    )
    type: ViolationType = Field(
        ...,
        description="Category of guideline violation (tone, typography, terminology, color, logo, claims)",
    )
    severity: SeverityLevel = Field(
        ...,
        description="Impact severity level: low, medium, high, or critical",
    )
    flagged_text: str = Field(
        ...,
        description="Exact snippet from the draft text flagged for non-compliance",
    )
    citation: str = Field(
        ...,
        description="Direct quotation or reference from the official brand guideline chunk",
    )
    explanation: str = Field(
        ...,
        description="Coaching explanation describing why the text is non-compliant",
    )
    suggested_fix: str = Field(
        ...,
        description="Actionable 1-click replacement text resolving the violation",
    )

    @field_validator("severity", "type", mode="before")
    @classmethod
    def normalize_string_field(cls, v: object) -> str:
        """Coerce Gemini output to lowercase so 'CRITICAL' and 'High' map correctly."""
        if isinstance(v, str):
            return v.strip().lower()
        return v  # type: ignore[return-value]


class AuditResponse(BaseModel):
    """Schema for AI brand audit response containing compliance score and violations."""

    compliance_score: int = Field(
        ...,
        description="Brand compliance score between 0 (complete non-compliance) and 100 (fully compliant)",
    )
    summary: str = Field(
        ...,
        description="High-level executive coaching summary of the brand audit evaluation",
    )
    violations: List[Violation] = Field(
        default_factory=list,
        description="List of detected brand guideline violations; empty list if fully compliant",
    )

    @field_validator("compliance_score")
    @classmethod
    def validate_compliance_score(cls, v: int) -> int:
        """Validate compliance score is bounded within 0 to 100."""
        if not (0 <= v <= 100):
            raise ValueError("compliance_score must be between 0 and 100")
        return v

