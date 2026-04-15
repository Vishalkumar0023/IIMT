const pdfjs = globalThis.pdfjsLib;
const mammothLib = globalThis.mammoth;
const puterClient = globalThis.puter;

if (!pdfjs) {
  throw new Error("PDF.js failed to load.");
}

if (!mammothLib) {
  throw new Error("Mammoth failed to load.");
}

pdfjs.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const state = {
  sourceMode: "file",
  productMode: "ml",
  file: null,
  webUrl: "",
  extractedText: "",
  pageCount: null,
  chunks: [],
  filteredChunks: [],
  results: [],
  generatedCount: 0,
  acceptedCount: 0,
  dedupRemoved: 0,
  qualityAverage: 0,
  lastFormat: "ChatML",
  downloadContent: "",
  downloadExtension: "jsonl",
  reportContent: "",
  failures: {},
  runContext: null,
};

const $ = (id) => document.getElementById(id);

const els = {
  fileInput: $("fileInput"),
  webUrl: $("webUrl"),
  webSourcePanel: $("webSourcePanel"),
  model: $("model"),
  chunkSize: $("chunkSize"),
  chunkSizeValue: $("chunkSizeValue"),
  chunkOverlap: $("chunkOverlap"),
  chunkOverlapValue: $("chunkOverlapValue"),
  maxChunks: $("maxChunks"),
  temperature: $("temperature"),
  temperatureValue: $("temperatureValue"),
  pairsPerChunk: $("pairsPerChunk"),
  minChunkLength: $("minChunkLength"),
  minChunkLengthValue: $("minChunkLengthValue"),
  similarityThreshold: $("similarityThreshold"),
  similarityThresholdValue: $("similarityThresholdValue"),
  qualityCutoff: $("qualityCutoff"),
  qualityCutoffValue: $("qualityCutoffValue"),
  generateBtn: $("generateBtn"),
  resetBtn: $("resetBtn"),
  dropzone: $("dropzone"),
  fileInfoCard: $("fileInfoCard"),
  fileInfoGrid: $("fileInfoGrid"),
  metricChunksExtracted: $("metricChunksExtracted"),
  metricGeneratedLabel: $("metricGeneratedLabel"),
  metricAcceptedLabel: $("metricAcceptedLabel"),
  metricPairsGenerated: $("metricPairsGenerated"),
  metricPairsAccepted: $("metricPairsAccepted"),
  metricDedupRemoved: $("metricDedupRemoved"),
  statusCard: $("statusCard"),
  statusLine: $("statusLine"),
  progressPercent: $("progressPercent"),
  progressBar: $("progressBar"),
  progressPreview: $("progressPreview"),
  previewTitle: $("previewTitle"),
  previewSubtitle: $("previewSubtitle"),
  previewEmpty: $("previewEmpty"),
  previewWrap: $("previewWrap"),
  previewTable: $("previewTable"),
  downloadJsonl: $("downloadJsonl"),
  downloadReport: $("downloadReport"),
  heroTitle: $("heroTitle"),
  heroCopy: $("heroCopy"),
};

initialize();

