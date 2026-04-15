# Structra

Structra is a static browser app that turns PDFs, DOCX files, and public web pages into:

- quality-ranked ML dataset records
- ChatML fine-tuning datasets
- Alpaca fine-tuning datasets

The interface is designed as a polished product-style workspace, while the processing still happens client-side in the browser.

## Run

```bash
cd /Users/vishalmahto/Desktop/IIMT_P/structra/web
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## What it does

1. Extracts text from `PDF`, `DOCX`, or a public web page
2. Splits content into overlap-aware chunks
3. Scores chunk quality and removes near-duplicates
4. Builds either:
   - ML-ready structured records
   - Grok-powered fine-tuning pairs through `Puter.js`
5. Streams preview results in the browser
6. Exports dataset output and a run report

## Runtime model

- No Streamlit
- No backend server
- No build step
- No API key stored in the codebase

## Fine-tuning path

For LLM dataset generation, Structra uses:

- `Puter.js`
- `puter.ai.chat(...)`
- `xAI Grok` models selected in the UI

If you need a second Puter account, open Structra in an incognito window or a separate browser profile and sign in there.
