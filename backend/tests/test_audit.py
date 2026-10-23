"""Tests for AI Brand Audit service and API endpoints with mocked Gemini calls."""

import json
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app.main import app
from backend.app.models.audit import AuditRequest, AuditResponse, Violation
from backend.app.services.auditor import evaluate_draft
from backend.app.services.vector_store import VectorStoreService


# ---------------------------------------------------------------------------
# Fixtures and Sample Data
# ---------------------------------------------------------------------------

SAMPLE_DRAFT_TEXT = (
    "Our product is the cheapest and most insane cloud platform available today. "
    "Contact our sales team to buy now."
)

SAMPLE_VIOLATIONS = [
    {
        "id": "viol-1",
        "type": "tone",
        "severity": "high",
        "flagged_text": "cheapest",
        "citation": "Always describe BrandGuard pricing as premium, predictable, and enterprise-grade.",
        "explanation": "The term 'cheapest' devalues brand perception and violates our enterprise positioning.",
        "suggested_fix": "most cost-effective",
    },
    {
        "id": "viol-2",
        "type": "terminology",
        "severity": "medium",
        "flagged_text": "insane",
        "citation": "Brand messaging must be authoritative, calm, and measured. Avoid sensationalist jargon.",
        "explanation": "Sensationalist words like 'insane' degrade professional trust.",
        "suggested_fix": "exceptional",
    },
]

MOCK_AUDIT_RESPONSE_DICT = {
    "compliance_score": 68,
    "summary": "Draft contains 2 brand violations regarding tone and sensationalist terminology.",
    "violations": SAMPLE_VIOLATIONS,
}

MOCK_COMPLIANT_RESPONSE_DICT = {
    "compliance_score": 100,
    "summary": "The draft adheres to all established brand voice and style guidelines.",
    "violations": [],
}


# ---------------------------------------------------------------------------
# 1. Pydantic Model Unit Tests
# ---------------------------------------------------------------------------

def test_audit_request_validation():
    """Verify AuditRequest requires non-empty draft_text."""
    req = AuditRequest(draft_text="Valid draft text content.")
    assert req.draft_text == "Valid draft text content."

    # Empty string should fail min_length=1
    with pytest.raises(ValidationError):
        AuditRequest(draft_text="")


def test_violation_and_response_schema():
    """Verify Violation and AuditResponse model structure and constraints."""
    violation = Violation(
        id="viol-101",
        type="typography",
        severity="low",
        flagged_text="Comic Sans",
        citation="Use Inter for digital UI and Geist Mono for code blocks.",
        explanation="Comic Sans is forbidden across all corporate materials.",
        suggested_fix="Inter",
    )
    assert violation.id == "viol-101"
    assert violation.type == "typography"
    assert violation.suggested_fix == "Inter"

    response = AuditResponse(
        compliance_score=95,
        summary="Minor typography inconsistency detected.",
        violations=[violation],
    )
    assert response.compliance_score == 95
    assert len(response.violations) == 1
    assert response.violations[0].flagged_text == "Comic Sans"

    # Verify compliance_score bounds (0-100)
    with pytest.raises(ValidationError):
        AuditResponse(compliance_score=105, summary="Invalid score", violations=[])

    with pytest.raises(ValidationError):
        AuditResponse(compliance_score=-5, summary="Invalid score", violations=[])


# ---------------------------------------------------------------------------
# 2. Service Unit Tests: evaluate_draft
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_evaluate_draft_with_mocked_gemini():
    """Verify evaluate_draft retrieves guidelines from vector store and invokes Gemini structured output."""
    mock_vector_store = MagicMock(spec=VectorStoreService)
    mock_vector_store.async_query_rules = AsyncMock(return_value=[
        {
            "text": "Rule 1: Always position BrandGuard as an enterprise solution. Never say 'cheapest'.",
            "distance": 0.15,
            "source": "brand_voice.pdf",
            "metadata": {"section": "pricing"},
        },
        {
            "text": "Rule 2: Avoid slang or hyperbole like 'insane' or 'crazy'.",
            "distance": 0.22,
            "source": "tone_guide.md",
            "metadata": {"section": "style"},
        },
    ])

    mock_gemini_response = MagicMock()
    mock_gemini_response.text = json.dumps(MOCK_AUDIT_RESPONSE_DICT)

    with patch(
        "google.generativeai.GenerativeModel.generate_content_async",
        new_callable=AsyncMock,
    ) as mock_generate:
        mock_generate.return_value = mock_gemini_response

        audit_result = await evaluate_draft(
            draft_text=SAMPLE_DRAFT_TEXT,
            vector_store=mock_vector_store,
            api_key="test-gemini-key",
        )

        # Assert vector store query called with draft text and n_results=5
        mock_vector_store.async_query_rules.assert_called_once_with(
            query=SAMPLE_DRAFT_TEXT,
            n_results=5,
        )

        # Assert Gemini received the generated prompt
        mock_generate.assert_called_once()
        sent_prompt = mock_generate.call_args[0][0]
        assert "BrandGuard" in sent_prompt
        assert "Rule 1: Always position BrandGuard" in sent_prompt
        assert SAMPLE_DRAFT_TEXT in sent_prompt

        # Verify parsed AuditResponse
        assert isinstance(audit_result, AuditResponse)
        assert audit_result.compliance_score == 68
        assert len(audit_result.violations) == 2
        assert audit_result.violations[0].flagged_text == "cheapest"
        assert audit_result.violations[0].suggested_fix == "most cost-effective"
        assert audit_result.violations[1].flagged_text == "insane"