function initialize() {
  bindRange(els.chunkSize, els.chunkSizeValue, (value) => `${value}`);
  bindRange(els.chunkOverlap, els.chunkOverlapValue, (value) => `${value}`);
  bindRange(els.temperature, els.temperatureValue, (value) => Number(value).toFixed(1));
  bindRange(els.minChunkLength, els.minChunkLengthValue, (value) => `${value}`);
  bindRange(els.similarityThreshold, els.similarityThresholdValue, (value) => Number(value).toFixed(2));
  bindRange(els.qualityCutoff, els.qualityCutoffValue, (value) => `${value}`);

  els.fileInput.addEventListener("change", onFileSelected);
  els.webUrl.addEventListener("input", () => {
    state.webUrl = els.webUrl.value.trim();
  });
  els.generateBtn.addEventListener("click", handleGenerate);
  els.resetBtn.addEventListener("click", resetAll);
  els.downloadJsonl.addEventListener("click", downloadPrimaryOutput);
  els.downloadReport.addEventListener("click", downloadReport);

  document.querySelectorAll('input[name="sourceMode"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.sourceMode = input.value;
      els.webSourcePanel.classList.toggle("hidden", state.sourceMode !== "web");
      resetRunOnly();
      renderHero();
    });
  });

  document.querySelectorAll('input[name="productMode"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.productMode = input.value;
      toggleModeSections();
      resetRunOnly();
      renderHero();
      renderPreview();
    });
  });

  els.dropzone.addEventListener("click", () => {
    if (state.sourceMode === "file") {
      els.fileInput.click();
    }
  });
  els.dropzone.addEventListener("dragover", (event) => {
    if (state.sourceMode !== "file") {
      return;
    }
    event.preventDefault();
    els.dropzone.classList.add("dragover");
  });
  els.dropzone.addEventListener("dragleave", () => {
    els.dropzone.classList.remove("dragover");
  });
  els.dropzone.addEventListener("drop", (event) => {
    if (state.sourceMode !== "file") {
      return;
    }
    event.preventDefault();
    els.dropzone.classList.remove("dragover");
    const [file] = event.dataTransfer.files || [];
    if (file) {
      els.fileInput.files = event.dataTransfer.files;
      onFileSelected({ target: { files: [file] } });
    }
  });

  toggleModeSections();
  renderHero();
  resetAll();
}

function bindRange(input, output, formatter) {
  const sync = () => {
    output.textContent = formatter(input.value);
  };
  sync();
  input.addEventListener("input", sync);
}

function toggleModeSections() {
  document.querySelectorAll(".llm-only").forEach((section) => {
    section.classList.toggle("hidden", state.productMode !== "llm");
  });
}

function renderHero() {
  if (state.productMode === "ml") {
    els.heroTitle.textContent = "Prepare structured ML-ready records from documents and web pages.";
    els.heroCopy.textContent = "Structra extracts raw content, chunks it, scores quality, removes near-duplicates, and exports a cleaned machine-learning dataset you can label, rank, or model downstream.";
    els.metricGeneratedLabel.textContent = "Records Generated";
    els.metricAcceptedLabel.textContent = "Records Accepted";
    els.previewTitle.textContent = "ML Dataset Preview";
    els.previewSubtitle.textContent = "Accepted normalized records with quality features will appear here.";
    els.downloadJsonl.textContent = "Download dataset";
  } else {
    els.heroTitle.textContent = "Turn source content into Grok-powered fine-tuning datasets.";
    els.heroCopy.textContent = "Structra extracts and filters source text, then uses Grok through Puter.js to build higher-quality ChatML or Alpaca training data.";
    els.metricGeneratedLabel.textContent = "Pairs Generated";
    els.metricAcceptedLabel.textContent = "Pairs Accepted";
    els.previewTitle.textContent = "Fine-Tune Preview";
    els.previewSubtitle.textContent = "Instruction / response pairs will stream in while generation runs.";
    els.downloadJsonl.textContent = "Download JSONL";
  }
}

async function onFileSelected(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    state.file = file;
    state.sourceMode = "file";
    document.querySelector('input[name="sourceMode"][value="file"]').checked = true;
    els.webSourcePanel.classList.add("hidden");
    resetRunOnly();
    await ingestCurrentSource();
  } catch (error) {
    showStatus(error.message || "Could not read the selected file.", true, 0);
  }
}

async function handleGenerate() {
  els.generateBtn.disabled = true;
  try {
    if (!hasActiveSource()) {
      await ingestCurrentSource();
    }

    if (!state.extractedText.trim()) {
      throw new Error("Provide a PDF, DOCX, or public web URL before generating.");
    }

    startRunState();

    if (state.productMode === "ml") {
      await runMlPipeline();
    } else {
      await runLlmPipeline();
    }
  } catch (error) {
    showStatus(error.message || "The run failed.", true);
  } finally {
    els.generateBtn.disabled = false;
  }
}

