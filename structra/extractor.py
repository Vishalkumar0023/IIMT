"""
extractor.py — File extraction logic for PDF and DOCX documents.
"""

import io
import pdfplumber
from docx import Document


def extract_text(file_bytes: bytes, filename: str) -> str:
    """
    Extract text content from uploaded file bytes.

    Args:
        file_bytes: Raw bytes of the uploaded file.
        filename: Original filename (used to determine file type).

    Returns:
        Cleaned text string extracted from the document.

    Raises:
        ValueError: If file type is unsupported or no text could be extracted.
    """
    lower_name = filename.lower()

    if lower_name.endswith(".pdf"):
        text = _extract_pdf(file_bytes)
    elif lower_name.endswith(".docx"):
        text = _extract_docx(file_bytes)
    else:
        raise ValueError("Only PDF and DOCX files are supported.")

    if not text or not text.strip():
        raise ValueError("No text could be extracted from this file.")

    return text.strip()


def _extract_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    pages_text = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            # Skip pages where extracted text is None or less than 20 chars
            if page_text and len(page_text.strip()) >= 20:
                pages_text.append(page_text.strip())
    return "\n\n".join(pages_text)


def _extract_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = []
    for para in doc.paragraphs:
        text = para.text.strip()
        # Skip empty paragraphs
        if text:
            paragraphs.append(text)
    return "\n\n".join(paragraphs)
