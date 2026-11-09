# Phase 03: PDF & Word (`.docx`) Compilation and Verification

## Context & Requirements
- Biên dịch bộ hướng dẫn sử dụng sang 2 định dạng văn phòng bắt buộc:
  1. **PDF (`docs/user-guide/ALKANA_CSCC_User_Manual_EN_VI.pdf`)**: Kết xuất từ HTML chuẩn in ấn qua Chrome Headless (`Page.printToPDF`) với khổ giấy A4, lề chuẩn, header/footer đánh số trang và hình ảnh độ phân giải cao không bị cắt ngang trang.
  2. **Microsoft Word (`docs/user-guide/ALKANA_CSCC_User_Manual_EN_VI.docx`)**: Khởi tạo file OOXML `.docx` hợp lệ chuẩn Word 2016/2019/365, nhúng trực tiếp toàn bộ 25 hình ảnh PNG (`word/media/`), định dạng phân cấp `Title`, `Heading1`, `Heading2`, đoạn văn tiếng Anh in đậm/thường kết hợp dòng *tiếng Việt in nghiêng* bên dưới, bảng biểu có `w:shd w:val="clear"`, header/footer đánh số trang tự động.
- Cập nhật `README.md` để dẫn link tới bộ tài liệu hướng dẫn sử dụng (`Markdown`, `PDF`, `Word .docx`).

## Validation
- Kiểm tra tồn tại và dung lượng của cả 3 file:
  - `docs/user-guide/ALKANA_CSCC_User_Manual_EN_VI.md`
  - `docs/user-guide/ALKANA_CSCC_User_Manual_EN_VI.pdf`
  - `docs/user-guide/ALKANA_CSCC_User_Manual_EN_VI.docx`
- Kiểm tra tính toàn vẹn của file `.docx` (cấu trúc ZIP & XML hợp lệ, không dùng `ShadingType.SOLID`, có đủ ảnh trong `word/media/`) và file `.pdf` (header `%PDF-1.`, số trang đầy đủ).
- Dọn dẹp triệt để các tiến trình server và trình duyệt chạy nền sau khi chụp ảnh & kết xuất xong.

