# API Documentation

Last Updated: 2026-03-10
Base URL: `http://localhost:3001`

---

## 🤖 AI & Quotes

### GET /health/ai
Check if the Ollama AI service is online.

**Response (200):**
```json
{
  "online": true,
  "model": "qwen2.5:0.5b"
}
```

---

### POST /quote/compare
Analyze and compare multiple quote PDFs.

**Request Body:** (Form Data)
- `files`: Array of PDF files.

**Response (200):**
```json
{
  "quotes": [...],
  "summary": {
    "cheapest_carrier": "FedEx",
    "fastest_days": 3
  },
  "ai_analysis": "..."
}
```

---

### POST /quote/chat
Chat with the Logistics Co-Pilot within the context of quotes.

**Request Body:**
```json
{
  "message": "Which carrier is best for heavy loads?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "ai", "content": "..." }
  ],
  "context": { "quotes": [...] }
}
```

**Response (200):**
```json
{
  "reply": "Based on the quotes provided, DHL offers the best specialized rates for cargo over 500kg..."
}
```

---

## 📂 Database

### GET /database/files
List all files processed in the data folder.

**Response (200):**
```json
["quote_001.pdf", "quote_002.pdf"]
```
