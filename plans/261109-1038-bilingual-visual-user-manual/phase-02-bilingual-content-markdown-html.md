# Phase 02: Bilingual Content Authoring & Markdown / HTML Generation

## Context & Requirements
- Ngôn ngữ: **Song ngữ cố định (Fixed Bilingual — English ở trên, *Tiếng Việt in nghiêng ở dưới*)** xuyên suốt toàn bộ tài liệu.
- Văn phong: Rõ ràng, trực diện, không dư thừa. Mỗi bước thao tác gắn trực tiếp với các con số `①`, `②`, `③` trên hình ảnh chụp màn hình.
- Đầu ra:
  - `docs/user-guide/ALKANA_CSCC_User_Manual_EN_VI.md`
  - `docs/user-guide/ALKANA_CSCC_User_Manual_EN_VI.html`

## Content Structure (8 Chapters)
1. **Chapter 1: System Overview & Role-Based Access Matrix (RBAC)** / *Chương 1: Tổng quan Hệ thống & Ma trận Phân quyền*
2. **Chapter 2: System Sign In, Profile & Password Security** / *Chương 2: Đăng nhập Hệ thống, Hồ sơ & Bảo mật Mật khẩu*
3. **Chapter 3: Project Explorer & Revision Lifecycle Management** / *Chương 3: Quản lý Danh mục Dự án & Vòng đời Phiên bản (Revision)*
4. **Chapter 4: Coating Schedule (CS) Dynamic Editor & Auto-Save** / *Chương 4: Lập Qui Trình Sơn (CS) Động & Cơ chế Tự động Lưu*
5. **Chapter 5: Real-Time Coating Cost (CC) & BOM Summary Estimation** / *Chương 5: Bảng Tính Giá Thành Sơn (CC) Tự động & Dự toán Định mức Vật tư (BOM)*
6. **Chapter 6: Live-Formula Excel Export & A4 Landscape Printing** / *Chương 6: Xuất File Excel Công thức Sống & In Biểu mẫu Chuẩn A4 Ngang*
7. **Chapter 7: 7-Tab Analytics & Executive Reporting Center** / *Chương 7: Trung tâm 7 Báo cáo Phân tích & Thống kê Chuyên sâu*
8. **Chapter 8: Master Data CRUD, Bulk Excel Import & User Administration** / *Chương 8: Quản trị Dữ liệu Nguồn (Master Data), Nhập Excel & Quản lý Người dùng*

## Validation
- Kiểm tra toàn bộ đường dẫn ảnh trong `.md` và `.html` khớp 100% với `docs/user-guide/screenshots/*.png`.
- Kiểm tra quy tắc trình bày: Mọi tiêu đề, mô tả, bước hướng dẫn, ô lưu ý đều có dòng tiếng Anh ở trên và dòng *tiếng Việt in nghiêng* ở dưới.

