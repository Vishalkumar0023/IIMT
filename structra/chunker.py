"""
chunker.py — Text chunking logic using LangChain's RecursiveCharacterTextSplitter.
"""

from __future__ import annotations

from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_text(text: str, chunk_size: int, chunk_overlap: int) -> list[str]:
    """
    Split text into chunks using RecursiveCharacterTextSplitter.

    Args:
        text: The full text to split.
        chunk_size: Maximum size of each chunk in characters.
        chunk_overlap: Number of overlapping characters between chunks.

    Returns:
        List of chunk strings, each at least 100 characters long.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        is_separator_regex=False,
    )

    raw_chunks = splitter.split_text(text)

    # Filter out chunks shorter than 100 characters
    filtered_chunks = [chunk.strip() for chunk in raw_chunks if len(chunk.strip()) >= 100]

    return filtered_chunks
