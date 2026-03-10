# Implementation Plan: AI Comparison (Quote Agent)

Date: 2026-03-10
Owner: Project Team
Scope: Backend (NestJS) + Frontend (React/Vite) + AI/OCR + Vector Search

## 1. Goals and Success Criteria
- Parse multiple PDF quotes into structured JSON with low hallucination.
- Provide a comparison table with a clear recommended carrier.
- Maintain stable UI state (no crashes or tab data loss).
- Enable HSCode search and basic tax calculation.

Success criteria:
- 90%+ correct field extraction on a sample set of 20 PDFs.
- Zero backend crashes from malformed LLM outputs.
- Dashboard state persists across refresh and tab switching.

## 2. Milestones
- M1: MVP Quote Comparison (OCR + Extraction + Comparison UI)
- M2: Stability and Anti-Hallucination Hardening
- M3: HSCode Module (Vector Search)
- M4: Insights and Traceability

## 3. Work Breakdown Structure

### M1: MVP Quote Comparison
Backend
- Implement PDF upload endpoints and storage.
- Integrate PaddleOCR pipeline for text extraction.
- Implement LangChain extraction to JSON schema.
- Build comparison service with scoring and cheapest-carrier logic.

Frontend
- Build upload UI for multiple PDFs.
- Render comparison table (carrier, price, weight, lead time, terms).
- Add summary recommendation panel.

Testing
- Create a small PDF fixture set and expected JSON outputs.
- Add unit tests for extraction schema validation.

### M2: Stability and Anti-Hallucination Hardening
Backend
- Enforce temperature=0 for extraction prompts.
- Add robust JSON extraction (first "{" to last "}").
- Add structured validation and fail-safe defaults (N/A).
- Add AI health endpoint and Ollama auto-start.

Frontend
- Persist dashboard state in localStorage.
- Keep dashboard mounted to avoid state loss.
- Add AI health indicator (online/offline + model).

Testing
- Regression tests for JSON parsing and crash prevention.

### M3: HSCode Module
Backend
- Define HSCode schema and ingestion format.
- Build Qdrant collection + embedding pipeline.
- Implement search endpoint and tax calculation.

Frontend
- Add HSCode upload/search UI.
- Display matched code, confidence, and tax results.

### M4: Insights and Traceability
Backend
- Compute price averages, outliers, and carrier stats.
- Store traceability links (page/line references).

Frontend
- Insights panels (averages, outliers, alerts).
- "View source" links to extracted PDF segments.

## 4. Data and Schema
- Quote JSON schema: carrier, total_price, currency, weight, lead_time, terms.
- Comparison schema: best_price, ranking, anomalies, explanation.
- HSCode schema: code, description, tax_rate, country_rules.

## 5. Risks and Mitigations
- OCR accuracy variability: use pre-processing and confidence thresholds.
- Small LLM hallucinations: temperature=0, strict schema validation.
- Performance with large PDFs: add background processing and size limits.

## 6. Deliverables
- API endpoints: /quote/compare, /quote/chat, /health/ai, /hscode/search
- Frontend: upload, dashboard, insights, hscode module
- Test suite for extraction + stability

## 7. Open Questions
- What is the exact HSCode dataset format?
- What carriers and routes are the initial focus?
- Target accuracy thresholds for OCR and extraction?

## 8. Next Steps (Immediate)
- Confirm HSCode dataset source and format.
- Create PDF fixture set for extraction tests.
- Prioritize M1 tasks in the sprint board.
