"""Document parsing and chunking services for brand guidelines ingestion."""

import io
import os
from pathlib import Path
from typing import BinaryIO, List, TextIO, Union
import pypdf


def extract_text_from_pdf(source: Union[str, Path, BinaryIO, bytes]) -> str:
    """
    Extract text content from a PDF file using pypdf.

    Args:
        source: File path, open binary file-like object, or bytes.

    Returns:
        Extracted text joined across all pages.
    """
    if isinstance(source, Path) or (isinstance(source, str) and os.path.exists(source)):
        with open(source, "rb") as f:
            reader = pypdf.PdfReader(f)
            pages_text = [page.extract_text() or "" for page in reader.pages]
    elif isinstance(source, bytes):
        stream = io.BytesIO(source)
        reader = pypdf.PdfReader(stream)
        pages_text = [page.extract_text() or "" for page in reader.pages]
    elif hasattr(source, "read"):
        # File-like stream (e.g. SpooledTemporaryFile or BytesIO)
        if hasattr(source, "seek"):
            source.seek(0)
        reader = pypdf.PdfReader(source)
        pages_text = [page.extract_text() or "" for page in reader.pages]
    else:
        raise ValueError("Invalid source format provided for PDF text extraction.")

    return "\n\n".join(text.strip() for text in pages_text if text.strip())


def extract_text_from_txt(source: Union[str, Path, BinaryIO, TextIO, bytes]) -> str:
    """
    Extract text content from a plain text (.txt) file or string.

    Args:
        source: File path, open file-like object, string content, or bytes.

    Returns:
        Extracted string content.
    """
    if isinstance(source, Path) or (isinstance(source, str) and os.path.exists(source)):
        with open(source, "r", encoding="utf-8", errors="replace") as f:
            return f.read().strip()
    elif isinstance(source, bytes):
        return source.decode("utf-8", errors="replace").strip()
    elif hasattr(source, "read"):
        if hasattr(source, "seek"):
            source.seek(0)
        content = source.read()
        if isinstance(content, bytes):
            return content.decode("utf-8", errors="replace").strip()
        return str(content).strip()
    return str(source).strip()


def extract_text_from_md(source: Union[str, Path, BinaryIO, TextIO, bytes]) -> str:
    """
    Extract text content from a Markdown (.md) file or string.

    Args:
        source: File path, open file-like object, string content, or bytes.

    Returns:
        Extracted string content.
    """
    return extract_text_from_txt(source)


def extract_text(source: Union[str, Path, BinaryIO, bytes], filename: str) -> str:
    """
    Extract text from a file based on its extension (.pdf, .txt, .md).

    Args:
        source: File path, open binary file-like object, or raw bytes.
        filename: Original name of the file with extension.

    Returns:
        Extracted text string.

    Raises:
        ValueError: If file extension is unsupported.
    """
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(source)
    elif ext == ".txt":
        return extract_text_from_txt(source)
    elif ext == ".md":
        return extract_text_from_md(source)
    else:
        raise ValueError(
            f"Unsupported file format '{ext}'. Supported formats: .pdf, .txt, .md"
        )


def chunk_text(text: str, chunk_size: int = 450, overlap: int = 50) -> List[str]:
    """
    Splits text into logical chunks of ~400-500 words with a small overlap (~50 words)
    to preserve contextual continuity across chunk boundaries.

    Args:
        text: Raw text to divide into chunks.
        chunk_size: Target words per chunk (default 450).
        overlap: Number of overlapping words between adjacent chunks (default 50).

    Returns:
        List of text chunks.
    """
    if not text or not text.strip():
        return []

    words = text.split()
    total_words = len(words)

    if total_words <= chunk_size:
        return [text.strip()]

    # Ensure step is positive to avoid infinite loops
    step = max(1, chunk_size - overlap)
    chunks: List[str] = []

    for i in range(0, total_words, step):
        chunk_words = words[i : i + chunk_size]
        chunk = " ".join(chunk_words).strip()
        if chunk:
            chunks.append(chunk)
        if i + chunk_size >= total_words:
            break

    return chunks

