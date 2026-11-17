# Phase 3 — Frontend Print Layout & Editor Forms

## Context
Người dùng yêu cầu thay đổi bố cục phần thông tin chung trên bản in A4 của cả Coating Schedule (CS) và Coating Cost (CC) sao cho gọn gàng, ngay hàng thẳng lối, đồng thời thêm textbox `Buyer / Nhà mua hàng` (không bắt buộc nhập) vào dự án.

## Requirements
1. **Bản in A4 Coating Schedule & Coating Cost (`apps/frontend/src/components/print/PrintableSheetA4.tsx`):**
   - Cập nhật `renderMetadataGrid()` dùng chung cho cả `CS` và `CC`:
     - Sử dụng container `grid grid-cols-3 gap-x-4 gap-y-0.5 border-b border-slate-400 my-1.5 pb-1.5 text-[8.5pt] leading-snug items-baseline`.
     - **Dòng 1 (Trải dài từ mép trái tới mép phải — `col-span-3`):**
       - `Customer / Khách hàng:` `{revision.customer.customerName}`
     - **Dòng 2 (3 cột gióng ngang hàng 1):**
       - Cột trái: `Buyer / Nhà mua hàng:` `{revision.buyer || ''}`
       - Cột giữa: `Substrate Type / Loại gỗ:` `{revision.substrate}`
       - Cột phải: `MC Wood / Độ ẩm gỗ:` `{keepRangesTogether(revision.mcWood)}`
     - **Dòng 3 (3 cột gióng ngang hàng 2):**
       - Cột trái: `Product Item / Tên sản phẩm:` `{revision.productName}`
       - Cột giữa: `Positioning / Vị trí:` `{revision.positioning}`
       - Cột phải: `Humidity / Độ ẩm:` `{keepRangesTogether(revision.roomHumidity)}`
     - **Dòng 4 (3 cột gióng ngang hàng 3):**
       - Cột trái: `Color / Màu sắc:` `{revision.colorName}`
       - Cột giữa: `Finishing System / Hệ sơn:` `{revision.finishingSystem}`
       - Cột phải: `Room Temp. / Nhiệt độ phòng:` `{keepRangesTogether(revision.roomTemp)}`
     - **Dòng 5 (3 cột gióng ngang hàng 4):**
       - Cột trái: `Reference / Tiêu chuẩn tham chiếu:` `{revision.referenceStandard}`
       - Cột giữa: `Gloss Level / Độ bóng:` `{revision.glossLevel}`
       - Cột phải: `<div />` *(ô trống giữ nhịp lưới)*

2. **Form Header tab Coating Schedule (`apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`):**
   - Bổ sung ô textbox `Buyer / Nhà mua hàng` (không bắt buộc nhập, không tô viền vàng khi trống) vào Cột 1 ngay dưới phần chọn `Customer / Khách hàng`.
   - Sắp xếp các ô nhập liệu gọn gàng, đồng bộ thứ tự với bản in (Cột 1: Customer, Buyer, Product Item, Color; Cột 2: Substrate + Positioning, Finishing System + Gloss Level, Reference; Cột 3: No. + Date, Finishing Condition: MC Wood, Humidity, Room Temp).
   - Trên thanh Header thu gọn (`isHeaderCollapsed`): hiển thị thêm `Buyer: {revision.buyer}` khi có giá trị.

3. **Modal Tạo mới Hồ sơ & Danh sách Dự án (`apps/frontend/src/components/projects/ProjectExplorerView.tsx`):**
   - Trong modal **Create New Project**: bổ sung ô textbox `Buyer / Nhà mua hàng` (Optional / Tùy chọn) và truyền `buyer: newBuyer.trim()` vào `onCreateProject`.
   - Hỗ trợ tìm kiếm theo `buyer` trên thanh tìm kiếm dự án.

4. **Màn hình Coating Cost (`apps/frontend/src/components/cost/CoatingCostTable.tsx`) & App State (`apps/frontend/src/App.tsx`):**
   - Trong `CoatingCostTable.tsx`: hiển thị thêm `Buyer / Nhà mua hàng: {revision.buyer || '—'}` và `Reference / Tiêu chuẩn: {revision.referenceStandard || '—'}` trong phần Header đồng bộ của bảng CC.
   - Trong `App.tsx`:
     - Bổ sung `buyer: rev.buyer || ''` vào `computeRevisionSignature` để Auto-Save phát hiện tức thì mọi thay đổi trên ô `Buyer / Nhà mua hàng`.
     - Không thêm `buyer` vào `validateRevisionBeforeSave` (đảm bảo `buyer` hoàn toàn không bắt buộc nhập).
     - Cập nhật `performAutoSave` và `onCreateProject` để đồng bộ `buyer` vào state `projects`.

## Files
- Modify: `apps/frontend/src/components/print/PrintableSheetA4.tsx`
- Modify: `apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`
- Modify: `apps/frontend/src/components/projects/ProjectExplorerView.tsx`
- Modify: `apps/frontend/src/components/cost/CoatingCostTable.tsx`
- Modify: `apps/frontend/src/App.tsx`

## Steps
1. Cập nhật `PrintableSheetA4.tsx` với lưới `renderMetadataGrid()` mới (dòng 1 `col-span-3` cho `Customer / Khách hàng`, 4 dòng tiếp theo căn thẳng hàng ngang trên 3 cột).
2. Cập nhật `CoatingScheduleEditor.tsx` thêm textbox `Buyer / Nhà mua hàng`.
3. Cập nhật `ProjectExplorerView.tsx`, `CoatingCostTable.tsx` và `App.tsx`.

## Validation
- `npm run typecheck --workspace=@cscc/frontend` và `npm run build --workspace=@cscc/frontend` thành công 100%.

## Risk / Rollback
- Bố cục CSS Grid `grid-cols-3` sử dụng `min-w-0 break-words` trên từng ô để tránh tràn ngang với văn bản dài. Rollback: hoàn tác các file trong `apps/frontend/src/`.
