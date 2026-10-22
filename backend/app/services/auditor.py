"""AI Brand Audit Service evaluating draft content against vector store brand guidelines."""

import json
import logging
import os
import warnings
from typing import List, Optional

with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=FutureWarning)
    import google.generativeai as genai

from backend.app.core.config import settings
from backend.app.models.audit import AuditResponse
from backend.app.services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)


def _clean_json_markdown(raw_text: str) -> str:
    """Strip markdown code fence wrappers from raw JSON output if present."""
    text = raw_text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _build_audit_prompt(draft_text: str, retrieved_chunks: List[dict]) -> str:
    """Build strict, zero-hallucination RAG prompt for Gemini brand audit."""
    if retrieved_chunks:
        chunk_blocks = []
        for i, chunk in enumerate(retrieved_chunks, 1):
            source = chunk.get("source", "Brand Guidelines")
            text = chunk.get("text", "").strip()
            chunk_blocks.append(f"--- [Guideline Chunk {i} | Source: {source}] ---\n{text}")
        guidelines_section = "\n\n".join(chunk_blocks)
    else:
        guidelines_section = "NO BRAND GUIDELINE CHUNKS FOUND IN KNOWLEDGE BASE."

    prompt = f"""You are BrandGuard, an enterprise AI brand compliance and coaching specialist.
Your core philosophy is "coach, not a filter." You empower authors to align their copy with official brand guidelines.

CRITICAL RAG RESTRICTIONS & EVALUATION RULES:
1. Strict Grounding: You must evaluate the draft ONLY against the official brand guideline chunks provided below.
2. Zero Hallucination: Do NOT hallucinate, infer, or invent rules, industry best practices, or personal stylistic preferences that are not explicitly stated in the retrieved guideline chunks.
3. If no guideline chunks are provided, or if the draft violates none of the provided rules, return a compliance_score of 100, an encouraging coaching summary, and an empty violations list [].
4. For every genuine violation identified:
   - "id": Unique violation identifier (e.g. "viol-1", "viol-2").
   - "type": Rule category (e.g. "tone", "typography", "terminology", "color", "logo", "claims").
   - "severity": Violation impact level ("low", "medium", "high", "critical").
   - "flagged_text": The exact or near-exact snippet from the draft violating the rule.
   - "citation": Direct quote or excerpt from the retrieved guideline chunk establishing the rule.
   - "explanation": An objective coaching explanation of why this violates the brand rule.
   - "suggested_fix": A high-quality, drop-in replacement that the author can apply with 1 click.
5. "compliance_score": An integer from 0 to 100 reflecting overall compliance (100 = full adherence, 0 = severe non-compliance).
6. "summary": A concise executive summary of the audit findings.

RETRIEVED BRAND GUIDELINES (SOURCE OF TRUTH):
{guidelines_section}

DRAFT TEXT TO AUDIT:
\"\"\"{draft_text}\"\"\"
"""
    return prompt


async def evaluate_draft(
    draft_text: str,
    vector_store: Optional[VectorStoreService] = None,
    api_key: Optional[str] = None,
    model_name: Optional[str] = None,
) -> AuditResponse:
    """
    Evaluate draft text against brand guidelines indexed in ChromaDB using Gemini 1.5.

    Args:
        draft_text: Text content to be evaluated.
        vector_store: Optional VectorStoreService instance for dependency injection.
        api_key: Optional Gemini API key override. Defaults to settings.GEMINI_API_KEY.
        model_name: Optional Gemini model name override. Defaults to settings.GEMINI_MODEL.

    Returns:
        Validated AuditResponse Pydantic model.
    """
    # 1. Query ChromaDB brand_guidelines collection for top 5 relevant guideline chunks
    if vector_store is None:
        vector_store = VectorStoreService()

    logger.info("Querying ChromaDB for brand guidelines relevant to draft (length: %d chars)", len(draft_text))
    retrieved_chunks = await vector_store.async_query_rules(query=draft_text, n_results=5)
    logger.info("Retrieved %d relevant guideline chunks from ChromaDB", len(retrieved_chunks))

    # 2. Configure Gemini API key
    key = api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
    if key:
        genai.configure(api_key=key)
    elif not os.environ.get("PYTEST_CURRENT_TEST"):
        raise ValueError(
            "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your environment or .env file."
        )

    # 3. Construct prompt
    prompt = _build_audit_prompt(draft_text=draft_text, retrieved_chunks=retrieved_chunks)

    # 4. Invoke Gemini with structured output matching AuditResponse schema
    selected_model = model_name or settings.GEMINI_MODEL or "gemini-1.5-pro"
    logger.info("Evaluating draft with model '%s' and structured output", selected_model)

    model = genai.GenerativeModel(
        model_name=selected_model,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=AuditResponse,
            temperature=0.1,
        ),
    )

    try:
        response = await model.generate_content_async(prompt)
    except Exception as exc:
        logger.error("Gemini API call failed: %s", exc, exc_info=True)
        raise RuntimeError(f"Gemini API generation error: {exc}") from exc

    raw_text = response.text or "{}"
    clean_text = _clean_json_markdown(raw_text)

    try:
        audit_result = AuditResponse.model_validate_json(clean_text)
        logger.info(
            "Audit complete: compliance_score=%d, violations_count=%d",
            audit_result.compliance_score,
            len(audit_result.violations),
        )
        return audit_result
    except Exception as parse_exc:
        logger.warning("Direct JSON validation failed (%s), attempting dictionary fallback", parse_exc)
        try:
            parsed_dict = json.loads(clean_text)
            return AuditResponse.model_validate(parsed_dict)
        except Exception:
            logger.error("Failed to parse Gemini output into AuditResponse: %s. Raw output: %s", parse_exc, raw_text)
            raise ValueError(f"Failed to validate response against AuditResponse schema: {parse_exc}") from parse_exc

