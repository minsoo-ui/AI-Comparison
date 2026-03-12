# Changelog

## [2026-03-12] v0.8.0 - AI Extraction Optimization & Quote History
### Added
- **Term Preprocessor (Phase 6)**: Logistics acronym dictionary auto-expands THC, CFS, BAF, D/O, LCC, AMS... before LLM, significantly reducing hallucination of cost types.
- **Zod Structured Extraction (Phase 7)**: Replaced manual JSON parsing with `LangChain .withStructuredOutput(QuoteValidationSchema)` + Zod schema. Extraction is now type-safe and schema-enforced.
- **LLM Parameter Tuning**: Set `temperature:0` + `numPredict:512` for deterministic and concise extraction with Qwen3:0.8b as the target model.
- **Quote History**: Clicking "Lưu vào Lịch sử & Xem" on the Dashboard saves the full analysis result to localStorage (`quote_history`) and navigates to the History tab. Supports up to 50 sessions.
- **RecentQuotes Redesign**: History tab now reads real data from localStorage with empty-state UI, table view, and expandable detail panel.
- **Bidirectional Tab Navigation**: "Phân tích Mới" button on History tab links back to Dashboard; Dashboard → History link is fully functional.

### Changed
- **Docker Rebuild**: Both frontend and backend containers rebuilt to include new Zod dependency and all source changes.
- **ComparativeDashboard Props**: Added `setActiveTab` prop for cross-tab navigation.

## [2026-03-12]
### Added
- **Security Enhancements**: Integrated Helmet for HTTP headers and GlobalValidationPipe.
- **WebSocket Rooms**: Isolated job status updates to specific jobId rooms to prevent data leakage.
- **Upload Restrictions**: Implemented strict 50MB file size limit and path traversal protection via `path.basename`.

### Changed
- **Production Base Image**: Switched `Dockerfile` from `node:20-alpine` to `node:20-slim` to fix `onnxruntime-node` native module crashing errors.
- **Docker Context**: Added `.dockerignore` to optimize build pipelines.

### Fixed
- **Prompt Injection**: Secured instruction prompts by wrapping inputs in isolated delimiters (`"""`).
- **Resource Leaks**: Ensured PaddleOCR temporary image directories are purged via `finally` blocks.

## [2026-03-11]
### Added
- **Performance Patch 2.1**: Critical stability update for low-resource environments.
- **Evidence Traceability**: AI reports now include `[Nguồn: ...]` citations linking directly to snippets in the source PDF.
- **Stop Chat Button**: UI button to abort AI generation mid-stream using `AbortController`.
- **WebSocket Tracing**: Backend now streams internal LangChain traces and OCR progress to the frontend console.

### Changed
- **LLM Downscaling**: Switched default model from `qwen3:4b` (2.5GB) to `qwen3:0.6b` (522MB) to prevent system-wide freezes on machines with < 4GB available RAM.
- **Connection Context**: Hardcoded `127.0.0.1` as default Ollama base URL to avoid resolution delays or profile-specific 404 errors.
- **Prompt Optimization**: Streamlined extraction prompts to ensure small models (0.6b) generate "Expert Insights" reliably.

### Fixed
- **System Hangs**: Resolved persistent deadlocks by sequentializing extractions and adding 60s/120s safety timeouts.
- **Filename Encoding Error**: Fixed 500 errors (ENOENT) caused by Vietnamese diacritics in filenames; implemented standard sanitization.
- **Port Conflicts**: Implemented `taskkill` logic to clear zombie Node/Ollama processes on port 3001/11434.
- **Insight Duplication**: Added `repeat_penalty` and backend deduplication logic to prevent AI from infinitely listing the same surcharge.
- **JSON Recovery**: Enhanced `ExtractService` with regex salvage to recover data from malformed LLM JSON outputs.

## [2026-03-10]
### Added
- **AI Health Status**: Real-time indicator (Online/Offline) in chat header with pulse animation.
- **Auto-start AI**: Backend now automatically spawns `ollama serve` if not running.
- **Persistent Routing**: `App.tsx` now remembers `activeTab` via localStorage.
- **GET /health/ai**: Endpoint for frontend to check connection to LLM.
- **POST /quote/chat**: Integrated real AI conversation with quote context.

### Changed
- **Dashboard Persistence**: Dashboard no longer unmounts when switching tabs, preserving all upload states.
- **AI UI**: Renamed "AI Advice" to "Logistics Co-Pilot" with a premium bot icon.
- **Chat Logic**: AI now filters old mock-related messages from its history for better clarity.

### Fixed
- **F5 Data Loss**: Resolved critical issue where page refresh cleared analysis results and file lists.
- **Navigation State**: Fixed issue where switching sidebar items caused analysis results to disappear.
- **AI Loop**: Prevented AI from repetitively talking about "Mock Mode" once connected to Ollama.
- **Clear Cache Button**: Replaced native `confirm()` with a custom React double-click state (`isConfirmingClear`) in `ComparativeDashboard` to bypass browser dialog blockers.
- **Backend API Error (JSON Parse)**: Fixed crash `Xảy ra lỗi trong quá trình phân tích` by adding a regex JSON extractor to prevent hallucinated strings from breaking `JSON.parse`.
- **Backend Crash (pdf-parse)**: Fixed `TypeError: pdf is not a function` during backend startup.
- **LLM Hallucination**: Enforced `temperature: 0` in Qwen 0.5b model and tightened prompts so the AI returns N/A instead of inventing carrier names or prices.
