import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.document_parser import (
    chunk_text,
    extract_text,
    extract_text_from_md,
    extract_text_from_pdf,
    extract_text_from_txt,
)
from backend.app.services.vector_store import VectorStoreService


# Minimal valid PDF binary representation containing extractable text
VALID_PDF_BYTES = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 60 >>
stream
BT
/F1 12 Tf
100 700 Td
(Official Brand Typography and Logo Rules) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000323 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
433
%%EOF
"""


# ---------------------------------------------------------------------------
# 1. Document Parser & Chunking Unit Tests
# ---------------------------------------------------------------------------

def test_chunk_text_empty():
    """Verify chunk_text returns an empty list for empty or whitespace-only strings."""
    assert chunk_text("") == []
    assert chunk_text("   \n\t  ") == []


def test_chunk_text_small_text():
    """Verify short texts within chunk size limit return a single chunk."""
    content = "BrandGuard is an enterprise compliance coach."
    chunks = chunk_text(content, chunk_size=450, overlap=50)
    assert len(chunks) == 1
    assert chunks[0] == content


def test_chunk_text_logical_chunking_and_overlap():
    """
    Verify text with 1000 words produces overlapping chunks (~450 words, 50 word overlap)
    and ensures context continuity.
    """
    words = [f"token_{i}" for i in range(1000)]
    full_text = " ".join(words)

    chunks = chunk_text(full_text, chunk_size=450, overlap=50)

    # 1000 words with step = 400 (450 - 50):
    # Chunk 0: 0-450
    # Chunk 1: 400-850
    # Chunk 2: 800-1000
    assert len(chunks) == 3

    chunk_0_words = chunks[0].split()
    chunk_1_words = chunks[1].split()
    chunk_2_words = chunks[2].split()

    assert len(chunk_0_words) == 450
    assert len(chunk_1_words) == 450
    assert len(chunk_2_words) == 200

    # Verify overlap: last 50 words of chunk 0 should match first 50 words of chunk 1
    assert chunk_0_words[-50:] == chunk_1_words[:50]
    # Verify overlap: last 50 words of chunk 1 should match first 50 words of chunk 2
    assert chunk_1_words[-50:] == chunk_2_words[:50]


def test_extract_text_txt():
    """Verify plain text extraction from both str and bytes."""
    raw = "Our brand primary color is Pantone 296 C."
    assert extract_text_from_txt(raw) == raw
    assert extract_text_from_txt(raw.encode("utf-8")) == raw


def test_extract_text_md():
    """Verify Markdown text extraction preserves content."""
    md_content = "# Brand Guidelines\n\n* No Comic Sans\n* Use dark mode UI"
    assert extract_text_from_md(md_content.encode("utf-8")) == md_content


def test_extract_text_pdf():
    """Verify PDF text extraction using pypdf."""
    extracted = extract_text_from_pdf(VALID_PDF_BYTES)
    assert "Official Brand Typography and Logo Rules" in extracted


def test_extract_text_dispatcher():
    """Verify extract_text router correctly handles various extensions and raises on invalid ones."""
    txt_content = b"Simple brand guideline text"
    assert extract_text(txt_content, "rules.txt") == "Simple brand guideline text"
    assert extract_text(txt_content, "rules.md") == "Simple brand guideline text"
    assert "Official Brand Typography and Logo Rules" in extract_text(VALID_PDF_BYTES, "guide.pdf")

    with pytest.raises(ValueError, match="Unsupported file format"):
        extract_text(b"some content", "unsupported.docx")


# ---------------------------------------------------------------------------
# 2. Vector Store Service Unit Tests
# ---------------------------------------------------------------------------

def test_vector_store_service_lifecycle(tmp_path):
    """
    Test VectorStoreService methods:
    add_chunks, count_chunks, query_rules, and reset.
    """
    test_dir = str(tmp_path / "chroma_test")
    service = VectorStoreService(persist_directory=test_dir, collection_name="test_guidelines")
    service.reset()

    # Store initially empty
    assert service.count_chunks() == 0
    assert service.query_rules("test query") == []

    # Add chunks
    sample_chunks = [
        "Brand voice must always sound authoritative, helpful, and concise.",
        "Primary brand accent colors are deep navy (#0A192F) and slate cyan (#64FFDA).",
    ]
    added = service.add_chunks(sample_chunks, source="brand_guide.pdf", metadata={"department": "design"})
    assert added == 2
    assert service.count_chunks() == 2

    # Query rules
    results = service.query_rules("What are the brand colors?", n_results=1)
    assert len(results) == 1
    top_result = results[0]
    assert "deep navy" in top_result["text"]
    assert top_result["source"] == "brand_guide.pdf"
    assert "distance" in top_result
    assert top_result["metadata"]["department"] == "design"

    # Reset collection
    service.reset()
    assert service.count_chunks() == 0


# ---------------------------------------------------------------------------
# 3. API Guidelines Endpoints Integration Tests (TestClient)
# ---------------------------------------------------------------------------

def test_upload_text_file_and_persistence_via_api(tmp_path):
    """
    Test uploading a mock text file via TestClient:
    1. POST /api/guidelines/upload with a .txt file.
    2. Verify HTTP 200 and schema response.
    3. Query ChromaDB to ensure chunks persist and can be semantically retrieved.
    """
    with TestClient(app) as client:
        # Obtain vector store from app state and reset for clean isolation
        vector_store: VectorStoreService = app.state.vector_store
        vector_store.reset()

        guideline_text = (
            "Rule 1: Brand typography requires Inter for digital UI and Geist Mono for code.\n"
            "Rule 2: Never distort the brand mark or place it against low-contrast backgrounds.\n"
            "Rule 3: All CTA buttons must use high contrast enterprise styling."
        )

        response = client.post(
            "/api/guidelines/upload",
            files={"file": ("brand_rules.txt", guideline_text.encode("utf-8"), "text/plain")},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "brand_rules.txt"
        assert data["chunks_indexed"] >= 1
        assert data["total_chunks"] >= 1

        # Verify persistent query directly from ChromaDB
        query_matches = vector_store.query_rules("What font is required for digital UI?", n_results=2)
        assert len(query_matches) > 0
        assert "Inter" in query_matches[0]["text"]
        assert query_matches[0]["source"] == "brand_rules.txt"
        assert query_matches[0]["distance"] >= 0.0


def test_upload_markdown_file_via_api():
    """Verify uploading a mock markdown (.md) guideline via TestClient."""
    with TestClient(app) as client:
        md_text = "# Voice and Tone Guidelines\n\nAlways maintain a professional, calm, and coaching tone."
        response = client.post(
            "/api/guidelines/upload",
            files={"file": ("voice_tone.md", md_text.encode("utf-8"), "text/markdown")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "voice_tone.md"
        assert data["chunks_indexed"] >= 1


def test_upload_pdf_file_via_api():
    """Verify uploading a mock PDF (.pdf) guideline via TestClient."""
    with TestClient(app) as client:
        response = client.post(
            "/api/guidelines/upload",
            files={"file": ("brand_specs.pdf", VALID_PDF_BYTES, "application/pdf")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["filename"] == "brand_specs.pdf"
        assert data["chunks_indexed"] >= 1


def test_upload_invalid_extension_returns_400():
    """Verify uploading an unsupported file format returns 400 Bad Request."""
    with TestClient(app) as client:
        response = client.post(
            "/api/guidelines/upload",
            files={"file": ("unsupported.png", b"fake image bytes", "image/png")},
        )
        assert response.status_code == 400
        data = response.json()
        assert "Unsupported file format" in data["detail"]


def test_upload_empty_file_returns_400():
    """Verify uploading an empty file returns 400 Bad Request."""
    with TestClient(app) as client:
        response = client.post(
            "/api/guidelines/upload",
            files={"file": ("empty.txt", b"", "text/plain")},
        )
        assert response.status_code == 400
        data = response.json()
        assert "empty" in data["detail"].lower()


def test_get_guidelines_stats_via_api():
    """Verify GET /api/guidelines/stats returns valid count and operational status."""
    with TestClient(app) as client:
        response = client.get("/api/guidelines/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_chunks" in data
        assert isinstance(data["total_chunks"], int)
        assert data["status"] in ["operational", "ready", "degraded"]
        assert "sources" in data


def test_delete_guideline_file_via_api():
    """Verify deleting a specific guideline document removes its chunks."""
    with TestClient(app) as client:
        # Upload a guideline
        upload_resp = client.post(
            "/api/guidelines/upload",
            files={"file": ("to_delete.txt", b"Brand rule to be deleted immediately.", "text/plain")},
        )
        assert upload_resp.status_code == 200

        # Delete the guideline
        delete_resp = client.delete("/api/guidelines/file/to_delete.txt")
        assert delete_resp.status_code == 200
        del_data = delete_resp.json()
        assert "deleted" in del_data["message"].lower()

        # Check stats to verify source is no longer present
        stats_resp = client.get("/api/guidelines/stats")
        assert stats_resp.status_code == 200
        assert "to_delete.txt" not in stats_resp.json()["sources"]


def test_reset_guidelines_via_api():
    """Verify DELETE /api/guidelines/reset wipes all chunks and resets vector store."""
    with TestClient(app) as client:
        # Upload a test guideline
        client.post(
            "/api/guidelines/upload",
            files={"file": ("reset_test.txt", b"Rule before complete reset.", "text/plain")},
        )

        # Call reset endpoint
        response = client.delete("/api/guidelines/reset")
        assert response.status_code == 200
        data = response.json()
        assert "reset" in data["message"].lower()
        assert data["total_chunks"] == 0

        # Verify stats returns 0 chunks and empty sources
        stats_resp = client.get("/api/guidelines/stats")
        assert stats_resp.status_code == 200
        assert stats_resp.json()["total_chunks"] == 0
        assert stats_resp.json()["sources"] == []