async function ingestCurrentSource() {
  showStatus("Extracting source content...", false, 0);

  if (state.sourceMode === "file") {
    if (!state.file) {
      throw new Error("Choose a PDF or DOCX file first.");
    }
    const extracted = await extractDocument(state.file);
    state.extractedText = normalizeWhitespace(extracted.text);
    state.pageCount = extracted.pageCount;
  } else {
    if (!state.webUrl) {
      throw new Error("Enter a public web URL first.");
    }
    const extracted = await extractWebPage(state.webUrl);
    state.extractedText = normalizeWhitespace(extracted.text);
    state.pageCount = null;
  }

  if (!state.extractedText) {
    throw new Error("No text could be extracted from the source.");
  }

  const settings = getSettings();
  state.chunks = chunkText(
    state.extractedText,
    settings.chunkSize,
    settings.chunkOverlap,
    settings.minChunkLength,
  );

  const deduped = deduplicateChunks(state.chunks, settings.similarityThreshold);
  const scoredChunks = deduped.accepted.map((chunk) => ({
    text: chunk,
    score: scoreChunkQuality(chunk),
  }));
  state.filteredChunks = scoredChunks.filter((entry) => entry.score >= settings.qualityCutoff);
  state.dedupRemoved = deduped.removedCount;
  state.qualityAverage = scoredChunks.length
    ? Math.round(scoredChunks.reduce((sum, entry) => sum + entry.score, 0) / scoredChunks.length)
    : 0;

  renderSourceInfo();
  renderMetrics();
  els.dropzone.classList.add("hidden");
  showStatus(
    `Ready. Extracted ${state.chunks.length} chunks, kept ${state.filteredChunks.length} after quality filtering.`,
    false,
    0,
  );
  els.fileInfoCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

function hasActiveSource() {
  return Boolean(state.extractedText && (state.file || state.webUrl));
}

async function extractDocument(file) {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    return extractPDF(file);
  }
  if (lowerName.endsWith(".docx")) {
    return extractDOCX(file);
  }
  throw new Error("Unsupported file type. Use PDF or DOCX.");
}

async function extractPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ").trim();
    if (pageText) {
      pages.push(pageText);
    }
  }

  return {
    text: pages.join("\n\n"),
    pageCount: pdf.numPages,
  };
}

async function extractDOCX(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammothLib.extractRawText({ arrayBuffer });
  return {
    text: result.value,
    pageCount: null,
  };
}

