const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const EventSchema = new Schema({
  name: { type: String, required: true },
  semester: { type: String, enum: ['Spring', 'Summer', 'Fall'], required: true },
  year: { type: Number, required: true },
  description: { type: String },
  bannerUrl: { type: String },
  registrationOpen: { type: Date },
  registrationClose: { type: Date },
  contestStart: { type: Date },
  contestEnd: { type: Date },
  maxTeams: { type: Number },
  status: { type: String, enum: ['draft', 'registration', 'prepare', 'ongoing', 'completed', 'cancelled'], default: 'draft' },
  isArchived: { type: Boolean, default: false },
  githubOrgName: { type: String },
  githubOrgCreated: { type: Boolean, default: false },
  attachments: { type: Schema.Types.Mixed, default: [] },
  commitSyncInterval: { type: Number, default: 30 },
  mainGoal: { 
    type: String, 
    default: 'Phát triển các giải pháp sáng tạo để giải quyết bài toán thực tế và xây dựng hệ thống phần mềm chất lượng. Các đội thi cần tối ưu mã nguồn, liên kết repository và tối ưu hóa hệ thống dưới sự hỗ trợ của AI.' 
  },
  durationText: { 
    type: String, 
    default: '48 GIỜ' 
  },
  memberLimitText: { 
    type: String, 
    default: '2-4 OPERATORS' 
  },
  prizePoolText: { 
    type: String, 
    default: '$50,000 USD' 
  },
  zaloUrl: {
    type: String,
    default: ''
  },
  phase1Description: { 
    type: String, 
    default: 'Các đội thi thực hiện đăng ký tài khoản, liên kết thành viên nhóm và liên kết repository Github chính thức để chuẩn bị nhận nhiệm vụ.' 
  },
  phase2Description: { 
    type: String, 
    default: 'Giai đoạn lập trình cường độ cao. Các đội thực hiện giải quyết yêu cầu dự án, liên tục push commit để AI tự động phân tích và đánh giá chất lượng mã nguồn.' 
  },
  phase3Description: { 
    type: String, 
    default: 'Dừng cổng nộp bài, đóng repository. Các đội thi chuẩn bị báo cáo dự án trước hội đồng giám khảo và nhận kết quả xếp hạng chung cuộc từ hệ thống.' 
  },
  rules: { 
    type: [Schema.Types.Mixed], 
    default: [
      { title: 'Điều 1. Mục tiêu và sứ mệnh cuộc thi', description: 'Thông qua cuộc thi, các đội xây dựng sản phẩm có khả năng giám sát hệ thống, phát hiện bất thường, dự báo rủi ro, chẩn đoán sự cố và hỗ trợ người dùng đưa ra quyết định trong các lĩnh vực vận hành thông minh.' },
      { title: 'Điều 2. Đối tượng tham gia', description: 'Sinh viên, học viên, hoặc nhóm nghiên cứu trong lĩnh vực CNTT, Khoa học dữ liệu, AI, tự động hóa hoặc các ngành liên quan. Mỗi đội thi gồm từ 3 đến 5 thành viên, có thể đến từ cùng hoặc khác trường/đơn vị. Mỗi cá nhân chỉ được đăng ký tham gia duy nhất một đội.' },
      { title: 'Điều 3. Chủ đề và phạm vi thi đấu', description: 'Các đội phát triển một sản phẩm ứng dụng AI để tiếp nhận, xử lý và phân tích dữ liệu IoT theo thời gian thực trong một lĩnh vực cụ thể. Cuộc thi gồm 03 Track chuyên môn khác nhau, bảo mật chủ đề và bốc thăm trước ngày thi đấu. Sản phẩm phải thể hiện rõ vai trò của AI (phát hiện bất thường, dự báo, chẩn đoán, đề xuất hành động). Sản phẩm chỉ trực quan hóa dữ liệu hoặc cảnh báo bằng điều kiện cố định sẽ không được xem là đáp ứng đầy đủ yêu cầu.' },
      { title: 'Điều 4. Cấu trúc và lịch trình cuộc thi', description: 'Ngày 1: Khai mạc, chọn track, bốc thăm chủ đề và chia bảng thi đấu. Ngày 2: Thi đấu chính thức (07h00 - 15h00) gồm Milestone 1 (nộp Slide ý tưởng trước 10h00), Milestone 2 (Thuyết trình ý tưởng 5-8 phút & Hoàn thiện sản phẩm), Technical Review (chấm sản phẩm trực tiếp tại bàn) và Vòng chung kết (Top 3 đội trình diễn).' },
      { title: 'Điều 5. Quy định thi đấu', description: 'Thời gian thi đấu chính thức: 07h00 – 15h00. Trễ quá 60 phút sẽ bị loại. Lưu trữ mã nguồn trên GitHub/GitLab; tài liệu quản lý trên Jira, Confluence hoặc Notion. Sản phẩm trình bày dưới dạng slide. Các đội được phép tự do sử dụng mô hình AI (XGBoost, LSTM, Transformer, GPT, Gemini, Claude, Llama, Qwen, Mistral...). Vòng bảng thuyết trình 5 phút + Q&A 3 phút. Vòng chung kết thuyết trình 7 phút + Q&A 3 phút.' },
      { title: 'Điều 6. Cơ cấu thi đấu và chia bảng', description: 'Sau khi các đội chọn Track, BTC sẽ chia bảng, mỗi bảng tối đa 6 đội. Mỗi Track có thể gồm nhiều bảng, tùy vào số lượng đội đăng ký thực tế.' },
      { title: 'Điều 7. Vòng chung kết và điều kiện xét chọn', description: 'Ban Tổ Chức lựa chọn tổng cộng 08 đội có thành tích cao nhất vào Chung kết. Mỗi bảng chọn số lượng đội bằng nhau để đảm bảo công bằng. Trường hợp xét chọn bổ sung sẽ dựa trên điểm số trung bình so sánh giữa các bảng và có thể áp dụng penalty evaluation (mini test tối đa 10 phút).' },
      { title: 'Điều 8. Tiêu chí chấm điểm', description: 'Chấm điểm phân loại theo thang điểm. Vòng bảng: Xử lý dữ liệu thực tế (25%), Hiệu quả AI (25%), Kiến trúc & Tích hợp (20%), Phù hợp Domain & UX (15%), Ý tưởng & Pitching (15%). Vòng chung kết: Độ hoàn thiện (25%), Năng lực phân tích AI (25%), Độ tin cậy & An toàn (20%), Sáng tạo (15%), Demo & Phản biện (15%).' },
      { title: 'Điều 9. Quy định về đạo đức và bản quyền', description: 'Nghiêm cấm mọi hành vi gian lận, đạo nhái, vi phạm bản quyền hoặc can thiệp trái phép vào hệ thống thi đấu. Sản phẩm nộp dự thi phải là kết quả làm việc của chính đội thi trong thời gian cuộc thi.' },
      { title: 'Điều 10. Quy định chung và hiệu lực', description: 'Ban Tổ Chức có toàn quyền giải thích và điều chỉnh điều lệ khi cần thiết. Mọi tình huống không quy định sẽ do BTC xem xét quyết định đảm bảo công bằng. Hiệu lệ kể từ ngày công bố.' }
    ]
  },
  customTimeline: {
    type: [{
      time: { type: String, required: true },
      title: { type: String, required: true },
      description: { type: String }
    }],
    default: []
  },
  seminar: {
    scheduledAt: { type: Date },
    scheduledEnd: { type: Date },
    meetUrl: { type: String },
    title: { type: String, default: 'Buổi Seminar Hướng Dẫn & Giải Đáp Thắc Mắc Cuộc Thi' },
    description: { type: String },
    isEmailSent: { type: Boolean, default: false },
    emailSentAt: { type: Date },
    attendanceFormUrl: { type: String },
    attendanceSpreadsheetUrl: { type: String }
  },
  prizes: {
    type: [{
      title: { type: String, required: true },
      amount: { type: String, required: true },
      benefits: { type: String }
    }],
    default: [
      { title: '01 GIẢI NHẤT', amount: '7.000.000 đồng', benefits: 'Giấy chứng nhận + hoa' },
      { title: '01 GIẢI NHÌ', amount: '5.000.000 đồng', benefits: 'Giấy chứng nhận + hoa' },
      { title: '01 GIẢI BA', amount: '3.000.000 đồng', benefits: 'Giấy chứng nhận + hoa' },
      { title: '01 GIẢI KHUYẾN KHÍCH', amount: '1.500.000 đồng', benefits: 'Giấy chứng nhận' }
    ]
  },
  specialPrizes: {
    type: [{
      title: { type: String, required: true },
      description: { type: String, required: true }
    }],
    default: [
      { title: 'HẠNG MỤC ĐẶC BIỆT', description: 'Vinh danh dành cho thí sinh đồng hành trọn vẹn 3 mùa giải (Fall 2025, Spring 2026, Summer 2026).' },
      { title: 'GIẤY CHỨNG NHẬN', description: 'Tất cả các thí sinh tham gia cuộc thi đều nhận giấy chứng nhận.' }
    ]
  },
  locationAnnouncement: {
    type: String,
    default: `THÔNG BÁO KHU VỰC VÒNG SƠ LOẠI:.

- Track A: Seminar 1 Thư viện.

- Track B: Tầng G Thư viện.

- Track C: LB24 tầng 2 Thư viện.`
  },
  // Heading shown above the announcement in the participant Team Area
  locationAnnouncementTitle: {
    type: String,
    trim: true,
    maxlength: 120,
    default: "Khu vực thi & Địa điểm"
  }
}, {
  timestamps: true
});

EventSchema.index({ semester: 1, year: 1 }, { unique: true });
EventSchema.index({ status: 1 });
EventSchema.index({ isArchived: 1 });

module.exports = mongoose.model('Event', EventSchema);