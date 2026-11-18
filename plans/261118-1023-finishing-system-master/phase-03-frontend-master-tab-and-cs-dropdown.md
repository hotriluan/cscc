# Phase 3 — Frontend Master Data Tab & CS Dropdown Integration

## Context
Sau khi có API `/api/master/finishing-systems`, tầng Frontend cần:
1. Tải danh sách `finishingSystemsMaster` khi khởi động ứng dụng.
2. Cung cấp tab quản lý **Finishing Systems / Hệ sơn** trong trang **Master Data** (giống hệt `Application Steps`).
3. Chuyển ô nhập `Finishing System / Hệ sơn` trên **Coating Schedule (CS)** (và trong modal **Create New Project**) từ `<input type="text">` sang `SearchableCombobox` chỉ cho phép chọn từ danh sách Master (chặn nhập tự do).

## Requirements
1. **API Client (`apps/frontend/src/api/client.ts`):**
   - Bổ sung 4 hàm gọi API:
     - `getFinishingSystemsMaster(role: UserRole)`
     - `saveFinishingSystemMaster(role: UserRole, data: { systemName: string; sortOrder?: number })`
     - `updateFinishingSystemMaster(role: UserRole, id: string, data: Partial<FinishingSystemMaster>)`
     - `deleteFinishingSystemMaster(role: UserRole, id: string)`
2. **App State (`apps/frontend/src/App.tsx`):**
   - Khai báo state `const [finishingSystemsMaster, setFinishingSystemsMaster] = React.useState<FinishingSystemMaster[]>([]);`.
   - Tải `apiClient.getFinishingSystemsMaster(role)` trong `loadAllData()` và `reloadMasterData()`.
   - Truyền `finishingSystemsMaster` xuống `MasterDataManager`, `CoatingScheduleEditor` và `ProjectExplorerView`.
3. **Trang Quản lý Master Data (`apps/frontend/src/components/master/MasterDataManager.tsx`):**
   - Mở rộng `MasterSubTab` thêm `'FINISHING_SYSTEMS'`.
   - Thêm nút chuyển tab **Finishing Systems / Hệ sơn** trên thanh điều hướng Master Data (hiển thị số lượng bản ghi `finishingSystemsMaster.length`).
   - Hỗ trợ lọc theo ô tìm kiếm chung (`filteredFinishingSystems`).
   - Xây dựng giao diện form + bảng cho `subTab === 'FINISHING_SYSTEMS'` giống `STEPS`:
     - Input `Tên Hệ sơn chuẩn mới (VD: WATERBASE, NC-PU, PU, UV...)`.
     - Input `Thứ tự (sortOrder)` (hiển thị khi đang sửa hoặc cho phép nhập thứ tự tùy chọn).
     - Bảng danh sách gồm 3 cột: `Thứ tự`, `Finishing System / Hệ sơn`, `Sửa / Xóa`.
4. **Dropdown trên Coating Schedule (`apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`):**
   - Nhận prop `finishingSystemsMaster: FinishingSystemMaster[]`.
   - Tạo `finishingSystemOptions: ComboboxOption[]` từ `finishingSystemsMaster`:
     ```ts
     const finishingSystemOptions = React.useMemo<ComboboxOption[]>(
       () =>
         finishingSystemsMaster.map((fs) => ({
           value: fs.systemName,
           label: fs.systemName,
           badge: `#${fs.sortOrder}`,
           badgeColor: 'slate'
         })),
       [finishingSystemsMaster]
     );
     ```
   - Tại vị trí trường `Finishing System / Hệ sơn` (cột 2 của Header CS): thay `<input type="text">` bằng `<SearchableCombobox>`:
     - `disabled={isLocked}`
     - `value={revision.finishingSystem || ''}`
     - `displayValue={revision.finishingSystem || undefined}` (đảm bảo nếu Revision cũ có giá trị không còn trong Master thì vẫn hiển thị đúng tên đó)
     - `options={finishingSystemOptions}`
     - `placeholder="-- Select System / Chọn Hệ sơn --"`
     - `searchPlaceholder="Search finishing system / Tìm hệ sơn..."`
     - `emptyMessage="Không tìm thấy hệ sơn phù hợp trong Master Data"`
     - `highlightEmpty={true}` (giữ viền cảnh báo vàng khi chưa chọn hệ sơn)
     - `onChange={(val) => handleHeaderChange('finishingSystem', val, 'discrete')}` (kích hoạt Auto-Save nhanh 300ms khi chọn từ dropdown)
     - **Không truyền `onCreateNew`** (chặn nhập tự do theo đúng yêu cầu).
5. **Dropdown trên Modal Tạo Hồ sơ mới (`apps/frontend/src/components/projects/ProjectExplorerView.tsx`):**
   - Nhận prop `finishingSystemsMaster: FinishingSystemMaster[]`.
   - Thay `<input type="text">` của trường `Finishing System / Hệ sơn` trong modal **Create New Project** bằng `<SearchableCombobox>` chỉ chọn từ `finishingSystemsMaster`.

## Files
- Modify: `apps/frontend/src/api/client.ts`
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/components/master/MasterDataManager.tsx`
- Modify: `apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx`
- Modify: `apps/frontend/src/components/projects/ProjectExplorerView.tsx`

## Steps
1. Cập nhật `apps/frontend/src/api/client.ts` thêm 4 hàm API cho `finishing-systems`.
2. Cập nhật `apps/frontend/src/components/master/MasterDataManager.tsx` thêm sub-tab `FINISHING_SYSTEMS`.
3. Cập nhật `apps/frontend/src/components/schedule/CoatingScheduleEditor.tsx` và `apps/frontend/src/components/projects/ProjectExplorerView.tsx` chuyển ô `Finishing System / Hệ sơn` sang `SearchableCombobox` (strict mode).
4. Cập nhật `apps/frontend/src/App.tsx` kết nối state `finishingSystemsMaster` vào các component trên.

## Validation
- `npm run typecheck --workspace=@cscc/frontend` và `npm run build --workspace=@cscc/frontend` thành công 100%.

## Risk / Rollback
- Với các Revision cũ có `finishingSystem` viết thường hoặc khác hoa/thường: nhờ `ensureFinishingSystemsSeeded()` ở Phase 2 và có thể so khớp không phân biệt hoa thường trong `selectedOption` hoặc `finishingSystemOptions`, dropdown vẫn hiển thị mượt mà. Rollback: hoàn tác các file trong `apps/frontend/src/`.