async function extractWebPage(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error("Could not fetch that URL in the browser. The site may block cross-origin requests.");
  }

  if (!response.ok) {
    throw new Error(`Web request failed with status ${response.status}.`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, noscript").forEach((node) => node.remove());
  const text = doc.body?.innerText || "";
  return { text, pageCount: null };
}

function chunkText(text, chunkSizeTokens, overlapTokens, minChunkLength) {
  const sentenceCandidates = text
    .replace(/\r/g, "")
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  const charBudget = chunkSizeTokens * 5;
  const overlapChars = overlapTokens * 5;
  const chunks = [];
  let currentChunk = "";

  sentenceCandidates.forEach((sentence) => {
    const proposed = currentChunk ? `${currentChunk} ${sentence}` : sentence;
    if (proposed.length <= charBudget || !currentChunk) {
      currentChunk = proposed;
      return;
    }

    const finalized = currentChunk.trim();
    if (finalized.length >= minChunkLength) {
      chunks.push(finalized);
    }
    const overlapText = finalized.slice(Math.max(0, finalized.length - overlapChars));
    currentChunk = normalizeWhitespace(`${overlapText} ${sentence}`);
  });

  if (currentChunk.trim().length >= minChunkLength) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function scoreChunkQuality(chunk) {
  const normalized = normalizeWhitespace(chunk);
  const words = tokenizeWords(normalized);
  const uniqueWords = new Set(words);
  const sentences = normalized.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
  const signalChars = normalized.replace(/[A-Za-z0-9\s]/g, "").length + normalized.replace(/[A-Za-z\s]/g, "").length;
  const junkRatio = normalized.length ? signalChars / normalized.length : 0;

  let score = 0;
  score += Math.min(normalized.length / 500, 1) * 30;
  score += Math.min(sentences / 5, 1) * 25;
  score += (words.length ? uniqueWords.size / words.length : 0) * 25;
  score += Math.min(words.length / 80, 1) * 20;
  if (junkRatio > 0.3) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function jaccardSimilarity(a, b) {
  const aSet = new Set(tokenizeWords(a));
  const bSet = new Set(tokenizeWords(b));
  if (!aSet.size && !bSet.size) {
    return 1;
  }
  const intersection = [...aSet].filter((token) => bSet.has(token)).length;
  const union = new Set([...aSet, ...bSet]).size;
  return union ? intersection / union : 0;
}

function deduplicateChunks(chunks, threshold) {
  const accepted = [];
  let removedCount = 0;

  chunks.forEach((chunk) => {
    const duplicate = accepted.some((existing) => jaccardSimilarity(existing, chunk) > threshold);
    if (duplicate) {
      removedCount += 1;
      return;
    }
    accepted.push(chunk);
  });

  return { accepted, removedCount };
}

async function runMlPipeline() {
  const settings = getSettings();
  const records = state.filteredChunks.slice(0, settings.maxChunks).map((entry, index) => {
    const text = entry.text;
    const words = tokenizeWords(text);
    const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean).length;
    return {
      id: index + 1,
      source: state.sourceMode === "file" ? (state.file?.name || "file") : state.webUrl,
      snippet: text,
      quality_score: entry.score,
      word_count: words.length,
      sentence_count: sentences,
      vocabulary_diversity: words.length ? Number((new Set(words).size / words.length).toFixed(3)) : 0,
      mode: "ml_dataset",
    };
  });

  state.results = [];
  state.generatedCount = records.length;
  state.acceptedCount = records.length;
  state.lastFormat = "jsonl";

  for (let index = 0; index < records.length; index += 1) {
    state.results.push(records[index]);
    renderMetrics();
    renderPreview();
    showStatus(
      `Prepared ${index + 1} of ${records.length} ML records.`,
      false,
      records.length ? ((index + 1) / records.length) * 100 : 100,
      records[index].snippet,
    );
    await delay(40);
  }

  state.downloadContent = records.map((record) => JSON.stringify(record)).join("\n");
  state.downloadExtension = "jsonl";
  state.reportContent = buildReport({ formatLabel: "ML Dataset", styleLabel: "Quality-ranked records" });
  els.downloadJsonl.disabled = !state.downloadContent;
  els.downloadReport.disabled = !state.reportContent;
  showStatus(`ML dataset ready with ${records.length} accepted records.`, false, 100);
}

async function runLlmPipeline() {
  const settings = getSettings();
  if (!puterClient?.ai?.chat) {
    throw new Error("Puter.js is not available in the page.");
  }

  const chunksToProcess = state.filteredChunks.slice(0, settings.maxChunks);
  if (!chunksToProcess.length) {
    throw new Error("No chunks passed the current quality filter.");
  }

  state.results = [];
  state.generatedCount = 0;
  state.acceptedCount = 0;
  state.failures = {};
  state.lastFormat = settings.outputFormat;

  for (let index = 0; index < chunksToProcess.length; index += 1) {
    const chunkEntry = chunksToProcess[index];
    const prompt = buildPrompt(chunkEntry.text, settings.datasetStyle, settings.pairsPerChunk);
    showStatus(
      `Generating pairs for chunk ${index + 1} of ${chunksToProcess.length}.`,
      false,
      (index / chunksToProcess.length) * 100,
      chunkEntry.text,
    );

    try {
      const response = await puterClient.ai.chat(prompt, {
        model: settings.model,
        temperature: settings.temperature,
      });
      const parsed = parseGrokResponse(response?.message?.content ?? "");
      state.generatedCount += parsed.length;

      parsed.forEach((pair) => {
        if (!validatePair(pair)) {
          incrementFailure("Rejected low-quality pair");
          return;
        }
        state.results.push({
          instruction: pair.instruction.trim(),
          response: pair.response.trim(),
        });
        state.acceptedCount += 1;
      });
    } catch (error) {
      incrementFailure(error.message || "Generation request failed");
    }

    renderMetrics();
    renderPreview();
    await delay(300);
  }

  state.downloadContent = state.results
    .map((pair) => JSON.stringify(formatOutputPair(pair, settings.outputFormat)))
    .join("\n");
  state.downloadExtension = "jsonl";
  state.reportContent = buildReport({
    formatLabel: settings.outputFormat,
    styleLabel: datasetStyleLabel(settings.datasetStyle),
  });
  els.downloadJsonl.disabled = !state.downloadContent;
  els.downloadReport.disabled = !state.reportContent;

  if (!state.results.length) {
    const topFailure = Object.entries(state.failures).sort((a, b) => b[1] - a[1])[0]?.[0] || "No valid pairs were produced.";
    throw new Error(topFailure);
  }

  showStatus(`Fine-tuning dataset ready with ${state.acceptedCount} accepted pairs.`, false, 100);
}

function buildPrompt(chunk, datasetStyle, pairCount) {
  const templates = {
    hard_qa: `You are building a fine-tuning dataset. Given the following document excerpt, generate ${pairCount} hard question-answer pairs that test deep comprehension. Questions should be specific, not answerable by skimming. Avoid trivial or yes/no questions.

Document excerpt:
${chunk}

Return ONLY a JSON array:
[{"instruction": "...", "response": "..."}, ...]
No other text. No markdown. No explanation.`,
    instruction: `Given this document excerpt, generate ${pairCount} instruction-response training pairs. Instructions should be clear task requests a user might give. Responses should be complete and helpful.

Document excerpt:
${chunk}

Return ONLY a JSON array:
[{"instruction": "...", "response": "..."}, ...]
No other text.`,
    concise: `Generate ${pairCount} concise question-answer pairs from this excerpt. Answers must be under 3 sentences. Focus on factual, extractable information.

Document excerpt:
${chunk}

Return ONLY a JSON array:
[{"instruction": "...", "response": "..."}, ...]
No other text.`,
    exam: `Create ${pairCount} exam-style questions with detailed model answers from this document excerpt. Questions should require synthesis and analysis. Answers should be structured and complete.

Document excerpt:
${chunk}

Return ONLY a JSON array:
[{"instruction": "...", "response": "..."}, ...]
No other text.`,
  };

  return templates[datasetStyle] || templates.hard_qa;
}

function parseGrokResponse(rawText) {
  if (!rawText) {
    return [];
  }

  try {
    const direct = JSON.parse(rawText);
    return normalizeParsedItems(direct);
  } catch (error) {
    // continue
  }

  const arrayMatch = rawText.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return normalizeParsedItems(JSON.parse(arrayMatch[0]));
    } catch (error) {
      // continue
    }
  }

  const objectMatches = rawText.match(/\{[^{}]+\}/g);
  if (objectMatches) {
    const objects = objectMatches
      .map((entry) => {
        try {
          return JSON.parse(entry);
        } catch (error) {
          return null;
        }
      })
      .filter(Boolean);
    if (objects.length) {
      return normalizeParsedItems(objects);
    }
  }

  const labeled = extractLabeledPairs(rawText);
  if (labeled.length) {
    return labeled;
  }

  console.warn("Unparsed Grok response:", rawText);
  return [];
}

