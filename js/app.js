/**
 * NOOR RAG â€” RAG Document Intelligence
 * Built by Hafiz Farrukh Abbas
 *
 * ARCHITECTURE: Retrieval-Augmented Generation (RAG) Workflow
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * 1. PDF Ingestion   â†’ pdf.js extracts raw text per page
 * 2. Chunking        â†’ text split into overlapping page-chunks with metadata
 * 3. Retrieval       â†’ keyword search finds top-K relevant chunks per query
 * 4. Augmentation    â†’ retrieved chunks injected into Claude's context
 * 5. Generation      â†’ Claude answers ONLY from provided context (no hallucination)
 * 6. Citation        â†’ prompt enforces [Â§X.X, p.N] format for every claim
 */

// â”€â”€â”€ CONFIG â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CONFIG = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 1500,
  chunkSize: 1500,       // characters per chunk
  chunkOverlap: 200,     // overlap between chunks
  topKChunks: 8,         // chunks to retrieve per query
  maxContextChars: 12000 // max chars to send as context
};

// â”€â”€â”€ STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let state = {
  docLoaded: false,
  fullText: "",
  pageTexts: [],         // array of { page: N, text: "..." }
  chunks: [],            // array of { id, page, text, keywords }
  conversationHistory: [],
  isProcessing: false,
  analysisRun: false
};

// â”€â”€â”€ INIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initUpload();
  initChat();
  initSuggestedQuestions();
});

// â”€â”€â”€ TABS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    });
  });
}

// â”€â”€â”€ PDF UPLOAD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initUpload() {
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');
  const uploadZone = document.getElementById('uploadZone');

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => { if (e.target.files[0]) loadPDF(e.target.files[0]); });

  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.style.borderColor = 'var(--blue)'; });
  uploadZone.addEventListener('dragleave', () => { uploadZone.style.borderColor = ''; });
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.style.borderColor = '';
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') loadPDF(file);
  });
}

async function loadPDF(file) {
  setStatus('active', 'Parsing PDF...');
  document.getElementById('uploadBtn').textContent = 'Parsingâ€¦';

  try {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;
    state.pageTexts = [];

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      state.pageTexts.push({ page: i, text: pageText });
    }

    state.fullText = state.pageTexts.map(p => p.text).join('\n');
    state.chunks = chunkDocument(state.pageTexts);

    // Update UI
    const wordCount = state.fullText.split(/\s+/).length;
    document.getElementById('docName').textContent = file.name;
    document.getElementById('docMeta').textContent = `${totalPages} pages Â· ${formatNum(wordCount)} words`;
    document.getElementById('statPages').textContent = totalPages;
    document.getElementById('statWords').textContent = formatNum(Math.round(wordCount / 1000)) + 'K';
    document.getElementById('statRisks').textContent = 'â€”';

    document.getElementById('uploadZone').style.display = 'none';
    document.getElementById('docLoaded').classList.remove('hidden');
    document.getElementById('analyzeBtn').disabled = false;
    document.getElementById('chatInput').disabled = false;
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('suggestedQuestions').style.display = 'flex';
    document.getElementById('noDocState').style.display = 'none';

    // Show raw text
    renderRawText();

    // Welcome message
    addAIMessage(
      `âœ… **${file.name}** loaded successfully.\n\n` +
      `ðŸ“„ **${totalPages} pages** Â· **${formatNum(wordCount)} words** Â· **${state.chunks.length} retrieval chunks**\n\n` +
      `I have processed and indexed this document using RAG (Retrieval-Augmented Generation). ` +
      `Every answer I give will be grounded exclusively in the document text and will cite ` +
      `the exact page number and section for each claim. I will never fabricate facts. ` +
      `What would you like to know?`,
      []
    );

    state.docLoaded = true;
    setStatus('idle', 'Ready');
  } catch (err) {
    console.error(err);
    setStatus('error', 'Parse failed');
    document.getElementById('uploadBtn').textContent = 'Try Again';
    alert('Failed to parse PDF. Please ensure it is a valid, non-encrypted PDF file.');
  }
}

// â”€â”€â”€ RAG: CHUNKING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function chunkDocument(pageTexts) {
  const chunks = [];
  let chunkId = 0;

  for (const { page, text } of pageTexts) {
    if (!text.trim()) continue;
    const sentences = text.split(/(?<=[.!?])\s+/);
    let buffer = '';

    for (const sentence of sentences) {
      buffer += sentence + ' ';
      if (buffer.length >= CONFIG.chunkSize) {
        chunks.push({
          id: chunkId++,
          page,
          text: buffer.trim(),
          keywords: extractKeywords(buffer)
        });
        buffer = buffer.slice(-CONFIG.chunkOverlap);
      }
    }

    if (buffer.trim().length > 50) {
      chunks.push({
        id: chunkId++,
        page,
        text: buffer.trim(),
        keywords: extractKeywords(buffer)
      });
    }
  }

  return chunks;
}

