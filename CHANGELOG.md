# Changelog

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
