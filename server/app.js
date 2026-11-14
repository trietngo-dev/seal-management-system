require("dotenv").config();
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const mongoose = require("mongoose");

// Notification job queue & worker (BullMQ + Redis)
const { initQueue } = require('./features/notifications/notificationQueue');
const { startNotificationWorker } = require('./features/notifications/notificationWorker');

// GitHub AI job queue & worker (BullMQ + Redis)
const githubAiQueue = require('./features/github-ai/githubAiQueue');
const githubAiWorker = require('./features/github-ai/githubAiWorker');
const { startSeminarScheduler } = require('./features/events/seminarScheduler');

// Initialize Redis queue connection at startup
initQueue();
githubAiQueue.initQueue();

// Import all models to register their schemas in Mongoose
require("./features/auth/User");
require("./features/events/Event");
require("./features/events/Track");
require("./features/events/Round");
require("./features/events/PersonnelInvitation");
require("./features/auth/EventRole");
require("./features/grading/Rubric");
require("./features/grading/Criterion");
require("./features/teams/Team");
require("./features/teams/TeamMember");
require("./features/github-ai/GithubRepository");
require("./features/github-ai/RepositorySnapshot");
require("./features/github-ai/Commit");
require("./features/github-ai/CommitFile");
require("./features/github-ai/AiAnalysis");
require("./features/grading/Score");
require("./features/grading/ScoreDetail");
require("./features/grading/ScoreAudit");
require("./features/grading/GradingAssistRequest");
require("./features/grading/Ranking");
require("./features/events/Prize");
require("./features/events/MerchandiseRecord");
require("./features/notifications/Notification");
require("./features/auth/AuditLog");
require("./features/grading/GradingLevel");
require("./features/github-ai/Task");
require("./features/grading/EventLog");
require("./features/chat/ChatRoom");
require("./features/chat/ChatMessage");
require("./features/support/SupportRequest");
const app = express();

// Connect to MongoDB
const mongoUri =
  process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/seal-hackathon";
mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log(
      "Connected to MongoDB successfully at:",
      mongoUri.split("@").pop(),
    );

    // Default system admin (admin@seal.com). Its password comes from DEFAULT_ADMIN_PASSWORD
    // and is re-applied on every start, so .env stays the source of truth.
    try {
      const User = mongoose.model('User');
      const bcrypt = require('bcryptjs');
      const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;
      const admin = await User.findOne({ email: 'admin@seal.com' });

      if (!adminPassword) {
        console.warn("DEFAULT_ADMIN_PASSWORD is not set: skipping default admin (admin@seal.com) setup.");
      } else if (!admin) {
        console.log("Auto-creating default system admin (admin@seal.com)...");
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        const newAdmin = new User({
          email: 'admin@seal.com',
          passwordHash,
          fullName: 'System Administrator',
          githubUsername: 'seal-admin',
          isSystemAdmin: true,
          isApproved: true,
          isActive: true
        });
        await newAdmin.save();
        console.log("Default system admin auto-created successfully!");
      } else if (!(await bcrypt.compare(adminPassword, admin.passwordHash))) {
        admin.passwordHash = await bcrypt.hash(adminPassword, await bcrypt.genSalt(10));
        await admin.save();
        console.log("Default system admin password updated from DEFAULT_ADMIN_PASSWORD.");
      }
    } catch (err) {
      console.error("Error auto-creating admin account on startup:", err.message);
    }

    // Start notification worker after MongoDB is ready
    startNotificationWorker();

    // Start GitHub AI worker after MongoDB is ready
    githubAiWorker.startWorker();

    // Start Seminar Background Scheduler
    startSeminarScheduler();
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
  });

// Configure CORS
app.use(
  cors({
    origin: "*", // For development, allow all. In production, restrict as needed.
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(logger("dev"));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use("/NGHIỆM THU ẢNH", express.static(path.join(__dirname, "../client/public/NGHIỆM THU ẢNH")));
app.use("/NGHI%E1%BB%87M%20THU%20%E1%BA%A2NH", express.static(path.join(__dirname, "../client/public/NGHIỆM THU ẢNH")));

// Routers
const indexRouter = require('./features/index');
const authRouter = require('./features/auth/auth');
const eventsRouter = require('./features/events/events');
const teamsRouter = require('./features/teams/teams');
const rubricsRouter = require('./features/grading/rubrics');
const criteriaRouter = require('./features/grading/criteria');
const gradesRouter = require('./features/grading/grades');
const analyticsRouter = require('./features/grading/analytics');
const notificationsRouter = require('./features/notifications/notifications');
const githubRepositoriesRouter = require('./features/github-ai/githubRepositories');
const aiAnalysesRouter = require('./features/github-ai/aiAnalyses');
const tasksRouter = require('./features/github-ai/tasks');
const chatRouter = require('./features/chat/chat');
const galleryRouter = require('./features/events/gallery');
const personnelInvitationsRouter = require('./features/events/personnelInvitations');
const ctsvRouter = require('./features/events/ctsv');
const supportRouter = require('./features/support/support');

app.use('/api', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/rubrics', rubricsRouter);
app.use('/api/criteria', criteriaRouter);
app.use('/api/grades', gradesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/github-repositories', githubRepositoriesRouter);
app.use('/api/ai-analyses', aiAnalysesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/chat', chatRouter);
app.use('/api/gallery', galleryRouter);
app.use('/api/personnel-invitations', personnelInvitationsRouter);
app.use('/api/ctsv', ctsvRouter);
app.use('/api/support', supportRouter);

// Catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// Error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  console.error("Express Error Handler:", err);

  // Log error to EventLog
  try {
    const EventLog = mongoose.model('EventLog');
    const errorLog = new EventLog({
      action: 'system_error',
      type: 'error',
      details: `Lỗi hệ thống: ${err.message || err}. URL: ${req.originalUrl}. Method: ${req.method}`,
      actorId: req.user ? req.user._id : undefined
    });
    errorLog.save();
  } catch (logErr) {
    console.error("Failed to log error to EventLog:", logErr);
  }

  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: req.app.get("env") === "development" ? err : {},
  });
});

module.exports = app;