// â”€â”€â”€ RAG: KEYWORD EXTRACTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function extractKeywords(text) {
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being',
    'have','has','had','do','does','did','will','would','could','should','may','might',
    'shall','can','need','dare','ought','used','to','of','in','on','at','by','for',
    'with','about','against','between','into','through','during','before','after',
    'above','below','from','up','down','and','but','or','nor','so','yet','both',
    'either','neither','not','only','own','same','than','too','very','just','this',
    'that','these','those','it','its','they','them','their','what','which','who']);

  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
}

// â”€â”€â”€ RAG: RETRIEVAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function retrieveRelevantChunks(query) {
  const queryKeywords = extractKeywords(query);
  const scored = state.chunks.map(chunk => {
    let score = 0;
    for (const qw of queryKeywords) {
      for (const cw of chunk.keywords) {
        if (cw === qw) score += 3;
        else if (cw.includes(qw) || qw.includes(cw)) score += 1;
      }
      // Exact phrase match bonus
      if (chunk.text.toLowerCase().includes(qw)) score += 2;
    }
    return { ...chunk, score };
  });

  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, CONFIG.topKChunks);
}

// â”€â”€â”€ RAG: BUILD PROMPT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildRAGPrompt(query, chunks) {
  const contextBlocks = chunks
    .map(c => `[Page ${c.page}]\n${c.text}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are NOOR RAG, a precise and rigorous legal document analyst built for a law firm. You have been given extracted text from a legal document, organized by page number.

CRITICAL RAG RULES â€” you MUST follow ALL of these:

1. CITATION REQUIRED: Every factual statement MUST be followed by a citation in the format [p.N] where N is the page number. If you reference a section number visible in the text, use [Â§X.X, p.N].

2. STRICTLY GROUNDED: You may ONLY use information that appears in the DOCUMENT CONTEXT below. If the answer is not in the provided context, say: "This information was not found in the retrieved sections of the document."

3. NO HALLUCINATION: Never invent page numbers, clause numbers, party names, dates, dollar amounts, or any other facts. If you are uncertain, say so explicitly.

4. STRUCTURE: Use clear formatting â€” bullet points for lists, bold for key terms.

5. LEGAL PRECISION: Flag potential risks, ambiguities, or unusual clauses with âš ï¸.

6. COMPLETENESS: If multiple pages support a point, cite all of them.

DOCUMENT CONTEXT (retrieved passages):
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
${contextBlocks}
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Answer the user's question using ONLY the context above. If the context is insufficient, say so clearly.`;

  return systemPrompt;
}

// â”€â”€â”€ CHAT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initChat() {
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

function initSuggestedQuestions() {
  document.querySelectorAll('.sug-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('chatInput').value = btn.textContent;
      sendMessage();
    });
  });
}

async function sendMessage() {
  if (!state.docLoaded || state.isProcessing) return;

  const input = document.getElementById('chatInput');
  const question = input.value.trim();
  if (!question) return;

  input.value = '';
  input.style.height = 'auto';
  state.isProcessing = true;
  document.getElementById('sendBtn').disabled = true;
  setStatus('active', 'Retrieving...');

  // Add user message
  addUserMessage(question);

  // Loading indicator
  const loaderId = showLoading();

  try {
    // RAG: Retrieve relevant chunks
    const relevantChunks = retrieveRelevantChunks(question);
    setStatus('active', `Sending ${relevantChunks.length} chunks to Claude...`);

    // Build system prompt with context
    const systemPrompt = buildRAGPrompt(question, relevantChunks);

    // Add to conversation history (last 6 messages to save tokens)
    state.conversationHistory.push({ role: 'user', content: question });
    const recentHistory = state.conversationHistory.slice(-6);

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: CONFIG.maxTokens,
        system: systemPrompt,
        messages: recentHistory
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const reply = data.content.map(b => b.text || '').join('');

    state.conversationHistory.push({ role: 'assistant', content: reply });

    removeLoading(loaderId);

    // Extract page citations from response
    const pageCites = extractCitationsFromResponse(reply);

    addAIMessage(reply, pageCites, relevantChunks.length);
    setStatus('idle', 'Ready');
  } catch (err) {
    removeLoading(loaderId);
    addAIMessage(
      `âŒ API Error: ${err.message}\n\nIf you are running this locally, ensure your Anthropic API key is set correctly. See README.md for setup instructions.`,
      []
    );
    setStatus('error', 'Error');
    console.error(err);
  }

  state.isProcessing = false;
  document.getElementById('sendBtn').disabled = false;
}