function normalizeParsedItems(data) {
  const items = Array.isArray(data) ? data : [data];
  return items
    .map((item) => ({
      instruction: item?.instruction || item?.question || item?.input || "",
      response: item?.response || item?.answer || item?.output || "",
    }))
    .filter((item) => item.instruction && item.response);
}

function extractLabeledPairs(rawText) {
  const lines = rawText.split("\n").map((line) => line.trim()).filter(Boolean);
  const results = [];
  let pendingInstruction = "";

  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (/^(instruction|question|input)\s*:/.test(lower)) {
      pendingInstruction = line.split(/:\s*/, 2)[1] || "";
      return;
    }
    if (/^(response|answer|output)\s*:/.test(lower) && pendingInstruction) {
      results.push({
        instruction: pendingInstruction,
        response: line.split(/:\s*/, 2)[1] || "",
      });
      pendingInstruction = "";
    }
  });

  return results.filter((entry) => entry.instruction && entry.response);
}

function validatePair(pair) {
  if (!pair || typeof pair.instruction !== "string" || typeof pair.response !== "string") {
    return false;
  }

  const instruction = normalizeWhitespace(pair.instruction);
  const response = normalizeWhitespace(pair.response);
  const refusalPhrases = ["i cannot", "i don't know", "as an ai", "i'm sorry"];

  if (instruction.length < 15 || response.length < 20) {
    return false;
  }
  if (instruction === response) {
    return false;
  }
  if (jaccardSimilarity(instruction, response) > 0.85) {
    return false;
  }
  if (refusalPhrases.some((phrase) => response.toLowerCase().includes(phrase))) {
    return false;
  }
  return true;
}

