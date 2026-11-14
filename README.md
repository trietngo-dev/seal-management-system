# SEAL Hackathon Management System 🚀

Hệ thống quản lý cuộc thi **SEAL Hackathon** toàn diện dành cho các học kỳ (Spring, Summer, Fall). Nền tảng tự động hóa toàn bộ quy trình: từ đăng ký đội thi (xác nhận email 100%), tự động cấp phát GitHub Private Repository cho đội thi, định kỳ đồng bộ commits và sử dụng trợ lý **Google Gemini AI** để phân tích đóng góp của từng thành viên, hỗ trợ chấm điểm bằng Rubric và hiển thị bảng xếp hạng realtime.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: NodeJS, Express, MongoDB (Mongoose), Nodemailer, Octokit (GitHub REST API), Google Generative AI SDK (Gemini API).
- **Frontend**: ReactJS, TypeScript, Vite, **TailwindCSS v4**, Google Identity Services SDK.
- **Công cụ bổ trợ**: **GitNexus** (MCP Code Intelligence & Blast Radius Analysis).

---

## 📁 Cấu Trúc Thư Mục

```text
seal-management-system/
├── client/                 # Mã nguồn Frontend (React + Vite + TailwindCSS)
├── server/                 # Mã nguồn Backend (NodeJS + Express + MongoDB)
├── mobile/                 # Mã nguồn ứng dụng Mobile (React Native / Expo)
├── test-tools/             # Bộ công cụ kiểm thử & giả lập (Seeding, Stress)
├── docs/                   # Thư mục tài liệu kỹ thuật & tài nguyên
│   ├── guides/             # Hướng dẫn phát triển (DEVELOPER_GUIDE, SYSTEM_HARNESS_GUIDE)
│   ├── database/           # Thiết kế cơ sở dữ liệu (schema.dbml)
│   ├── archive/            # Tài liệu & công cụ cũ đã ngừng dùng (vd. su26-iot: MQTT/Simulator)
│   ├── templates/          # Biểu mẫu Excel & Rubrics cuộc thi
│   ├── deployment/         # Hướng dẫn triển khai Production
│   └── process/            # Quy trình nghiệp vụ & Phân phối đề thi
├── harness.js              # Công cụ CLI quản trị Harness hệ thống
└── README.md               # Hướng dẫn tổng quan dự án
```

---

## 🚀 Hướng Dẫn Cài Đặt Nhanh (Local Setup)

### Điều kiện tiên quyết:
- Đã cài đặt **Node.js** (Khuyên dùng v18 hoặc v20+).
- Đã cài đặt và đang khởi chạy **MongoDB** cục bộ (cổng mặc định `27017`) hoặc có chuỗi kết nối **MongoDB Atlas**.

### Bước 1: Thiết lập cấu hình Backend (`server/`)
1. Di chuyển vào thư mục server và cài đặt các thư viện:
   ```bash
   cd server
   npm install
   ```
2. Tạo tệp `.env` bằng cách sao chép từ file mẫu:
   ```bash
   copy .env.example .env
   ```
3. Mở tệp `.env` vừa tạo và cập nhật các thông số (đặc biệt là `MONGO_URI`, `JWT_SECRET`, và các khóa API thực tế như `GITHUB_TOKEN`, `GEMINI_API_KEY` nếu muốn chạy thật; nếu không hệ thống sẽ chạy ở chế độ **Mock Simulator**).

4. Khởi động Backend server:
   ```bash
   npm start
   ```
   *Backend hoạt động tại: `http://localhost:5000`*

### Bước 2: Thiết lập cấu hình Frontend (`client/`)
1. Mở một terminal mới, di chuyển vào thư mục client và cài đặt thư viện:
   ```bash
   cd client
   npm install
   ```
2. Tạo tệp `.env` từ file mẫu:
   ```bash
   copy .env.example .env
   ```
3. Cập nhật mã `VITE_GOOGLE_CLIENT_ID` và `VITE_GITHUB_CLIENT_ID` nếu cần.
4. Khởi động Frontend dev server:
   ```bash
   npm run dev
   ```
   *Frontend hoạt động tại: [http://localhost:5173](http://localhost:5173)*

---

## 🧪 Chạy Thử Kịch Bản Kiểm Thử (Scenario Test)

Hệ thống đã viết sẵn bộ test tự động giả lập toàn bộ hành trình người dùng: Đăng ký -> Xác nhận -> Tạo Repo -> Sync commit -> AI phân tích -> Chấm điểm -> Bảng xếp hạng.
Để chạy thử:
```bash
cd server
node scenario_test.js
```
Nếu màn hình hiển thị `ALL INTEGRATION SCENARIO TESTS PASSED SUCCESSFULLY! ✅` nghĩa là toàn bộ hệ thống API hoạt động hoàn hảo.

---

## 🌿 Quy Trình Nhánh Git (Git Workflow) Cho Nhóm

Nhóm chúng ta thống nhất sử dụng quy trình nhánh sau để đảm bảo an toàn tuyệt đối khi deploy:

### 1. Phân loại nhánh:
- **`basic_app_function`**: Nhánh gốc chuẩn ổn định (Stable Base). **Tuyệt đối không code trực tiếp trên nhánh này**.
- **`dev`**: Nhánh tích hợp chung và deploy (nhánh trực tiếp chạy sản phẩm).
- **`feature/ten-tinh-nang`**: Nhánh con của mỗi thành viên tự làm việc.

### 2. Các bước làm việc của Dev:
1. **Tạo nhánh tính năng** từ `basic_app_function` mới nhất:
   ```bash
   git checkout basic_app_function
   git pull origin basic_app_function
   git checkout -b feature/tinh-nang-moi
   ```
2. **Kiểm tra biên dịch cục bộ** trước khi merge:
   Trước khi ghép code, chạy lệnh build ở máy để đảm bảo không lỗi TypeScript:
   ```bash
   cd client
   npm run build
   ```
3. **Merge vào nhánh `dev`** để tích hợp và kiểm thử chung (Khuyên dùng tạo **Pull Request** trên GitHub).
4. **Cập nhật lại nhánh gốc**: Sau khi các tính năng trên `dev` hoạt động ổn định không phát sinh lỗi, Lead sẽ merge `dev` vào lại `basic_app_function` để làm mốc ổn định tiếp theo.

---

## 🧠 Tích hợp GitNexus (Code Intelligence)

Dự án sử dụng **GitNexus** để quản lý blast radius của code.
- **Cập nhật chỉ mục**: `npx gitnexus analyze`
- **Kiểm tra độ ảnh hưởng trước khi sửa hàm**: `npx gitnexus impact -r seal-management-system <ten_ham>`
- **Kiểm tra phạm vi thay đổi trước khi commit**: `npx gitnexus detect-changes -s all -r seal-management-system`
