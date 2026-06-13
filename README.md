# NOOR RAG — RAG Document Intelligence

> **Built by Hafiz Farrukh Abbas** for legal document analysis using Retrieval-Augmented Generation (RAG).

A production-ready tool that ingests PDF legal contracts and:
- ✅ Answers questions with **citation-enforced** responses (never hallucinates)
- ✅ Extracts **Risks**, **Dates**, and **Stakeholders** automatically
- ✅ Shows every page number and section that supports each answer
- ✅ Works entirely in the browser — no backend required

[![Author](https://img.shields.io/badge/Author-Hafiz%20Farrukh%20Abbas-4a9eff?style=for-the-badge)](https://github.com/FRKABS)
[![Task](https://img.shields.io/badge/Task-3%20of%205-ff3b5c?style=for-the-badge)]()
[![Model](https://img.shields.io/badge/AI-NOOR%20RAG-9b59b6?style=for-the-badge)]()
[![Status](https://img.shields.io/badge/Status-Complete-2ecc71?style=for-the-badge)]()

---

## 🚀 Live Demo

**[→ Open NOOR RAG](https://FRKABS.github.io/hfa-knowledge-analyst/)**

Upload any PDF contract → Ask questions → Get citation-grounded answers.

---

## 🤖 What is NOOR RAG?

**NOOR** (نور — meaning "light" in Urdu/Arabic) RAG is the AI model powering this tool. It is a Retrieval-Augmented Generation pipeline that reads your legal documents and answers questions with pinpoint accuracy — citing the exact page and section for every claim.

---

## 🧠 RAG Architecture

```
PDF Upload
    │
    ▼
PDF.js Text Extraction  ←── page-by-page extraction
    │
    ▼
Chunker                 ←── 1500-char chunks, 200-char overlap
    │
    ▼
Keyword Index           ←── TF-IDF-style keyword scoring
    │
    ▼
Query → Retrieve        ←── Top-8 chunks retrieved per query
    │
    ▼
Context + Prompt        ←── Retrieved chunks injected into NOOR RAG's context
    │
    ▼
Claude Sonnet (via Anthropic API)
    │
    ▼
Citation-Grounded Answer  ←── [§X.X, p.N] enforced by system prompt
```

**Key Anti-Hallucination Technique:** The system prompt instructs NOOR RAG:
> "You may ONLY use information that appears in the DOCUMENT CONTEXT below.
> Every factual statement MUST be followed by a citation [p.N]."

---

## 📂 Project Structure

```
hfa-knowledge-analyst/
├── index.html                    # Main app shell
├── css/
│   └── style.css                 # All styles
├── js/
│   └── app.js                    # RAG logic + Claude API calls
├── .github/
│   └── workflows/
│       └── deploy.yml            # GitHub Pages auto-deploy
└── README.md                     # This file
```

---

## 🚢 Deploy to GitHub Pages

### Step 1 — Push to GitHub
```bash
git init
git add .
git commit -m "feat: NOOR RAG Document Intelligence - Task 3 by Hafiz Farrukh Abbas"
git branch -M main
git remote add origin https://github.com/FRKABS/hfa-knowledge-analyst.git
git push -u origin main
```

### Step 2 — Enable GitHub Pages
- Go to repo → **Settings → Pages → Source: GitHub Actions** → Save
- ✅ Live at: `https://FRKABS.github.io/hfa-knowledge-analyst/`

---

## ⚙️ Features

| Feature | Implementation |
|---|---|
| PDF parsing | pdf.js (client-side, no upload to server) |
| Chunking | Sliding window, 1500 chars, 200 overlap |
| Retrieval | Keyword TF-IDF scoring, Top-8 chunks |
| LLM | Claude Sonnet 4 via Anthropic API |
| Citation enforcement | System prompt + regex extraction |
| Anti-hallucination | Context-only answering + explicit refusal |
| Dashboard | Structured JSON extraction prompt |
| Deployment | Pure static HTML/CSS/JS |

---

## 🔑 API Key Note

This app calls the Anthropic API directly from the browser. For production use, set up a lightweight proxy (Cloudflare Workers or Express.js) so your API key is never exposed client-side. See the setup guide in the original README for proxy code.

---

## 📄 License

MIT © 2026 **Hafiz Farrukh Abbas** · [GitHub](https://github.com/FRKABS)