function formatOutputPair(pair, format) {
  if (format === "Alpaca") {
    return {
      instruction: pair.instruction,
      input: "",
      output: pair.response,
    };
  }

  return {
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: pair.instruction },
      { role: "assistant", content: pair.response },
    ],
  };
}

function buildReport({ formatLabel, styleLabel }) {
  const acceptRate = state.generatedCount
    ? ((state.acceptedCount / state.generatedCount) * 100).toFixed(1)
    : "0.0";

  return [
    "Structra Run Report",
    "===================",
    `Date: ${new Date().toISOString()}`,
    `Source: ${state.sourceMode === "file" ? (state.file?.name || "file") : state.webUrl}`,
    `Mode: ${state.productMode === "ml" ? "ML Dataset Builder" : "LLM Fine-Tune Builder"}`,
    `Model: ${state.productMode === "llm" ? getSettings().model : "N/A"}`,
    `Format: ${formatLabel}`,
    `Style: ${styleLabel}`,
    "",
    `Chunks extracted:      ${state.chunks.length}`,
    `After quality filter:  ${state.filteredChunks.length}`,
    `After dedup:           ${state.chunks.length - state.dedupRemoved}`,
    `Chunks processed:      ${Math.min(state.filteredChunks.length, getSettings().maxChunks)}`,
    "",
    `Pairs generated:       ${state.generatedCount}`,
    `Pairs accepted:        ${state.acceptedCount}`,
    `Pairs rejected:        ${Math.max(state.generatedCount - state.acceptedCount, 0)}`,
    `Accept rate:           ${acceptRate}%`,
    "",
    `Quality score avg:     ${state.qualityAverage}/100`,
    `Duplicates removed:    ${state.dedupRemoved}`,
  ].join("\n");
}