@pytest.mark.anyio
async def test_evaluate_draft_markdown_fenced_gemini_response():
    """Verify evaluate_draft handles raw output wrapped in markdown code fences."""
    mock_vector_store = MagicMock(spec=VectorStoreService)
    mock_vector_store.async_query_rules = AsyncMock(return_value=[])

    mock_gemini_response = MagicMock()
    mock_gemini_response.text = f"```json\n{json.dumps(MOCK_COMPLIANT_RESPONSE_DICT)}\n```"

    with patch(
        "google.generativeai.GenerativeModel.generate_content_async",
        new_callable=AsyncMock,
    ) as mock_generate:
        mock_generate.return_value = mock_gemini_response

        audit_result = await evaluate_draft(
            draft_text="Our platform offers secure enterprise data isolation.",
            vector_store=mock_vector_store,
            api_key="test-gemini-key",
        )

        assert isinstance(audit_result, AuditResponse)
        assert audit_result.compliance_score == 100
        assert audit_result.violations == []


# ---------------------------------------------------------------------------
# 3. API Integration Tests: POST /api/audit/scan
# ---------------------------------------------------------------------------

def test_api_audit_scan_success_with_violations():
    """Verify POST /api/audit/scan returns HTTP 200 with structured AuditResponse."""
    mock_gemini_response = MagicMock()
    mock_gemini_response.text = json.dumps(MOCK_AUDIT_RESPONSE_DICT)

    with patch(
        "google.generativeai.GenerativeModel.generate_content_async",
        new_callable=AsyncMock,
    ) as mock_generate:
        mock_generate.return_value = mock_gemini_response

        with TestClient(app) as client:
            payload = {"draft_text": SAMPLE_DRAFT_TEXT}
            response = client.post("/api/audit/scan", json=payload)

            assert response.status_code == 200
            data = response.json()

            # Validate against AuditResponse schema
            validated = AuditResponse.model_validate(data)
            assert validated.compliance_score == 68
            assert len(validated.violations) == 2

            v1 = validated.violations[0]
            assert v1.id == "viol-1"
            assert v1.type == "tone"
            assert v1.severity == "high"
            assert v1.flagged_text == "cheapest"
            assert v1.suggested_fix == "most cost-effective"
            assert "brand perception" in v1.explanation


def test_api_audit_scan_fully_compliant():
    """Verify POST /api/audit/scan handles fully compliant draft correctly."""
    mock_gemini_response = MagicMock()
    mock_gemini_response.text = json.dumps(MOCK_COMPLIANT_RESPONSE_DICT)

    with patch(
        "google.generativeai.GenerativeModel.generate_content_async",
        new_callable=AsyncMock,
    ) as mock_generate:
        mock_generate.return_value = mock_gemini_response

        with TestClient(app) as client:
            payload = {"draft_text": "Enterprise cloud security engineered for trust and reliability."}
            response = client.post("/api/audit/scan", json=payload)

            assert response.status_code == 200
            data = response.json()
            validated = AuditResponse.model_validate(data)
            assert validated.compliance_score == 100
            assert validated.violations == []
            assert "adheres to all" in validated.summary


def test_api_audit_scan_validation_error_empty_draft():
    """Verify POST /api/audit/scan returns HTTP 422 for empty or invalid payload."""
    with TestClient(app) as client:
        # Empty string violates min_length=1
        response = client.post("/api/audit/scan", json={"draft_text": ""})
        assert response.status_code == 422

        # Missing field
        response = client.post("/api/audit/scan", json={})
        assert response.status_code == 422


def test_api_audit_scan_gemini_api_error():
    """Verify POST /api/audit/scan returns HTTP 500 when Gemini API fails with general error."""
    with patch(
        "google.generativeai.GenerativeModel.generate_content_async",
        side_effect=RuntimeError("Google Gemini connection timeout or internal error"),
    ):
        with TestClient(app) as client:
            response = client.post("/api/audit/scan", json={"draft_text": "Test draft copy."})
            assert response.status_code == 500
            data = response.json()
            assert "Brand audit evaluation failed" in data["detail"]


def test_api_audit_scan_gemini_rate_limit_error():
    """Verify POST /api/audit/scan returns HTTP 429 when Gemini API quota is exhausted."""
    with patch(
        "backend.app.services.auditor._RETRY_BASE_DELAY_SECS", 0.001
    ), patch(
        "google.generativeai.GenerativeModel.generate_content_async",
        side_effect=RuntimeError("Google Gemini API quota exceeded (ResourceExhausted 429)"),
    ):
        with TestClient(app) as client:
            response = client.post("/api/audit/scan", json={"draft_text": "Test draft copy."})
            assert response.status_code == 429
            data = response.json()
            assert "Gemini API quota exceeded" in data["detail"]

