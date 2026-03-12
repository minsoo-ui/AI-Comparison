# Organizational Structure & Workflow

Tài liệu này ghi lại cấu trúc thư mục và luồng vận hành của dự án AI Comparison (Sea Freight Quote) để phục vụ tra cứu và nhất quán trong quá trình phát triển.

## 1. Cấu trúc Thư mục (Organizational Structure)

Dự án được thiết kế theo mô hình Container hóa, tách biệt Backend, Frontend và Dữ liệu.

```text
📦 sea-freight-quote-webapp
┣ 📂 backend                 <-- [DỰ ÁN NESTJS]
┃ ┣ 📂 src
┃ ┃ ┣ 📂 modules
┃ ┃ ┃ ┣ 📂 upload            # API nhận file PDF, lưu ổ cứng
┃ ┃ ┃ ┣ 📂 queue             # BullMQ (Producer đẩy job)
┃ ┃ ┃ ┣ 📂 worker            # Worker xử lý OCR & AI (Concurrency: 1)
┃ ┃ ┃ ┣ 📂 preprocessing     # Rule Engine: Cắt trang, dịch thuật ngữ
┃ ┃ ┃ ┣ 📂 ai-agent          # Chứa logic Map-Reduce gọi LangChain/Ollama
┃ ┃ ┃ ┗ 📂 qdrant            # Kết nối Vector Database
┃ ┃ ┣ 📂 shared
┃ ┃ ┃ ┣ 📂 schemas           # class-validator JSON Schema cước tàu
┃ ┃ ┃ ┗ 📂 utils             # Logging pino, tạo Transaction ID
┃ ┃ ┗ 📜 main.ts
┃ ┣ 📜 package.json
┃ ┣ 📜 Dockerfile            # File đóng gói NestJS (Build stage -> Production)
┃ ┗ 📜 .env                  # Cấu hình cổng, host cho Backend
┃
┣ 📂 frontend                <-- [DỰ ÁN REACT/VUE]
┃ ┣ 📂 src
┃ ┃ ┣ 📂 components
┃ ┃ ┃ ┣ 📜 ComparisonTable.tsx  # Bảng lưới DataGrid đa chiều
┃ ┃ ┃ ┣ 📜 AiInsightBox.tsx     # Box 3 câu lời khuyên của AI
┃ ┃ ┃ ┗ 📜 TraceabilityModal.tsx# Modal truy vết nguồn gốc (Text/Canvas)
┃ ┃ ┣ 📂 services            # Chứa WebSocket client kết nối lấy trạng thái
┃ ┃ ┗ 📜 App.tsx
┃ ┣ 📜 package.json
┃ ┣ 📜 Dockerfile            # Build tĩnh (static) rồi đưa vào Nginx
┃ ┗ 📜 .env                  # URL trỏ tới Backend API (LAN IP)
┃
┣ 📂 data                    <-- [TÀI NGUYÊN GỐC - LƯU TRÊN MÁY TÍNH CÁ NHÂN]
┃ ┣ 📂 uploads               # Nơi chứa file PDF (Bind Mount vào Backend)
┃ ┣ 📂 qdrant_storage        # Lưu trữ persistent vector (Bind Mount)
┃ ┣ 📂 redis_data            # Lưu trạng thái hàng đợi (Bind Mount)
┃ ┗ 📜 dictionary.json       # File JSON dịch thuật ngữ vận tải
┃
┣ 📜 docker-compose.yml      <-- [NHẠC TRƯỞNG] Quản lý 4 container
┗ 📜 README.md
```

## 2. Luồng Xử lý AI (Map-Reduce Workflow)

Để tối ưu RAM cho máy i3-12100 (Model Qwen 0.8B), hệ thống áp dụng chiến lược Map-Reduce kết hợp với Hàng đợi.

### Bước 1: Tiền Xử lý (Preprocessing)
- Nhận diện loại PDF (Native vs Scan).
- Quét Regex để lọc các trang chứa biểu giá, loại bỏ trang rác.
- Dịch thuật ngữ vận tải từ viết tắt sang tên đầy đủ (CY/CY -> Container Yard...).

### Bước 2: Bước MAP (AI Bóc tách - File by File)
- **Hàng đợi (Queue)**: Xử lý lần lượt từng file (Concurrency: 1) để tránh tràn bộ nhớ.
- **Extraction**: LLM bóc tách dữ liệu gốc thành JSON Schema chuẩn hóa (Cước biển, Phụ phí, Transit Time, Bbox...).
- **Citations**: Gắn `chunk_id` và tọa độ `bbox` cho từng dòng dữ liệu để phục vụ truy vết.

### Bước 3: Bước SO SÁNH (Computational Comparison)
- Sử dụng hàm Node.js thuần tuý để tính toán Landed Cost.
- So sánh các chỉ số về thời gian (Transit time, Free time).
- Tạo bản tóm tắt dữ liệu cực ngắn cho bước tiếp theo.

### Bước 4: Bước REDUCE (AI Tư vấn Quyết định)
- Đưa bản tóm tắt dữ liệu vào LLM.
- AI đóng vai chuyên gia Forwarder đưa ra 3 câu tư vấn chọn hãng tàu tối ưu nhất.

## 3. Lưu ý về Hạ tầng (Docker & Ollama)
- **Ollama**: Chạy trực tiếp trên Host OS để tận dụng GPU/CPU. Container Backend gọi qua `http://host.docker.internal:11434`.
- **Dữ liệu**: Luôn dùng Bind Mount cho thư mục `data/` để đảm bảo dữ liệu không bị mất khi container khởi động lại và dễ dàng truy cập từ Windows File Explorer.
