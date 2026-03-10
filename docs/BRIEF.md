# 💡 BRIEF: AI Comparison (Quote Agent)

**Ngày tạo:** 2026-03-10
**Dự án:** Hệ thống AI tự động so sánh báo giá vận chuyển & Tra cứu mã HS.

---

## 1. VẤN ĐỀ CẦN GIẢI QUYẾT
- So sánh báo giá thủ công từ nhiều file PDF (FedEx, DHL, UPS...) mất thời gian và dễ sai sót.
- Khó khăn trong việc đối chiếu các điều khoản phụ (special terms) và phí phát sinh.
- Quy trình tra cứu mã HS (HSCode) và tính thuế hàng hóa phức tạp, cần độ chính xác cao.

## 2. GIẢI PHÁP ĐỀ XUẤT
- Xây dựng AI Agent tích hợp OCR (PaddleOCR) để đọc và trích xuất dữ liệu từ PDF.
- Sử dụng LangChain để cấu trúc hóa dữ liệu báo giá thành JSON.
- Hệ thống so sánh thông minh, đưa ra lời khuyên chọn nhà cung cấp tối ưu.
- Module HSCode độc lập sử dụng Qdrant (Vector Store) để tìm kiếm và tính thuế tự động.
- Tính năng Analytic Insights để phát hiện các giá trị bất thường (outliers) và thống kê nhanh.

## 3. ĐỐI TƯỢNG SỬ DỤNG
- Nhân viên Logistics, thu mua (Procurement).
- Các doanh nghiệp xuất nhập khẩu cần tối ưu chi phí vận hành.

## 4. TÍNH NĂNG CỐT LÕI

### 🚀 MVP (Bắt buộc có):
- [ ] Upload đa file PDF báo giá.
- [ ] OCR trích xuất Text & Metadata từ PDF.
- [ ] LangExtract: Chuyển text sang JSON cấu trúc (Công ty, Giá, Trọng lượng...).
- [ ] Bảng so sánh báo giá cơ bản & Lời khuyên chọn bên giá rẻ nhất.

### 🎁 Phase 2 (Nâng cao):
- [ ] **Analytic Insights**: Thống kê mức giá trung bình, cảnh báo giá cao bất thường.
- [ ] **Traceability**: Nút "Xem nguồn" để đối chiếu dữ liệu trích xuất với văn bản gốc trong PDF.
- [ ] **Module HSCode**: Upload file hàng hóa, tìm HSCode qua Vector Search & tính thuế.

## 5. TECH STACK (Đề xuất)
- **Backend**: NestJS (Node.js).
- **AI Core**: LangChain, LangGraph.
- **Local LLM**: Qwen3.5-0.8B (chạy qua Ollama/LM Studio).
- **Vector DB**: Qdrant (Docker).
- **OCR**: PaddleOCR.

## 6. ƯỚC TÍNH SƠ BỘ
- **Độ phức tạp**: Trung bình - Phức tạp (do tích hợp OCR và Vector Search local).
- **Rủi ro**: Tốc độ phản hồi của Local LLM và độ chính xác của OCR với file scan.

---
## 7. BƯỚC TIẾP THEO
→ Chạy `/plan` để bắt đầu thiết kế chi tiết (Đã có Implementation Plan).
