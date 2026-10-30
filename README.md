# DTA Workspace Premium V5 – Quản lý công việc và phân quyền theo phòng ban

Dự án Node.js độc lập, chuyển đổi từ **Code 1 (Apps Script)** và **Code 2 (HTML)**. Giữ bố cục gốc, chức năng đăng nhập, danh sách nhiệm vụ, lọc, thống kê, KPI, báo cáo tiến độ, duyệt công việc và xuất Excel.

## Chạy trong Visual Studio Code trên Windows

1. Cài **Node.js 20+** (khuyến nghị Node 22), mở thư mục này bằng **File → Open Folder** trong VS Code.
2. Mở Terminal (Ctrl+`) và nhập (PowerShell):

```powershell
$env:ADMIN_USER="admin"
$env:ADMIN_PASSWORD="MatKhauManh@2026!"
node server.js
```

3. Mở trình duyệt tại **http://localhost:3000** và đăng nhập `admin` với mật khẩu vừa đặt. Ứng dụng yêu cầu đổi mật khẩu lần đầu.
4. Để chạy lại lần sau chỉ cần `node server.js`. Mật khẩu ADMIN_PASSWORD chỉ dùng khi **khởi tạo cơ sở dữ liệu lần đầu**.

## Đẩy lên GitHub

1. Tạo repository mới trên GitHub, **không bật GitHub Pages** vì Pages chỉ chạy trang tĩnh, không thể chạy API Node.js.
2. Trong Terminal của thư mục dự án:

```powershell
git init
git add .
git commit -m "Initial DTA task management application"
git branch -M main
git remote add origin https://github.com/TEN_CUA_BAN/dta-quan-ly-cong-viec.git
git push -u origin main
```

3. Muốn dùng qua Internet: triển khai repository lên VPS, Render/Railway hoặc máy chủ Docker có **ổ lưu trữ lâu dài**. Thiết lập biến môi trường `ADMIN_PASSWORD` (ít nhất 12 ký tự), `DATA_DIR=/app/data` và `COOKIE_SECURE=true` khi chạy HTTPS. Dùng Docker Compose với volume `dta-data` hoặc gắn ổ cứng vĩnh viễn vào `/app/data`.

**Chú ý:** Deploy miễn phí có ổ đĩa tạm sẽ **mất dữ liệu khi khởi động lại**. Đây là bản phù hợp nhóm nhỏ, 1 tiến trình Node.js; không chạy đồng thời nhiều instance trên cùng file JSON. Cần backup `data/database.json` định kỳ, chỉ cho tài khoản quản trị hệ thống truy cập file này.

## V5: Bốn cấp phân quyền

| Vai trò | Phạm vi công việc | Quyền thao tác |
| --- | --- | --- |
| Admin hệ thống (`Admin` + `Tất cả`) | Tất cả phòng ban | Giao nhiệm vụ cho phòng ban **không cần chọn cá nhân**, phân công trực tiếp, theo dõi/sửa/xóa, quản lý tài khoản và phòng ban |
| Trưởng phòng (`Trưởng phòng`) | Tất cả nhiệm vụ của phòng mình, cả nhiệm vụ chưa phân công cá nhân | Xem, nhận và phân công lại cho tài khoản thuộc phòng, cập nhật và quản lý nhiệm vụ của phòng |
| Phó phòng (`Phó phòng`) | Tất cả nhiệm vụ của phòng mình | Tương tự Trưởng phòng trong bản này |
| Nhân viên (`User`) | **Chỉ nhiệm vụ giao đích danh cho tài khoản** | Báo cáo tiến độ công việc được giao; không xem nhiệm vụ người khác hoặc nhiệm vụ mới giao chung cho phòng |

### Thao tác quản trị

Sau khi đăng nhập Admin toàn hệ thống, vào mục **Quản lý phòng ban, tài khoản** hoặc `/admin.html`.
- Thêm/Sửa/Xóa phòng ban; sửa tên tự cập nhật các nhiệm vụ và tài khoản liên quan. Không thể xóa phòng ban đang có công việc hoặc tài khoản.
- Thêm/Sửa/Xóa tài khoản; sửa họ tên, vai trò và phòng ban (không đổi tên đăng nhập). Không thể xóa tài khoản còn công việc; phải chuyển giao nhiệm vụ trước. Không thể tự xóa Admin hiện đăng nhập.
- Reset mật khẩu User từ Admin; thu hồi phiên đăng nhập cũ.
- Danh sách nhân sự hiển thị tất cả người đã được thêm (kể cả chưa có tài khoản), có Sửa/Xóa. Nhân sự đã có tài khoản cần chỉnh sửa qua **Sửa tài khoản**.
- **Giao nhiệm vụ cho phòng ban**: khi thêm công việc, chọn Phòng ban phụ trách, **để trống ô cá nhân** rồi Lưu. Trưởng/phó phòng vào xem nhiệm vụ đó và chọn cá nhân thuộc phòng để phân công tiếp.

Quyền được máy chủ kiểm tra trong API, không chỉ ẩn trên giao diện. Bản V5 không bổ sung audit log đầy đủ và không thay thế đánh giá bảo mật chuyên nghiệp.

## Cập nhật repo GitHub hiện có và Render

1. Sao lưu thư mục `data`/tệp `database.json` nếu đang có dữ liệu (không đưa dữ liệu này lên GitHub).
2. Giải nén ZIP, mở thư mục `DTA-Workspace-Premium` trong VS Code. Cấu trúc `public/index.html`, `public/admin.html` **phải được giữ nguyên**.
3. Cập nhật repository `https://github.com/trungkientk0909-maker/DTA-QLCV` bằng Git từ đúng thư mục dự án (hoặc upload bảo toàn cấu trúc thư mục). Nếu đã clone repo, chép các file bản V5 vào đó rồi `git add .`, `git commit -m "Upgrade DTA Premium V5 permissions"`, `git push`.
4. Render sẽ tự triển khai nếu kết nối nhánh `main` và bật Auto Deploy; nếu không, chọn Deploy latest commit.
5. Cần cấu hình `ADMIN_PASSWORD` từ 12 ký tự khi khởi tạo mới, `COOKIE_SECURE=true` trên HTTPS.

**Cảnh báo:** Render Free có hệ thống file tạm. Không dùng để lưu tài khoản/công việc thực tế trước khi chuyển sang lưu trữ bền vững. Không đưa `database.json` hoặc file `.env` chứa bí mật lên repository công khai. Khi đổi biến `ADMIN_PASSWORD`, mật khẩu tài khoản đã lưu trong database **không tự đổi**.

## Khác với bản Google Apps Script

- **Không còn kết nối Google Sheets**: dữ liệu lưu trên máy chủ trong `data/database.json`. Dữ liệu cũ trên Sheets chưa tự nhập sang hệ thống mới.
- Phần HTML gốc có liên kết CSS/JS ngoài (Font Awesome, Google Fonts, ExcelJS, FileSaver); cần mạng Internet để một số biểu tượng và chức năng xuất Excel hoạt động.
- Giao diện đã được nối sang REST API; các thay đổi được máy chủ xác nhận và tải lại sau khi lưu/xóa.
- Bản này chưa gồm phân quyền chi tiết theo từng trường dữ liệu, audit log đầy đủ, email thông báo hay nhiều máy chủ đồng thời.

## API

`POST /api/login`, `POST /api/logout`, `POST /api/change-password`, `GET /api/data`, `POST /api/tasks`, `POST /api/tasks/delete`, `GET/POST /api/admin/users`, `POST /api/admin/users/update`, `POST /api/admin/users/delete`, `POST /api/admin/users/reset-password`, `GET/POST /api/admin/departments`, `POST /api/admin/departments/update`, `POST /api/admin/departments/delete`, `GET/POST /api/admin/assignees`, `POST /api/admin/assignees/update`, `POST /api/admin/assignees/delete`.

## Lưu ý bảo mật khi triển khai Internet

Sử dụng HTTPS, mật khẩu mạnh, sao lưu định kỳ, giới hạn truy cập trang quản trị (VPN/tường lửa nếu có), và không đưa dữ liệu công việc nhạy cảm lên máy chủ công cộng khi chưa đánh giá bảo mật. CAPTCHA gốc là CAPTCHA giao diện, không phải cơ chế chống bot phía server; server có giới hạn đăng nhập sai theo IP+tài khoản.


## Phiên bản sửa lỗi đăng nhập (29/10/2026)

- Đã sửa bộ gọi API tương thích: chuỗi `withSuccessHandler().withFailureHandler().authenticateUser()` và các thao tác tải dữ liệu, đổi mật khẩu, lưu/xóa công việc chạy trên Node.js thay vì lỗi `...authenticateUser is not a function`.
- Bổ sung giới hạn chờ API 20 giây, tự trả nút đăng nhập về trạng thái ban đầu khi lỗi.
- Đổi tên đơn vị hiển thị thành **UBND xã Khun Há**.
- Có kiểm thử API đăng nhập/đổi mật khẩu, tạo/xóa nhiệm vụ và kiểm thử tương thích các hàm phía trình duyệt.

**Thay dự án trên Windows:** Dừng server Node.js cũ bằng `Ctrl+C` tại Terminal đang chạy; sao lưu `data/database.json` nếu có dữ liệu quan trọng; giải nén phiên bản mới vào thư mục mới, không trộn hai phiên bản; mở thư mục chứa `server.js` trên VS Code. Trường hợp cổng 3000 đã dùng, dừng tiến trình Node.js cũ hoặc dùng `$env:PORT=3001` để thử. Chạy với PowerShell (mỗi dòng Enter riêng):

```powershell
$env:ADMIN_USER="admin"
$env:ADMIN_PASSWORD="THAY_BANG_MAT_KHAU_MANH_RIENG"
node server.js
```

Mở http://localhost:3000 (hoặc 3001 nếu đổi PORT); nhấn `Ctrl+F5` để trình duyệt cập nhật mã. Khi có dữ liệu từ bản cũ, có thể chép `data/database.json` sang bản mới sau khi đã sao lưu và dừng server. Tài khoản/mật khẩu được lưu trong database sẽ được giữ nguyên.

## Nâng cấp quản lý phòng ban và phân quyền cá nhân

Sau khi đăng nhập bằng **Admin toàn hệ thống**, chọn **Quản lý phòng ban, tài khoản** trong menu hoặc mở `/admin.html`.

1. Tạo phòng ban trước, ví dụ **Văn phòng HĐND và UBND xã**.
2. Tạo tài khoản **User** với họ tên chính xác, phòng ban đúng. Tài khoản mới sẽ tự được đưa vào danh sách người nhận việc.
3. Khi tạo công việc, Admin chọn phòng ban và tên người nhận có tài khoản. Máy chủ gắn công việc với **tên đăng nhập** người nhận.
4. Mỗi User chỉ đọc và báo cáo các công việc được gắn với tài khoản đó, **kể cả khi phòng ban có nhiều người**. Admin phòng ban đọc các công việc thuộc phòng mình; Admin toàn hệ thống đọc tất cả.
5. Nếu dữ liệu cũ chứa người được giao chưa có tài khoản, hãy tạo tài khoản User trùng **họ tên và phòng ban** để hệ thống liên kết. Không đặt hai người dùng User cùng họ tên trong cùng một phòng ban.

**Bảo mật:** Quyền xem và sửa được kiểm tra từ API máy chủ, không chỉ ẩn nút trên giao diện. Không đưa `data/database.json` lên GitHub. Sao lưu `data/database.json` trước khi nâng cấp từ bản cũ. Việc định danh tài khoản từ họ tên trong dữ liệu cũ nên được quản trị viên rà soát.

## Bản nâng cấp quản trị giao diện nổi (29/10/2026)

- Admin toàn hệ thống chọn **Quản lý phòng ban, tài khoản** ở trang chính: bảng quản trị hiện trong cửa sổ nổi, không chuyển trang và không đăng nhập lại khi đóng.
- Các nút **Thêm phòng ban**, **Thêm tài khoản**, **Thêm nhân sự** mở form popup ở giữa màn hình, sau khi lưu thành công tự đóng form và cập nhật danh sách.
- Tại **Danh sách tài khoản**, bấm **Reset mật khẩu** để đặt mật khẩu mới cho User. Mật khẩu dài 10–128 ký tự, phải nhập xác nhận. Hệ thống thu hồi tất cả phiên đăng nhập đang hoạt động của tài khoản được reset và bắt đổi mật khẩu ở lần đăng nhập tiếp theo.
- Admin không thể reset mật khẩu của chính mình qua chức năng này; dùng luồng đổi mật khẩu cá nhân. Phân quyền được kiểm tra ở API, không chỉ ở giao diện.
- Khi nâng cấp, dừng server cũ, sao lưu `data/database.json`, giải nén bản mới và giữ dữ liệu cũ nếu cần. Không đưa dữ liệu này vào GitHub.
