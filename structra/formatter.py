"""
formatter.py — JSONL output formatting and report generation.
"""

from __future__ import annotations

import json
from datetime import datetime


def to_jsonl(pairs: list[dict], output_format: str) -> str:
    """
    Convert a list of pairs to JSONL string based on the output format.

    Args:
        pairs: List of generated instruction-response dicts.
        output_format: Either "ChatML" or "Alpaca".

    Returns:
        JSONL-formatted string.
    """
    if output_format == "ChatML":
        return to_chatml_jsonl(pairs)
    else:
        return _to_alpaca_jsonl(pairs)


def to_chatml_jsonl(pairs: list[dict]) -> str:
    """
    Format pairs as ChatML JSONL.

    Each line: {"messages": [{"role": "user", "content": ...}, {"role": "assistant", "content": ...}]}

    Args:
        pairs: List of dicts with "instruction" and "response" keys.

    Returns:
        JSONL string with ChatML formatting.
    """
    lines = []
    for pair in pairs:
        entry = {
            "messages": [
                {"role": "user", "content": pair.get("instruction", "")},
                {"role": "assistant", "content": pair.get("response", "")},
            ]
        }
        lines.append(json.dumps(entry, ensure_ascii=False))
    return "\n".join(lines)


def _to_alpaca_jsonl(pairs: list[dict]) -> str:
    """
    Format pairs as Alpaca JSONL.

    Each line: {"instruction": ..., "input": ..., "output": ...}

    Args:
        pairs: List of dicts with "instruction", "input", and "output" keys.

    Returns:
        JSONL string with Alpaca formatting.
    """
    lines = []
    for pair in pairs:
        entry = {
            "instruction": pair.get("instruction", ""),
            "input": pair.get("input", ""),
            "output": pair.get("output", ""),
        }
        lines.append(json.dumps(entry, ensure_ascii=False))
    return "\n".join(lines)


def generate_report(
    pairs: list[dict],
    filename: str,
    processing_time: float,
    total_chunks: int,
    failed_reasons: dict[str, int] | None = None,
) -> str:
    """
    Generate a plain text summary report of the dataset generation run.

    Args:
        pairs: List of successfully generated pairs.
        filename: Original uploaded filename.
        processing_time: Total processing time in seconds.
        total_chunks: Total number of chunks that were processed.
        failed_reasons: Mapping of failure reason to count.

    Returns:
        Plain text report string.
    """
    successful = len(pairs)
    failed = total_chunks - successful
    success_rate = (successful / total_chunks * 100) if total_chunks > 0 else 0.0

    report_lines = [
        "=" * 60,
        "STRUCTRA.AI — Dataset Generation Report",
        "=" * 60,
        "",
        f"Filename:            {filename}",
        f"Timestamp:           {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"Processing Time:     {processing_time:.1f} seconds",
        "",
        "-" * 40,
        "Statistics",
        "-" * 40,
        f"Total Chunks:        {total_chunks}",
        f"Successful Pairs:    {successful}",
        f"Failed Chunks:       {failed}",
        f"Success Rate:        {success_rate:.1f}%",
        "",
    ]

    # Preview first 3 pairs
    if pairs:
        report_lines.append("-" * 40)
        report_lines.append("Preview (first 3 pairs)")
        report_lines.append("-" * 40)

        for i, pair in enumerate(pairs[:3], start=1):
            report_lines.append(f"\n--- Pair {i} ---")
            if "instruction" in pair:
                report_lines.append(f"Instruction: {pair['instruction']}")
            if "response" in pair:
                report_lines.append(f"Response:    {pair['response']}")
            if "input" in pair:
                report_lines.append(f"Input:       {pair['input']}")
            if "output" in pair:
                report_lines.append(f"Output:      {pair['output']}")

    if failed_reasons:
        report_lines.append("")
        report_lines.append("-" * 40)
        report_lines.append("Failure Summary")
        report_lines.append("-" * 40)
        for reason, count in sorted(failed_reasons.items(), key=lambda item: (-item[1], item[0])):
            report_lines.append(f"{count:>3}x  {reason}")

    report_lines.append("")
    report_lines.append("=" * 60)
    report_lines.append("End of Report")
    report_lines.append("=" * 60)

    return "\n".join(report_lines)
