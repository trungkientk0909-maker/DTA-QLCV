# DTA – Hệ thống quản lý công việc – UBND xã Khun Há

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

## Quản lý tài khoản/nhân sự

Sau khi đăng nhập quản trị toàn hệ thống, mở **http://localhost:3000/admin.html** (hoặc `/admin.html` trên tên miền triển khai). Có thể tạo tài khoản với quyền `Admin` hoặc `User`, và thêm nhân sự/phòng ban.

- `Admin` + `Tất cả`: tạo/sửa/xóa mọi công việc, quản trị tài khoản.
- `Admin` + phòng ban cụ thể: xem/sửa/xóa công việc của phòng mình (không tạo công việc mới).
- `User`: xem công việc của phòng; chỉ cập nhật báo cáo của công việc do mình phụ trách; không được duyệt hoặc xóa.

Server kiểm tra lại quyền, không chỉ ẩn nút trên giao diện. Mật khẩu được lưu bằng `scrypt` có salt riêng; phiên đăng nhập dùng cookie HttpOnly. Không đưa `data/database.json` hoặc mật khẩu vào GitHub.

## Khác với bản Google Apps Script

- **Không còn kết nối Google Sheets**: dữ liệu lưu trên máy chủ trong `data/database.json`. Dữ liệu cũ trên Sheets chưa tự nhập sang hệ thống mới.
- Phần HTML gốc có liên kết CSS/JS ngoài (Font Awesome, Google Fonts, ExcelJS, FileSaver); cần mạng Internet để một số biểu tượng và chức năng xuất Excel hoạt động.
- Giao diện đã được nối sang REST API; các thay đổi được máy chủ xác nhận và tải lại sau khi lưu/xóa.
- Bản này chưa gồm phân quyền chi tiết theo từng trường dữ liệu, audit log đầy đủ, email thông báo hay nhiều máy chủ đồng thời.

## API

`POST /api/login`, `POST /api/logout`, `POST /api/change-password`, `GET /api/data`, `POST /api/tasks`, `POST /api/tasks/delete`, `GET/POST /api/admin/users`, `POST /api/admin/assignees`.

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