function extractCitationsFromResponse(text) {
  const matches = text.match(/\[(?:Â§[\d.]+,\s*)?p\.?\s*\d+\]/g) || [];
  return [...new Set(matches)].slice(0, 8);
}

// â”€â”€â”€ ANALYSIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (!state.docLoaded || state.isProcessing) return;
  const btn = document.getElementById('analyzeBtn');
  btn.disabled = true;
  btn.textContent = 'â³ Analyzing...';
  state.isProcessing = true;
  setStatus('active', 'Running structured analysis...');

  // Switch to dashboard tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-panel="dash"]').classList.add('active');
  document.getElementById('panel-dash').classList.add('active');
  document.getElementById('dashContent').innerHTML = '<div class="no-doc-state"><div style="font-size:32px">â³</div><p>Claude is analyzing your documentâ€¦</p></div>';

  try {
    // Take a smart sample from across the document (first 12K chars)
    const sampleText = state.fullText.slice(0, CONFIG.maxContextChars);
    const systemPrompt = buildAnalysisPrompt(sampleText);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CONFIG.model,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: 'Extract all risks, key dates, and stakeholders from this document. Return ONLY valid JSON, no markdown, no commentary.'
        }],
        system: systemPrompt
      })
    });

    const data = await response.json();
    let rawText = data.content.map(b => b.text || '').join('');

    // Clean possible markdown fences
    rawText = rawText.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(rawText);
    document.getElementById('statRisks').textContent = analysis.risks?.length || 'â€”';
    renderDashboard(analysis);
    state.analysisRun = true;
    btn.textContent = 'âœ… Analysis Complete';
    setStatus('idle', 'Ready');
  } catch (err) {
    document.getElementById('dashContent').innerHTML = `<div class="no-doc-state"><div style="font-size:32px">âŒ</div><p>Analysis failed: ${err.message}</p></div>`;
    btn.textContent = 'ðŸ” Retry Analysis';
    btn.disabled = false;
    setStatus('error', 'Error');
  }

  state.isProcessing = false;
}

function buildAnalysisPrompt(documentText) {
  return `You are a legal document analyst. Extract structured information from the following legal document text.

Return ONLY a valid JSON object with this exact structure â€” no preamble, no markdown backticks:
{
  "risks": [
    {
      "level": "high" | "medium" | "low",
      "description": "Concise risk description",
      "reference": "Â§X.X or Section name + page if visible"
    }
  ],
  "dates": [
    {
      "event": "Event name",
      "date": "Date value",
      "reference": "Section or page reference if visible"
    }
  ],
  "stakeholders": [
    {
      "name": "Full name or entity name",
      "role": "Role in the agreement",
      "reference": "Where first mentioned"
    }
  ]
}

Rules:
- risks: identify 5-10 key legal, financial, or operational risks. If no risks are explicitly found, infer from clause types (indemnification, liability caps, IP, non-compete, MAC).
- dates: extract all dates, deadlines, and time periods mentioned (signing, closing, earnout, expiry, claim windows).
- stakeholders: identify all named parties, entities, advisors, and key employees.
- Only cite page numbers if they appear in the text.
- Return ONLY the JSON. Nothing else.

DOCUMENT TEXT:
${documentText}`;
}

// â”€â”€â”€ DASHBOARD RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const AVATAR_COLORS = [
  { bg:'#E6F1FB', text:'#185FA5' }, { bg:'#EEEDFE', text:'#3C3489' },
  { bg:'#EAF3DE', text:'#27500A' }, { bg:'#FAEEDA', text:'#633806' },
  { bg:'#FBEAF0', text:'#72243E' }, { bg:'#E1F5EE', text:'#085041' }
];

