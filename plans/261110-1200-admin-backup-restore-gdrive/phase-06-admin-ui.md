# Phase 6 — Giao diện admin

Frontend: React 18 + Tailwind + `lucide-react` (xem `apps/frontend/src/components/*`; nhóm mới `components/backup/`). Điều hướng/vai trò theo cách các thành phần hiện có xử lý (đọc `App.tsx`, `components/auth`).

## Màn hình "Sao lưu & Phục hồi" (menu chỉ hiện với ADMIN)
1. **Hành động nhanh:** ba thẻ lớn **Database / Website / Toàn bộ**, mỗi thẻ có nút "Sao lưu ngay"; công tắc "Lưu thêm 1 bản lên Google Drive".
2. **Lịch tự động:** bật/tắt, giờ chạy, số bản giữ; dùng giá trị mặc định đã đề xuất.
3. **Danh sách bản sao lưu:** loại, thời gian, dung lượng, người tạo, trạng thái cục bộ/Drive; thao tác Tải về, Phục hồi, Xoá, Thử lại Drive. Nút "Tải lên bản sao lưu".
4. **Thẻ Google Drive:** trạng thái; trình hướng dẫn 3 bước (tạo OAuth client → dán Client ID/Secret → Kết nối bằng mã thiết bị); hiện email tài khoản đã liên kết; Kiểm tra / Ngắt kết nối; cảnh báo nếu cần kết nối lại.
5. **Mật khẩu mã hóa:** thiết lập lần đầu, nhắc lưu offline, cho nhập mật khẩu khi phục hồi sang máy khác.
6. **Hộp thoại phục hồi:** chọn phạm vi, cảnh báo nguy hiểm, nhập đúng tên bản để xác nhận, hiển thị tiến trình và trạng thái bảo trì; kết quả cuối cùng và hướng dẫn restart nếu phục hồi Website.

Tất cả nhãn bằng tiếng Việt, theo phong cách giao diện hiện có; cập nhật trạng thái bằng polling `GET jobs` khi có tác vụ đang chạy.

## Files
- Create: `apps/frontend/src/components/backup/*`, `apps/frontend/src/api/backup.ts`
- Modify: `App.tsx` (menu + route chỉ ADMIN)

## Validation
- `npm run typecheck` và `npm run build` frontend pass.
- Kiểm tra bằng tay với từng role: non-admin không thấy menu, truy cập trực tiếp bị từ chối.
- Kiểm tra luồng sao lưu/phục hồi/Drive trên trình duyệt thật.