function renderSourceInfo() {
  const sizeLabel = state.file ? formatFileSize(state.file.size) : "Web source";
  const sourceLabel = state.sourceMode === "file" ? state.file?.name || "File" : state.webUrl;
  const sourceType = state.sourceMode === "file" ? "Document upload" : "Web fetch";

  els.fileInfoGrid.innerHTML = [
    { label: "Source", value: sourceLabel },
    { label: "Type", value: sourceType },
    { label: "Size", value: sizeLabel },
    { label: "Pages", value: state.pageCount ?? "N/A" },
  ]
    .map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(String(item.value))}</strong></article>`)
    .join("");
  els.fileInfoCard.classList.remove("hidden");
}

function renderMetrics() {
  els.metricChunksExtracted.textContent = String(state.chunks.length);
  els.metricPairsGenerated.textContent = String(state.generatedCount);
  els.metricPairsAccepted.textContent = String(state.acceptedCount);
  els.metricDedupRemoved.textContent = String(state.dedupRemoved);
}

function renderPreview() {
  if (!state.results.length) {
    els.previewEmpty.classList.remove("hidden");
    els.previewWrap.classList.add("hidden");
    return;
  }

  const head = els.previewTable.querySelector("thead");
  const body = els.previewTable.querySelector("tbody");

  if (state.productMode === "ml") {
    head.innerHTML = "<tr><th>ID</th><th>Snippet</th><th>Quality</th><th>Words</th></tr>";
    body.innerHTML = state.results.slice(0, 10).map((record) => `
      <tr>
        <td>${record.id}</td>
        <td title="${escapeHtml(record.snippet)}">${escapeHtml(record.snippet)}</td>
        <td>${record.quality_score}</td>
        <td>${record.word_count}</td>
      </tr>
    `).join("");
  } else {
    head.innerHTML = "<tr><th>Instruction</th><th>Response</th></tr>";
    body.innerHTML = state.results.slice(0, 10).map((record) => `
      <tr>
        <td title="${escapeHtml(record.instruction)}">${escapeHtml(record.instruction)}</td>
        <td title="${escapeHtml(record.response)}">${escapeHtml(record.response)}</td>
      </tr>
    `).join("");
  }

  els.previewEmpty.classList.add("hidden");
  els.previewWrap.classList.remove("hidden");
}

function showStatus(message, isError = false, percent = 0, preview = "") {
  els.statusCard.classList.remove("hidden");
  els.statusLine.textContent = message;
  els.progressPercent.textContent = `${Math.round(percent)}%`;
  els.progressBar.style.width = `${percent}%`;
  if (preview) {
    els.progressPreview.textContent = preview.slice(0, 900);
  }
  els.statusCard.style.borderColor = isError ? "rgba(239,68,68,0.55)" : "var(--border)";
}

function startRunState() {
  state.results = [];
  state.generatedCount = 0;
  state.acceptedCount = 0;
  state.downloadContent = "";
  state.reportContent = "";
  state.failures = {};
  els.downloadJsonl.disabled = true;
  els.downloadReport.disabled = true;
  renderPreview();
  renderMetrics();
}

function resetRunOnly() {
  state.results = [];
  state.generatedCount = 0;
  state.acceptedCount = 0;
  state.dedupRemoved = 0;
  state.qualityAverage = 0;
  state.downloadContent = "";
  state.reportContent = "";
  state.failures = {};
  els.downloadJsonl.disabled = true;
  els.downloadReport.disabled = true;
  els.statusCard.classList.add("hidden");
  renderMetrics();
  renderPreview();
}

function resetAll() {
  state.file = null;
  state.webUrl = "";
  state.extractedText = "";
  state.pageCount = null;
  state.chunks = [];
  state.filteredChunks = [];
  resetRunOnly();
  els.fileInput.value = "";
  els.webUrl.value = "";
  els.fileInfoCard.classList.add("hidden");
  els.dropzone.classList.remove("hidden");
  els.dropzone.classList.remove("dragover");
  renderHero();
}

function downloadPrimaryOutput() {
  if (!state.downloadContent) {
    return;
  }
  const blob = new Blob([state.downloadContent], {
    type: state.downloadExtension === "jsonl" ? "application/jsonl" : "text/plain;charset=utf-8",
  });
  triggerDownload(blob, primaryFileName());
}

function downloadReport() {
  if (!state.reportContent) {
    return;
  }
  const blob = new Blob([state.reportContent], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, `structra_report_${Date.now()}.txt`);
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function primaryFileName() {
  const stem = state.sourceMode === "file"
    ? (state.file?.name || "structra").replace(/\.[^.]+$/, "")
    : "structra_web";
  return `${stem}_${state.productMode === "ml" ? "ml_dataset" : "llm_dataset"}_${Date.now()}.${state.downloadExtension}`;
}

function getSettings() {
  return {
    model: els.model.value,
    outputFormat: getRadioValue("outputFormat"),
    datasetStyle: getRadioValue("datasetStyle"),
    chunkSize: Number(els.chunkSize.value),
    chunkOverlap: Number(els.chunkOverlap.value),
    maxChunks: Number(els.maxChunks.value),
    temperature: Number(els.temperature.value),
    pairsPerChunk: Number(els.pairsPerChunk.value),
    minChunkLength: Number(els.minChunkLength.value),
    similarityThreshold: Number(els.similarityThreshold.value),
    qualityCutoff: Number(els.qualityCutoff.value),
  };
}

function getRadioValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value;
}

function incrementFailure(reason) {
  state.failures[reason] = (state.failures[reason] || 0) + 1;
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function tokenizeWords(text) {
  return (text.toLowerCase().match(/\b[a-z0-9]+\b/g) || []);
}

function formatFileSize(bytes) {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}

function datasetStyleLabel(value) {
  return {
    hard_qa: "Hard Q/A",
    instruction: "Instruction",
    concise: "Concise",
    exam: "Exam",
  }[value] || value;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