function renderDashboard(analysis) {
  const c = document.getElementById('dashContent');
  c.innerHTML = '';

  // Risks
  if (analysis.risks?.length) {
    const card = document.createElement('div');
    card.className = 'dash-card';
    card.innerHTML = `
      <div class="dash-card-header">
        <span style="font-size:18px">âš ï¸</span>
        <h2>Risks Identified</h2>
        <span class="count">${analysis.risks.length} found</span>
      </div>
      <div class="risk-list">
        ${analysis.risks.map(r => `
          <div class="risk-row">
            <span class="risk-badge ${r.level}">${r.level}</span>
            <div class="risk-body">
              <div class="risk-text">${escapeHtml(r.description)}</div>
              ${r.reference ? `<div class="risk-ref">ðŸ“Œ ${escapeHtml(r.reference)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
    c.appendChild(card);
  }

  // Dates
  if (analysis.dates?.length) {
    const card = document.createElement('div');
    card.className = 'dash-card';
    card.innerHTML = `
      <div class="dash-card-header">
        <span style="font-size:18px">ðŸ“…</span>
        <h2>Key Dates &amp; Deadlines</h2>
        <span class="count">${analysis.dates.length} found</span>
      </div>
      <table class="dates-table">
        ${analysis.dates.map(d => `
          <tr>
            <td><div class="event-name">${escapeHtml(d.event)}</div>${d.reference ? `<div class="section-ref">${escapeHtml(d.reference)}</div>` : ''}</td>
            <td class="date-val">${escapeHtml(d.date)}</td>
          </tr>`).join('')}
      </table>`;
    c.appendChild(card);
  }

  // Stakeholders
  if (analysis.stakeholders?.length) {
    const card = document.createElement('div');
    card.className = 'dash-card';
    card.innerHTML = `
      <div class="dash-card-header">
        <span style="font-size:18px">ðŸ‘¥</span>
        <h2>Stakeholders &amp; Parties</h2>
        <span class="count">${analysis.stakeholders.length} found</span>
      </div>
      <div class="sh-grid">
        ${analysis.stakeholders.map((s, i) => {
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const initials = s.name.split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('');
          return `
            <div class="sh-card">
              <div class="sh-avatar" style="background:${color.bg};color:${color.text};">${initials}</div>
              <div class="sh-name">${escapeHtml(s.name)}</div>
              <div class="sh-role">${escapeHtml(s.role)}</div>
              ${s.reference ? `<div class="sh-ref">${escapeHtml(s.reference)}</div>` : ''}
            </div>`;
        }).join('')}
      </div>`;
    c.appendChild(card);
  }
}

// â”€â”€â”€ RAW TEXT RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function renderRawText() {
  const area = document.getElementById('rawTextArea');
  area.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'raw-text-content';

  state.pageTexts.forEach(({ page, text }) => {
    const divider = document.createElement('div');
    divider.className = 'page-divider';
    divider.textContent = `â”€â”€â”€ Page ${page} â”€â”€â”€`;
    container.appendChild(divider);

    const pageDiv = document.createElement('div');
    pageDiv.style.marginBottom = '12px';
    pageDiv.textContent = text;
    container.appendChild(pageDiv);
  });

  area.appendChild(container);
}

// â”€â”€â”€ MESSAGE HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function addUserMessage(text) {
  const msgs = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.className = 'msg user';
  msg.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
  msgs.appendChild(msg);
  msgs.scrollTop = msgs.scrollHeight;
}

function addAIMessage(text, cites, chunksUsed) {
  const msgs = document.getElementById('chatMessages');
  const msg = document.createElement('div');
  msg.className = 'msg ai';

  const formatted = formatAIText(text);
  let html = `<div class="msg-bubble">${formatted}</div>`;

  if (cites && cites.length) {
    html += `<div class="citations">${cites.map(c => `<span class="cite-pill">ðŸ“Œ ${c}</span>`).join('')}</div>`;
  }

  if (chunksUsed) {
    html += `<div class="msg-meta">${chunksUsed} document chunks retrieved Â· Citation-grounded response</div>`;
  }

  msg.innerHTML = html;
  msgs.appendChild(msg);
  msgs.scrollTop = msgs.scrollHeight;
}

function formatAIText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]/g, '<span class="cite-pill" style="font-size:11px;display:inline;">ðŸ“Œ [$1]</span>')
    .replace(/\n/g, '<br>');
}

function showLoading() {
  const msgs = document.getElementById('chatMessages');
  const id = 'loader-' + Date.now();
  const loader = document.createElement('div');
  loader.className = 'msg ai';
  loader.id = id;
  loader.innerHTML = `<div class="msg-bubble loading-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
  msgs.appendChild(loader);
  msgs.scrollTop = msgs.scrollHeight;
  return id;
}

function removeLoading(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// â”€â”€â”€ UTILITIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setStatus(type, text) {
  const dot = document.querySelector('.status-dot');
  const label = document.querySelector('.status-text');
  dot.className = 'status-dot ' + type;
  label.textContent = text;
}

function formatNum(n) {
  return n.toLocaleString();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
