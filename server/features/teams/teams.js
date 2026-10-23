const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const crypto = require("crypto");

const Team = mongoose.model("Team");
const TeamMember = mongoose.model("TeamMember");
const User = mongoose.model("User");
const Event = mongoose.model("Event");
const Track = mongoose.model("Track");
const GithubRepository = mongoose.model("GithubRepository");
const EventRole = mongoose.model("EventRole");
const multer = require("multer");
const XLSX = require("xlsx-js-style");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"), false);
    }
  },
});

const emailService = require("../notifications/emailService");
const githubService = require("../github-ai/githubService");
const captchaService = require("../auth/captchaService");
const { ensureChatRoomForTeam } = require("../chat/chatRoomService");

const DEPLOYED_CLIENT_URL = "https://seal-management-staging.vercel.app";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Team size rule: 3–5 people including the leader.
const MIN_TEAM_SIZE = 3;
const MAX_TEAM_SIZE = 5;
const MIN_MEMBERS_BESIDES_LEADER = MIN_TEAM_SIZE - 1;
const MAX_MEMBERS_BESIDES_LEADER = MAX_TEAM_SIZE - 1;

// User input inside a RegExp must be escaped: names like "C++" otherwise throw (500).
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveClientUrl() {
  const configuredUrl = process.env.CLIENT_URL?.trim();
  const isHostedEnvironment =
    process.env.NODE_ENV === "production" ||
    Boolean(
      process.env.RENDER ||
        process.env.VERCEL ||
        process.env.RAILWAY_ENVIRONMENT,
    );

  if (configuredUrl) {
    try {
      const parsedUrl = new URL(configuredUrl);
      const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(
        parsedUrl.hostname,
      );

      if (!isLoopback || !isHostedEnvironment) {
        return configuredUrl.replace(/\/+$/, "");
      }
    } catch (error) {
      console.warn(
        `[TEAM INVITE] Ignoring invalid CLIENT_URL: ${configuredUrl}`,
      );
    }
  }

  return isHostedEnvironment
    ? DEPLOYED_CLIENT_URL
    : "http://localhost:5173";
}

/**
 * Normalizes university names to avoid duplicates and double prefixes.
 */
function normalizeUniversityName(name) {
  if (!name) return "";
  let cleaned = name.trim();

  // 1. Remove duplicate "Trường Đại học Đại học" or "Đại học Đại học" prefixes
  cleaned = cleaned.replace(
    /^(Trường\s+)?Đại\s+học\s+(Trường\s+)?Đại\s+học\s+/i,
    "Trường Đại học ",
  );
  cleaned = cleaned.replace(/^(Trường\s+Đại\s+học\s+)+/i, "Trường Đại học ");
  cleaned = cleaned.replace(/^(Đại\s+học\s+)+/i, "Đại học ");

  // 2. Standardize abbreviations for HCMC IT / Tech Universities
  const lowerCleaned = cleaned.toLowerCase();
  if (
    lowerCleaned === "fpt" ||
    lowerCleaned === "fpt university" ||
    lowerCleaned === "đại học fpt" ||
    lowerCleaned === "truong dai hoc fpt" ||
    lowerCleaned.includes("fpt tp") ||
    lowerCleaned.includes("fpt hcm")
  ) {
    cleaned = "Trường Đại học FPT TP.HCM";
  } else if (
    lowerCleaned === "uit" ||
    lowerCleaned === "đại học công nghệ thông tin" ||
    lowerCleaned === "truong dai hoc cong nghe thong tin" ||
    lowerCleaned.includes("công nghệ thông tin")
  ) {
    cleaned = "Trường Đại học Công nghệ thông tin - ĐHQG TP.HCM";
  } else if (
    lowerCleaned === "hcmut" ||
    lowerCleaned === "đại học bách khoa tphcm" ||
    lowerCleaned === "đại học bách khoa tp.hcm" ||
    (lowerCleaned.includes("bách khoa") && lowerCleaned.includes("hồ chí minh"))
  ) {
    cleaned = "Trường Đại học Bách Khoa - ĐHQG TP.HCM";
  } else if (
    lowerCleaned === "hcmus" ||
    lowerCleaned === "đại học khoa học tự nhiên" ||
    lowerCleaned === "đại học khoa học tự nhiên tphcm" ||
    (lowerCleaned.includes("tự nhiên") && lowerCleaned.includes("hồ chí minh"))
  ) {
    cleaned = "Trường Đại học Khoa học tự nhiên - ĐHQG TP.HCM";
  } else if (
    lowerCleaned === "hcmute" ||
    lowerCleaned === "đại học sư phạm kỹ thuật" ||
    lowerCleaned.includes("sư phạm kỹ thuật")
  ) {
    cleaned = "Trường Đại học Sư phạm Kỹ thuật TP.HCM";
  }

  return cleaned.trim();
}

async function handleTeamFullConfirmation(team) {
  team.status = "confirmed";
  await team.save();

  // Sync team to external simulator API for MQTT keys
  try {
    await syncTeamToExternalSimulator(team);
  } catch (err) {
    console.error("Lỗi đồng bộ simulator khi duyệt đội:", err.message);
  }

  console.log(
    `[TEAM] Team "${team.name}" is now FULLY CONFIRMED! Creating repo...`,
  );

  // 1. Automatically create Github Repository (and invite collaborators)
  try {
    const { repository } = await provisionTeamRepository(team);
    const slugRepoName = repository.repoName;
    const populatedMembers = await TeamMember.find({
      teamId: team._id,
    }).populate("userId");

    // Notify all team members that team is confirmed
    for (const tm of populatedMembers) {
      const recipientId = (tm.userId._id || tm.userId).toString();
      if (isQueueAvailable()) {
        await addInAppJob({
          userId: recipientId,
          type: "team_ready",
          title: "Đội đã sẵn sàng thi đấu",
          body: `Tuyệt vời! Tất cả thành viên đội "${team.name}" đã xác nhận. Repository GitHub của bạn là ${slugRepoName}.`,
        });
      } else {
        const Notification = mongoose.model("Notification");
        await new Notification({
          userId: recipientId,
          type: "team_ready",
          title: "Đội đã sẵn sàng thi đấu",
          body: `Tuyệt vời! Tất cả thành viên đội "${team.name}" đã xác nhận. Repository GitHub của bạn là ${slugRepoName}.`,
          channel: "in_app",
          status: "sent",
        }).save();
      }
    }
  } catch (gitErr) {
    console.error("Lỗi tự động tạo repo GitHub:", gitErr.message);
  }
}

const {
  canUserAccessRoundExam,
  canUserAccessTrackExam,
  sanitizeRoundForParticipant,
  sanitizeTrackExamForParticipant,
  isTrackExamOpen,
  buildDriveUrl,
} = require("../events/examAccessService");
const { ensureUserDriveAccess } = require("../events/driveAccessService");
const Round = mongoose.model("Round");
const { authenticateToken } = require("../auth/authMiddleware");
const {
  addEmailJob,
  addEmailJobWithDelay,
  addInAppJob,
  isQueueAvailable,
} = require("../notifications/notificationQueue");
const {
  generateTeamCode,
  syncTeamToExternalSimulator,
} = require("./externalTeamService");
const { provisionTeamRepository } = require("../github-ai/repoProvisioning");
const { isEventStaff } = require("./teamAccess");

/**
 * @route   GET /api/teams/check-eligibility
 * @desc    Check if a user is eligible to join a team for a specific event (not already in a team)
 * @access  Private (Authenticated Users)
 */
router.get("/check-eligibility", authenticateToken, async (req, res) => {
  const { email, eventId } = req.query;

  if (!email || !eventId) {
    return res
      .status(400)
      .json({ message: "Thiếu thông tin email hoặc eventId." });
  }

  try {
    // Find all active teams (confirmed or pending) in the event
    const activeTeams = await Team.find({
      eventId,
      status: { $in: ["confirmed", "pending_confirm"] },
    });
    const activeTeamIds = activeTeams.map((t) => t._id);

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (!existingUser) {
      return res.json({
        eligible: true,
        message:
          "Hợp lệ (Thành viên chưa có tài khoản, hệ thống sẽ gửi thư mời đăng ký).",
      });
    }

    const memberHasTeam = await TeamMember.findOne({
      teamId: { $in: activeTeamIds },
      userId: existingUser._id,
    });

    if (memberHasTeam) {
      const team = await Team.findById(memberHasTeam.teamId);
      const teamName = team ? team.name : "nhóm khác";
      return res.json({
        eligible: false,
        message: `Thành viên này đã đăng ký tham gia đội "${teamName}" trong cuộc thi này.`,
      });
    }

    return res.json({
      eligible: true,
      message: "Hợp lệ (Thành viên chưa có nhóm trong cuộc thi này).",
      user: {
        fullName: existingUser.fullName,
        studentId: existingUser.studentId,
        githubUsername: existingUser.githubUsername,
        university: existingUser.university,
        height: existingUser.height,
        weight: existingUser.weight,
      },
    });
  } catch (err) {
    console.error("Check eligibility error:", err);
    return res
      .status(500)
      .json({ message: "Lỗi kiểm tra tính hợp lệ của thành viên." });
  }
});

/**
 * @route   GET /api/teams/check-name
 * @desc    Check if a team name already exists for a specific event
 * @access  Private (Authenticated Users)
 */
router.get("/check-name", authenticateToken, async (req, res) => {
  const { name, eventId } = req.query;

  if (!name || !eventId) {
    return res
      .status(400)
      .json({ message: "Thiếu thông tin tên nhóm hoặc eventId." });
  }

  try {
    const existingTeam = await Team.findOne({
      eventId,
      name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, "i") },
    });

    if (existingTeam) {
      return res.json({
        exists: true,
        message: "Tên đội đã tồn tại trong cuộc thi.",
      });
    }

    return res.json({
      exists: false,
      message: "Tên nhóm hợp lệ.",
    });
  } catch (err) {
    console.error("Error checking team name:", err);
    return res
      .status(500)
      .json({ message: "Lỗi hệ thống khi kiểm tra tên nhóm." });
  }
});

/**
 * @route   POST /api/teams/register
 * @desc    Register a team and invite members
 * @access  Private (Participants)
 */
router.post("/register", authenticateToken, async (req, res) => {
  const {
    eventId,
    trackId,
    teamName,
    membersList,
    leaderInfo,
    captchaId,
    captchaValue,
  } = req.body;

  if (!eventId || !teamName || !membersList || !Array.isArray(membersList)) {
    return res
      .status(400)
      .json({ message: "Đã xảy ra lỗi trong quá trình đăng ký." });
  }

  // Teams have 3–5 people: the leader plus 2–4 members.
  if (membersList.length < MIN_MEMBERS_BESIDES_LEADER) {
    return res
      .status(400)
      .json({ message: `Số lượng thành viên không đủ (tối thiểu ${MIN_TEAM_SIZE} người kể cả Trưởng nhóm).` });
  }
  if (membersList.length > MAX_MEMBERS_BESIDES_LEADER) {
    return res
      .status(400)
      .json({ message: `Số lượng thành viên vượt quá giới hạn (tối đa ${MAX_TEAM_SIZE} người kể cả Trưởng nhóm).` });
  }

  if (!leaderInfo || !leaderInfo.fullName || !leaderInfo.githubUsername || !leaderInfo.height || !leaderInfo.weight) {
    return res
      .status(400)
      .json({ message: "Họ tên, GitHub Username, chiều cao và cân nặng của Trưởng nhóm là bắt buộc." });
  }

  if (isNaN(Number(leaderInfo.height)) || isNaN(Number(leaderInfo.weight))) {
    return res
      .status(400)
      .json({ message: "Chiều cao và cân nặng của Trưởng nhóm phải là số hợp lệ." });
  }

  // The leader is always the logged-in user. Accepting another email here would let
  // anyone make an existing account the leader and overwrite its profile.
  if (
    leaderInfo.email &&
    leaderInfo.email.toLowerCase().trim() !== req.user.email.toLowerCase()
  ) {
    return res
      .status(400)
      .json({ message: "Email trưởng nhóm phải là email của tài khoản đang đăng nhập." });
  }

  // Validate required fields for members
  const seenEmails = new Set([req.user.email.toLowerCase()]);
  for (let i = 0; i < membersList.length; i++) {
    const m = membersList[i];
    if (!m.email || !m.fullName || !m.githubUsername) {
      return res
        .status(400)
        .json({
          message: `Thành viên thứ ${i + 1} phải điền đầy đủ Email, Họ Tên và GitHub Username.`,
        });
    }
    const normalizedEmail = String(m.email).toLowerCase().trim();
    if (seenEmails.has(normalizedEmail)) {
      return res
        .status(400)
        .json({
          message: `Email "${m.email}" bị trùng (với trưởng nhóm hoặc thành viên khác).`,
        });
    }
    seenEmails.add(normalizedEmail);
  }

  let createdTeamId = null;
  try {
    // Validate Captcha
    if (!captchaService.verifyCaptcha(captchaId, captchaValue)) {
      return res
        .status(400)
        .json({
          message: "Mã xác thực Captcha không chính xác hoặc đã hết hạn.",
        });
    }

    const User = mongoose.model("User");
    const leader = await User.findById(req.user._id);

    if (leader) {
      if (leaderInfo.fullName) leader.fullName = leaderInfo.fullName;
      if (leaderInfo.studentId) leader.studentId = leaderInfo.studentId;
      if (leaderInfo.githubUsername)
        leader.githubUsername = leaderInfo.githubUsername;
      if (leaderInfo.university) leader.university = leaderInfo.university;
      if (leaderInfo.height) leader.height = Number(leaderInfo.height);
      if (leaderInfo.weight) leader.weight = Number(leaderInfo.weight);
      await leader.save();
    } else {
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin trưởng nhóm." });
    }

    // 1. Verify Event is active & open for registration
    const event = await Event.findById(eventId);
    if (!event)
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin cuộc thi." });
    if (event.status !== "registration") {
      return res
        .status(400)
        .json({ message: "Cuộc thi hiện không mở đăng ký." });
    }

    // Check overall event capacity (both confirmed and pending_confirm)
    const activeTeamsCount = await Team.countDocuments({
      eventId,
      status: { $in: ["confirmed", "pending_confirm"] },
    });
    if (event.maxTeams && activeTeamsCount >= event.maxTeams) {
      return res
        .status(400)
        .json({
          message: "Cuộc thi đã đạt giới hạn số lượng đội đăng ký dự kiến.",
        });
    }

    // Check track capacity if trackId is provided
    if (trackId) {
      const track = await Track.findById(trackId);
      if (!track)
        return res.status(404).json({ message: "Bảng đấu không tồn tại." });

      const trackActiveCount = await Team.countDocuments({
        trackId,
        status: { $in: ["confirmed", "pending_confirm"] },
      });
      if (track.maxTeams && trackActiveCount >= track.maxTeams) {
        return res
          .status(400)
          .json({
            message: "Bảng đấu này đã đạt giới hạn số lượng đội đăng ký.",
          });
      }
    }

    // 2. Validate that none of the members or the leader are already in another team in this event
    const activeTeams = await Team.find({
      eventId,
      status: { $in: ["confirmed", "pending_confirm"] },
    });
    const activeTeamIds = activeTeams.map((t) => t._id);

    // Check leader
    const leaderHasTeam = await TeamMember.findOne({
      teamId: { $in: activeTeamIds },
      userId: leader._id,
    });
    if (leaderHasTeam) {
      return res
        .status(400)
        .json({
          message:
            "Tài khoản trưởng nhóm đã đăng ký tham gia một nhóm khác trong cuộc thi này.",
        });
    }

    // Check members
    for (const memberData of membersList) {
      const { email } = memberData;
      if (!email) continue;

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        const memberHasTeam = await TeamMember.findOne({
          teamId: { $in: activeTeamIds },
          userId: existingUser._id,
        });
        if (memberHasTeam) {
          return res.status(400).json({
            message: `Thành viên với email "${email}" đã đăng ký tham gia một nhóm khác trong cuộc thi này.`,
          });
        }
      }
    }

    // 3. Validate that team name is unique inside the event
    const nameFilter = { eventId, name: teamName };
    if (trackId) nameFilter.trackId = trackId;
    const existingTeam = await Team.findOne(nameFilter);
    if (existingTeam) {
      return res
        .status(400)
        .json({ message: "Tên đội đã tồn tại trong cuộc thi." });
    }

    // 3. Create the Team record
    const team = new Team({
      eventId,
      trackId: trackId || undefined,
      leaderId: leader._id,
      name: teamName,
      status: "pending_confirm",
    });
    await team.save();
    createdTeamId = team._id;

    // 4. Register/Handle Leader as TeamMember
    const leaderMember = new TeamMember({
      teamId: team._id,
      eventId: team.eventId,
      userId: leader._id,
      role: "leader",
      confirmStatus: "confirmed",
      confirmedAt: new Date(),
    });
    await leaderMember.save();

    // Update/Create EventRole for the Leader to 'participant'
    let leaderRoleRecord = await EventRole.findOne({
      userId: leader._id,
      eventId,
      status: "active",
    });

    if (!leaderRoleRecord) {
      const newLeaderRole = new EventRole({
        userId: leader._id,
        eventId,
        role: "participant",
        assignedBy: req.user._id,
      });
      await newLeaderRole.save();
    }

    // 5. Loop through and invite other members
    for (const memberData of membersList) {
      const { email, fullName, githubUsername, studentId, university, height, weight } =
        memberData;
      if (!email) continue;

      // Find or create User record for member
      let memberUser = await User.findOne({ email: email.toLowerCase() });
      if (!memberUser) {
        // Create user placeholder with random password (must set later)
        const placeholderPass = crypto.randomBytes(8).toString("hex");
        memberUser = new User({
          email: email.toLowerCase(),
          passwordHash: crypto
            .createHash("sha256")
            .update(placeholderPass)
            .digest("hex"), // temp hash
          fullName: fullName || email.split("@")[0],
          studentId: studentId || "",
          githubUsername: githubUsername || "",
          university: university || "",
          height: height ? Number(height) : null,
          weight: weight ? Number(weight) : null,
          isApproved: true,
        });
        await memberUser.save();
      } else {
        let changed = false;
        if (githubUsername && !memberUser.githubUsername) {
          memberUser.githubUsername = githubUsername;
          changed = true;
        }
        if (university && !memberUser.university) {
          memberUser.university = university;
          changed = true;
        }
        if (height) {
          memberUser.height = Number(height);
          changed = true;
        }
        if (weight) {
          memberUser.weight = Number(weight);
          changed = true;
        }
        if (changed) {
          await memberUser.save();
        }
      }

      // Generate verification token
      const token = crypto.randomBytes(32).toString("hex");
      const confirmTokenExpiry = new Date(Date.now() + 3600000 * 48); // 48h expiry

      const teamMember = new TeamMember({
        teamId: team._id,
        eventId: team.eventId,
        userId: memberUser._id,
        role: "member",
        confirmStatus: "pending",
        confirmTokenHash: token,
        confirmTokenExpiry,
      });
      await teamMember.save();

      // Send email invitation via job queue (non-blocking, with retry)
      const inviteLink = `${req.protocol}://${req.get("host")}/api/teams/confirm-invite?token=${token}`;
      if (isQueueAvailable()) {
        await addEmailJob({
          type: "team_invite",
          email: memberUser.email,
          teamName,
          inviteLink,
          leaderName: leader ? leader.fullName : undefined,
          leaderEmail: leader ? leader.email : undefined,
          eventName: event ? event.name : undefined,
          role: "member",
          seminar: event?.seminar ? {
            title: event.seminar.title,
            description: event.seminar.description,
            scheduledAt: event.seminar.scheduledAt,
            scheduledEnd: event.seminar.scheduledEnd,
            meetUrl: event.seminar.meetUrl
          } : null,
          fullName: memberUser.fullName,
        });
        // Send In-App Notification via queue
        await addInAppJob({
          userId: memberUser._id.toString(),
          type: "team_invite",
          title: "Lời mời vào đội",
          body: `Bạn đã được mời vào đội "${teamName}". Hãy kiểm tra email để xác nhận!`,
        });
      } else {
        // Fallback: synchronous (Redis not available)
        emailService
          .sendTeamInvitation(
            memberUser.email,
            teamName,
            inviteLink,
            leader ? leader.fullName : null,
            leader ? leader.email : null,
            event ? event.name : null,
            "member",
            event?.seminar ? {
              title: event.seminar.title,
              description: event.seminar.description,
              scheduledAt: event.seminar.scheduledAt,
              scheduledEnd: event.seminar.scheduledEnd,
              meetUrl: event.seminar.meetUrl
            } : null,
            memberUser.fullName
          )
          .catch((err) =>
            console.error(
              `[FALLBACK] Failed to send invitation email to ${memberUser.email}:`,
              err.message,
            ),
          );
        const Notification = mongoose.model("Notification");
        await new Notification({
          userId: memberUser._id,
          type: "team_invite",
          title: "Lời mời vào đội",
          body: `Bạn đã được mời vào đội "${teamName}". Hãy kiểm tra email để xác nhận!`,
          channel: "in_app",
          status: "sent",
        }).save();
      }
    }

    // Check if team has any pending members. If none (e.g. registered with no additional members),
    // confirm the team immediately and auto-create repo!
    const pendingMembers = await TeamMember.countDocuments({
      teamId: team._id,
      confirmStatus: "pending",
    });
    if (pendingMembers === 0) {
      await handleTeamFullConfirmation(team);
      const newRepo = await GithubRepository.findOne({ teamId: team._id });

      return res.status(201).json({
        message:
          "Đăng ký nhóm thành công! Nhóm đã được xác nhận lập tức và khởi tạo kho lưu trữ GitHub.",
        teamId: team._id,
        status: "confirmed",
        repository: newRepo,
      });
    }

    res.status(201).json({
      message:
        "Đăng ký đội thành công! Đã gửi email xác nhận tham gia cho các thành viên.",
      teamId: team._id,
      status: team.status,
    });
  } catch (error) {
    console.error("Team Registration Error:", error.message);
    if (createdTeamId) {
      try {
        console.log(
          `[ROLLBACK] Cleaning up team ${createdTeamId} due to registration error...`,
        );
        const TeamMember = mongoose.model("TeamMember");
        const Team = mongoose.model("Team");
        await Team.deleteOne({ _id: createdTeamId });
        await TeamMember.deleteMany({ teamId: createdTeamId });
      } catch (rollbackError) {
        console.error(
          "[ROLLBACK ERROR] Failed to clean up team registration:",
          rollbackError.message,
        );
      }
    }

    // Xử lý lỗi trùng lặp duy nhất (Race condition / Concurrent registration)
    if (error.code === 11000) {
      return res.status(400).json({
        message:
          "Một hoặc nhiều thành viên (hoặc chính bạn) đã được đăng ký vào một đội khác trong cuộc thi này.",
      });
    }

    res.status(500).json({ message: "Đăng ký đội thất bại." });
  }
});

/**
 * @route   GET /api/teams/confirm-invite
 * @desc    Confirm team participation link
 * @access  Public
 */
router.get("/confirm-invite", async (req, res) => {
  const { token } = req.query;

  const clientUrl = resolveClientUrl();

  if (!token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html class="dark" lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEAL HACKATHON // LỖI XÁC THỰC</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #0a141d;
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
          }
        </style>
      </head>
      <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-[#0a141d]/90 border border-red-500/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse"></div>
          <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[INVITATION_ERROR]</div>
          <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">THIẾU MÃ XÁC NHẬN</h1>
          <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Không tìm thấy mã xác nhận lời mời trong yêu cầu của bạn.</p>
          <a href="${clientUrl}" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] rounded">ĐI TỚI BẢNG ĐIỀU KHIỂN</a>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const member = await TeamMember.findOne({
      confirmTokenHash: token,
    });

    if (!member) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html class="dark" lang="vi">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SEAL HACKATHON // LỖI LỜI MỜI</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #0a141d;
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
              background-size: 40px 40px;
            }
          </style>
        </head>
        <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#0a141d]/90 border border-red-500/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse"></div>
            <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[LINK_EXPIRED_OR_INVALID]</div>
            <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">LIÊN KẾT HẾT HẠN</h1>
            <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Mã xác thực của bạn không hợp lệ hoặc đường link này đã hết hạn hiệu lực (48 giờ).</p>
            <a href="${clientUrl}" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] rounded">ĐI TỚI BẢNG ĐIỀU KHIỂN</a>
          </div>
        </body>
        </html>
      `);
    }

    // If already confirmed, redirect directly to survey page with auth token.
    // The invite link logs the user in, so it must stop doing that once it expires;
    // otherwise an old email becomes a permanent login link.
    if (member.confirmStatus === "confirmed") {
      if (!member.confirmTokenExpiry || member.confirmTokenExpiry < new Date()) {
        return res.redirect(`${clientUrl}/login`);
      }
      const team = await Team.findById(member.teamId);
      const user = await User.findById(member.userId);
      let authToken = "";
      if (user) {
        const jwt = require("jsonwebtoken");
        const JWT_SECRET = require("../auth/jwtSecret");
        const sessionId = crypto.randomBytes(16).toString("hex");
        user.activeSessionId = sessionId;
        await user.save();
        authToken = jwt.sign(
          { id: user._id, email: user.email, isSystemAdmin: user.isSystemAdmin, sessionId },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
      }
      return res.redirect(`${clientUrl}/confirm-survey?token=${authToken}&teamName=${encodeURIComponent(team ? team.name : "")}`);
    }

    // Check token expiry for pending confirmation
    if (member.confirmTokenExpiry && member.confirmTokenExpiry < new Date()) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html class="dark" lang="vi">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SEAL HACKATHON // LỖI LỜI MỜI</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
          <style>
            body {
              background-color: #0a141d;
              background-image: 
                linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
              background-size: 40px 40px;
            }
          </style>
        </head>
        <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
          <div class="w-full max-w-md bg-[#0a141d]/90 border border-red-500/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse"></div>
            <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[LINK_EXPIRED_OR_INVALID]</div>
            <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
              </svg>
            </div>
            <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">LIÊN KẾT HẾT HẠN</h1>
            <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Mã xác thực của bạn không hợp lệ hoặc đường link này đã hết hạn hiệu lực (48 giờ).</p>
            <a href="${clientUrl}" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] rounded">ĐI TỚI BẢNG ĐIỀU KHIỂN</a>
          </div>
        </body>
        </html>
      `);
    }

    // Confirm member
    member.confirmStatus = "confirmed";
    member.confirmedAt = new Date();
    await member.save();

    // Check if ALL team members are now confirmed
    const team = await Team.findById(member.teamId);

    // Update/Create EventRole for the Member to 'participant'
    if (team) {
      let memberRoleRecord = await EventRole.findOne({
        userId: member.userId,
        eventId: team.eventId,
        status: "active",
      });

      if (!memberRoleRecord) {
        const newMemberRole = new EventRole({
          userId: member.userId,
          eventId: team.eventId,
          role: "participant",
          assignedBy: team.leaderId,
        });
        await newMemberRole.save();
      }
    }

    const totalMembers = await TeamMember.find({ teamId: team._id });
    const pendingCount = totalMembers.filter(
      (m) => m.confirmStatus !== "confirmed",
    ).length;

    // Notify Leader that a member confirmed
    const user = await User.findById(member.userId);

    // Re-share Drive if exam already open for this round
    if (user?.email && team?.trackId) {
      try {
        const track = await Track.findById(team.trackId);
        if (track?.roundId) {
          const round = await Round.findById(track.roundId);
          if (
            round?.driveFileId &&
            round.startTime &&
            new Date() >= new Date(round.startTime)
          ) {
            await ensureUserDriveAccess(round.driveFileId, user.email);
          }
        }
      } catch (driveErr) {
        console.error(
          "[DRIVE] Re-sync on member confirm failed:",
          driveErr.message,
        );
      }
    }

    if (member.userId.toString() !== team.leaderId.toString()) {
      if (isQueueAvailable()) {
        await addInAppJob({
          userId: team.leaderId.toString(),
          type: "member_confirm",
          title: "Thành viên đã xác nhận",
          body: `Thành viên ${user ? user.fullName : "mới"} đã xác nhận tham gia đội "${team.name}".`,
        });
      } else {
        // Fallback: synchronous
        const Notification = mongoose.model("Notification");
        await new Notification({
          userId: team.leaderId,
          type: "member_confirm",
          title: "Thành viên đã xác nhận",
          body: `Thành viên ${user ? user.fullName : "mới"} đã xác nhận tham gia đội "${team.name}".`,
          channel: "in_app",
          status: "sent",
        }).save();
      }
    }
    if (pendingCount === 0) {
      await handleTeamFullConfirmation(team);
    }

    // Generate auth token so user is automatically authenticated on frontend
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = require("../auth/jwtSecret");
    let authToken = "";
    if (user) {
      const sessionId = crypto.randomBytes(16).toString("hex");
      user.activeSessionId = sessionId;
      await user.save();
      authToken = jwt.sign(
        { id: user._id, email: user.email, isSystemAdmin: user.isSystemAdmin, sessionId },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
    }

    // Redirect directly to frontend survey page with token
    return res.redirect(`${clientUrl}/confirm-survey?token=${authToken}&teamName=${encodeURIComponent(team.name)}`);
  } catch (error) {
    console.error("Invite Confirmation Error:", error.message);
    const clientUrl = resolveClientUrl();
    res.status(500).send(`
      <!DOCTYPE html>
      <html class="dark" lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SEAL HACKATHON // LỖI HỆ THỐNG</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
        <style>
          body {
            background-color: #0a141d;
            background-image: 
              linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
            background-size: 40px 40px;
          }
        </style>
      </head>
      <body class="min-h-screen text-slate-300 font-sans flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-[#0a141d]/90 border border-red-500/30 backdrop-blur-md p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80 animate-pulse"></div>
          <div class="inline-flex border border-red-500 px-3 py-1 text-xs font-mono text-red-500 mb-6 bg-red-500/5 uppercase tracking-widest rounded">[SERVER_ERROR]</div>
          <div class="w-20 h-20 mx-auto mb-6 rounded-full border border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <svg class="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-extrabold text-white mb-3 uppercase tracking-tight font-mono">LỖI HỆ THỐNG</h1>
          <p class="text-sm text-slate-400 mb-8 font-sans leading-relaxed">Đã xảy ra lỗi trong quá trình xử lý xác nhận lời mời của bạn. Vui lòng thử lại sau.</p>
          <a href="${clientUrl}" class="inline-block w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] rounded">ĐI TỚI BẢNG ĐIỀU KHIỂN</a>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * @route   POST /api/teams/verify-past-participation
 * @desc    Verify if logged in user (or provided email) participated in a past completed event
 * @access  Private
 */
router.post("/verify-past-participation", async (req, res) => {
  try {
    const { eventId, email } = req.body;

    if (!eventId || !email) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn sự kiện và nhập email đã từng tham gia.",
      });
    }

    // Try optional JWT authentication
    let loggedInUser = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, require('../auth/jwtSecret'));
        loggedInUser = decoded;
      } catch (err) {}
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Sự kiện được chọn không tồn tại.",
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Find target user by email
    const User = mongoose.model("User");
    const targetUser = await User.findOne({ email: trimmedEmail });

    let teamMemberRecords = [];
    if (targetUser) {
      teamMemberRecords = await TeamMember.find({
        eventId: event._id,
        userId: targetUser._id,
        confirmStatus: "confirmed",
      }).populate("teamId");
    }

    if (teamMemberRecords.length === 0) {
      const allEventMembers = await TeamMember.find({
        eventId: event._id,
        confirmStatus: "confirmed",
      }).populate("userId").populate("teamId");

      teamMemberRecords = allEventMembers.filter(
        (m) => m.userId && m.userId.email && m.userId.email.toLowerCase() === trimmedEmail
      );
    }

    if (teamMemberRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy thông tin tham gia với email "${trimmedEmail}" tại sự kiện "${event.name}". Vui lòng kiểm tra lại email hoặc sự kiện!`,
      });
    }

    const matchedRecord = teamMemberRecords[0];
    const team = matchedRecord.teamId;

    if (!team) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy thông tin đội thi tương ứng với email "${trimmedEmail}".`,
      });
    }

    // Link past team to user profile if user is logged in or target user exists
    const linkUserId = loggedInUser ? (loggedInUser._id || loggedInUser.id) : (targetUser ? targetUser._id : null);
    if (linkUserId) {
      await User.findByIdAndUpdate(linkUserId, {
        $addToSet: {
          verifiedPastTeams: {
            teamId: team._id,
            eventId: event._id,
            pastEmail: trimmedEmail,
            verifiedAt: new Date(),
          },
        },
      });
    }

    return res.json({
      success: true,
      message: `Xác thực thành công! Đã tìm thấy thành tích tại sự kiện "${event.name}" thuộc đội "${team.name}".`,
      teamName: team.name,
      eventName: event.name,
    });
  } catch (error) {
    console.error("Lỗi xác thực tham gia trước đó:", error.message);
    res.status(500).json({
      success: false,
      message: "Có lỗi xảy ra khi xác thực thông tin tham gia.",
    });
  }
});

/**
 * @route   GET /api/teams/history
 * @desc    Get previous teams the logged in user has participated in
 * @access  Private
 */
router.get("/history", authenticateToken, async (req, res) => {
  try {
    const User = mongoose.model("User");
    const userDoc = await User.findById(req.user._id).lean();
    const verifiedTeamIds = (userDoc?.verifiedPastTeams || []).map((t) => t.teamId);

    const memberRecords = await TeamMember.find({
      $or: [
        { userId: req.user._id, confirmStatus: "confirmed" },
        { teamId: { $in: verifiedTeamIds } },
      ],
    });

    if (!memberRecords || memberRecords.length === 0) {
      return res.json([]);
    }

    const teamIds = memberRecords.map((r) => r.teamId);

    const teams = await Team.find({ _id: { $in: teamIds } })
      .populate("eventId", "name semester year status")
      .lean();

    const teamsWithMembers = [];

    for (const team of teams) {
      const allMembers = await TeamMember.find({ teamId: team._id })
        .populate(
          "userId",
          "fullName email studentId githubUsername university",
        )
        .lean();

      const otherMembers = allMembers
        .filter(
          (m) =>
            m.userId && m.userId._id.toString() !== req.user._id.toString(),
        )
        .map((m) => ({
          email: m.userId.email || "",
          fullName: m.userId.fullName || "",
          githubUsername: m.userId.githubUsername || "",
          studentId: m.userId.studentId || "",
          university: m.userId.university || "",
        }));

      teamsWithMembers.push({
        _id: team._id,
        name: team.name,
        event: team.eventId,
        members: otherMembers,
      });
    }

    res.json(teamsWithMembers);
  } catch (error) {
    console.error("Fetch Team History Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi tải lịch sử nhóm." });
  }
});

/**
 * @route   GET /api/teams/my-team
 * @desc    Get logged in user's team details
 * @access  Private
 */
router.get("/my-team", authenticateToken, async (req, res) => {
  try {
    const memberRecords = await TeamMember.find({
      userId: req.user._id,
      confirmStatus: "confirmed",
    });
    if (!memberRecords || memberRecords.length === 0) {
      return res
        .status(404)
        .json({
          message: "Bạn hiện không ở trong bất kỳ nhóm nào đã được xác nhận.",
        });
    }

    let team = null;
    let activeMemberRecord = null;
    const foundTeams = [];

    const targetEventId = req.query.eventId;

    // Find all confirmed records pointing to active teams that actually exist
    for (const record of memberRecords) {
      const foundTeam = await Team.findById(record.teamId)
        .populate(
          "eventId",
          "name semester year status contestStart contestEnd registrationOpen registrationClose seminar commitSyncInterval zaloUrl locationAnnouncement",
        )
        .populate("mentorId", "fullName email")
        .populate({
          path: "originalTrackId",
          select:
            "name description startTime endTime roundId environmentId examDriveFileId examDriveFileName examDriveFileUrl isExamManualOpen topicName topicLink",
        })
        .populate({
          path: "trackId",
          select:
            "name description startTime endTime roundId environmentId examDriveFileId examDriveFileName examDriveFileUrl isExamManualOpen topicName topicLink",
          populate: {
            path: "roundId",
            model: "Round",
          },
        });
      if (foundTeam) {
        if (
          targetEventId &&
          foundTeam.eventId &&
          foundTeam.eventId._id.toString() !== targetEventId
        ) {
          continue;
        }
        // Skip orphan teams whose event has been deleted/removed
        if (!foundTeam.eventId) {
          continue;
        }
        foundTeams.push({ team: foundTeam, record });
      }
    }

    if (foundTeams.length > 0) {
      // Prioritize teams belonging to events that are NOT completed/cancelled, and whose contestEnd has not passed
      const activeTeams = foundTeams.filter(({ team }) => {
        const isEnded =
          team.eventId &&
          (team.eventId.status === "completed" ||
            team.eventId.status === "cancelled" ||
            (team.eventId.contestEnd &&
              new Date(team.eventId.contestEnd) <= new Date()));
        return !isEnded;
      });

      if (activeTeams.length > 0) {
        team = activeTeams[0].team;
        activeMemberRecord = activeTeams[0].record;
      } else {
        // Fallback to the first found team (e.g. past team)
        team = foundTeams[0].team;
        activeMemberRecord = foundTeams[0].record;
      }
    }

    if (!team) {
      return res
        .status(404)
        .json({
          message:
            "Bạn hiện không ở trong bất kỳ nhóm nào đã được xác nhận và đang hoạt động.",
        });
    }

    const members = await TeamMember.find({ teamId: team._id }).populate(
      "userId",
      "fullName email studentId githubUsername avatarUrl university height weight",
    );

    const repo = await GithubRepository.findOne({ teamId: team._id });

    const teamPlain = team.toObject();

    const trackPlain = teamPlain.trackId;
    const effectiveOriginalTrack = teamPlain.originalTrackId;
    if (trackPlain) {
      // Sanitize round for participant (strip raw drive url from round)
      const roundData = trackPlain.roundId;
      if (roundData) {
        trackPlain.roundId = sanitizeRoundForParticipant(roundData);
      }
      // Attach per-track exam info — if in final round or has original track, fallback to original track exam
      const examTrackSource = effectiveOriginalTrack || trackPlain;
      trackPlain.examAccess = sanitizeTrackExamForParticipant(
        examTrackSource,
        roundData,
      );
      if (effectiveOriginalTrack) {
        trackPlain.originalTrackName = effectiveOriginalTrack.name;
        if (effectiveOriginalTrack.environmentId) {
          trackPlain.environmentId = effectiveOriginalTrack.environmentId;
        }
        if (effectiveOriginalTrack.topicName) {
          trackPlain.topicName = effectiveOriginalTrack.topicName;
        }
        if (effectiveOriginalTrack.topicLink) {
          trackPlain.topicLink = effectiveOriginalTrack.topicLink;
        }
      }
      // Remove raw exam fields so participant can't extract url directly from track object
      delete trackPlain.examDriveFileId;
      delete trackPlain.examDriveFileUrl;
      delete trackPlain.examDriveFileName;
      teamPlain.trackId = trackPlain;
    }

    // Calculate event rounds and elimination status
    const Round = mongoose.model("Round");
    const allRounds = await Round.find({ eventId: team.eventId._id }).sort({
      order: 1,
    });
    const activeRound = allRounds.find(
      (r) => r.status === "active" || r.status === "scoring",
    );

    let isEliminated = false;
    let eliminationMessage = "";
    let achievedResult = null;

    if (team.status === "disqualified") {
      isEliminated = true;
      eliminationMessage =
        team.disqualifyReason || "Đội thi của bạn đã bị loại khỏi cuộc thi.";
    } else if (trackPlain && trackPlain.roundId) {
      const teamRound = trackPlain.roundId;
      const hasNextRound = allRounds.some((r) => r.order > teamRound.order);
      if (teamRound.status === "completed" && hasNextRound) {
        isEliminated = true;
        eliminationMessage = `Đội thi của bạn đã dừng bước tại vòng "${teamRound.name}" và không thể tiến vào vòng kế tiếp.`;

        // Fetch ranking/result achieved in this completed round
        const Ranking = mongoose.model("Ranking");
        const rankingDoc = await Ranking.findOne({
          teamId: team._id,
          roundId: teamRound._id,
        }).lean();
        if (rankingDoc) {
          achievedResult = {
            score: rankingDoc.finalScore || rankingDoc.averageScore || 0,
            rank: rankingDoc.rank || 0,
            roundName: teamRound.name,
            trackName: trackPlain.name,
          };
        }
      }
    }

    const currentEventRound = activeRound ? activeRound.name : null;

    teamPlain.isEliminated = isEliminated;
    teamPlain.eliminationMessage = eliminationMessage;
    teamPlain.currentEventRound = currentEventRound;
    teamPlain.achievedResult = achievedResult;

    // Fetch active judge status from simulator
    let isJudgeActive = false;
    if (teamPlain.externalTeamCode) {
      const { getJudgeActive } = require("./externalTeamService");
      try {
        const activeInfo = await getJudgeActive();
        const info = Array.isArray(activeInfo)
          ? activeInfo.find(
              (item) => item.teamCode === teamPlain.externalTeamCode,
            )
          : activeInfo && activeInfo.teamCode === teamPlain.externalTeamCode
            ? activeInfo
            : null;
        if (info) {
          isJudgeActive = true;
          if (info.judgeApiKey) teamPlain.judgeApiKey = info.judgeApiKey;
          if (info.judgeTopic) teamPlain.judgeTopic = info.judgeTopic;
        }
      } catch (err) {
        console.warn(
          "[SIMULATOR] Failed to fetch active judge status for my-team:",
          err.message,
        );
      }
      if (!teamPlain.judgeTopic && teamPlain.externalTeamCode) {
        teamPlain.judgeTopic = `hackathon/${teamPlain.externalTeamCode.toLowerCase()}/judge/telemetry`;
      }
    }
    teamPlain.isJudgeActive = isJudgeActive;

    // Fetch available tracks for this event
    const eventTracks = await Track.find({ eventId: team.eventId._id }).select(
      "name description maxTeams",
    );

    // Check if the current user is the leader
    const isLeader = team.leaderId.toString() === req.user._id.toString();

    res.json({
      team: teamPlain,
      members,
      repository: repo,
      tracks: eventTracks,
      isLeader,
    });
  } catch (error) {
    console.error("Fetch My Team Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi tải thông tin nhóm." });
  }
});

/**
 * @route   PUT /api/teams/:teamId/basic-info
 * @desc    Update basic team members details by Team Leader
 * @access  Private (Team Leader)
 */
router.put("/:teamId/basic-info", authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { members } = req.body;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin đội thi." });
    }

    // Auth check: Only leader can update
    if (team.leaderId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({
          message: "Chỉ trưởng nhóm mới có quyền cập nhật thông tin đội thi.",
        });
    }

    if (!Array.isArray(members)) {
      return res
        .status(400)
        .json({ message: "Danh sách thành viên không hợp lệ." });
    }

    const errors = [];
    const updatePromises = [];
    const newMembersToCreate = [];

    // Check duplicate emails in the incoming payload
    const payloadEmails = new Set();

    // Check registered emails in this event (for new members)
    const registeredTeams = await Team.find({
      eventId: team.eventId,
      status: { $in: ["confirmed", "pending_confirm"] },
    });
    const registeredTeamIds = registeredTeams.map((t) => t._id);
    const registeredMembers = await TeamMember.find({
      teamId: { $in: registeredTeamIds },
    }).populate("userId", "email");
    const registeredEmails = new Set(
      registeredMembers
        .map((m) => m.userId?.email?.toLowerCase()?.trim())
        .filter(Boolean),
    );

    // Get current members count
    const existingTeamMembers = await TeamMember.find({ teamId });
    const existingMemberUserIds = new Set(
      existingTeamMembers.map((tm) => tm.userId.toString()),
    );

    let totalProspectiveMembersCount = existingTeamMembers.length;

    for (let idx = 0; idx < members.length; idx++) {
      const m = members[idx];

      if (m.isNew) {
        const { email, fullName, githubUsername, studentId, university, height, weight } = m;
        const normEmail = String(email || "")
          .trim()
          .toLowerCase();

        if (!normEmail) {
          errors.push(`Dòng ${idx + 1}: Email của thành viên mới là bắt buộc.`);
          continue;
        }
        if (!height) {
          errors.push(`Chiều cao của thành viên không được để trống.`);
          continue;
        }
        if (!weight) {
          errors.push(`Cân nặng của thành viên không được để trống.`);
          continue;
        }
        if (isNaN(Number(height)) || isNaN(Number(weight))) {
          errors.push(`Chiều cao và cân nặng của thành viên phải là số hợp lệ.`);
          continue;
        }

        if (!fullName) {
          errors.push(
            `Dòng ${idx + 1}: Họ tên của thành viên mới là bắt buộc.`,
          );
          continue;
        }
        if (!githubUsername) {
          errors.push(
            `Dòng ${idx + 1}: GitHub Username của thành viên mới là bắt buộc.`,
          );
          continue;
        }

        if (!height) {
          errors.push(`Dòng ${idx + 1}: Chiều cao của thành viên mới là bắt buộc.`);
          continue;
        }
        if (!weight) {
          errors.push(`Dòng ${idx + 1}: Cân nặng của thành viên mới là bắt buộc.`);
          continue;
        }
        if (isNaN(Number(height)) || isNaN(Number(weight))) {
          errors.push(`Dòng ${idx + 1}: Chiều cao và cân nặng phải là số hợp lệ.`);
          continue;
        }

        if (payloadEmails.has(normEmail)) {
          errors.push(
            `Thành viên mới với email "${normEmail}" bị trùng lặp trong yêu cầu.`,
          );
          continue;
        }
        payloadEmails.add(normEmail);

        if (registeredEmails.has(normEmail)) {
          errors.push(
            `Email "${normEmail}" đã tham gia một nhóm khác trong cuộc thi này.`,
          );
          continue;
        }

        // Verify GitHub Username exists
        const githubExists =
          await githubService.checkGithubUserExists(githubUsername);
        if (!githubExists) {
          errors.push(
            `GitHub Username "${githubUsername}" của thành viên mới "${fullName}" không tồn tại trên GitHub.`,
          );
          continue;
        }

        totalProspectiveMembersCount++;
        newMembersToCreate.push({
          email: normEmail,
          fullName,
          githubUsername,
          studentId: studentId || "",
          university: university || "",
          height,
          weight
        });
      } else {
        const rawUserId = m.userId;
        const userId = rawUserId
          ? typeof rawUserId === "object"
            ? String(rawUserId._id || rawUserId)
            : String(rawUserId)
          : null;
        const { fullName, githubUsername, studentId, university, height, weight } = m;

        if (!userId) {
          errors.push(
            `Dòng ${idx + 1}: Thiếu userId của thành viên cần cập nhật.`,
          );
          continue;
        }

        if (!existingMemberUserIds.has(userId.toString())) {
          errors.push(`Người dùng với ID ${userId} không thuộc đội thi này.`);
          continue;
        }

        if (!fullName) {
          errors.push(`Họ tên của thành viên không được để trống.`);
          continue;
        }
        if (!githubUsername) {
          errors.push(`GitHub Username của thành viên không được để trống.`);
          continue;
        }

        // Verify GitHub username exists
        const githubExists =
          await githubService.checkGithubUserExists(githubUsername);
        if (!githubExists) {
          errors.push(
            `GitHub Username "${githubUsername}" của thành viên "${fullName}" không tồn tại trên GitHub.`,
          );
          continue;
        }

        updatePromises.push(async () => {
          const u = await User.findById(userId);
          if (u) {
            u.fullName = fullName;
            u.githubUsername = githubUsername;
            u.studentId = studentId || "";
            u.university = university || "";
            u.height = height != null && height !== "" ? Number(height) : u.height;
            u.weight = weight != null && weight !== "" ? Number(weight) : u.weight;
            await u.save();
          }
        });
      }
    }

    if (totalProspectiveMembersCount > 5) {
      errors.push(
        `Tổng số lượng thành viên trong đội vượt quá giới hạn (tối đa 5 người).`,
      );
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Cập nhật thất bại do dữ liệu không hợp lệ.",
        errors,
      });
    }

    // Save existing user updates
    for (const fn of updatePromises) {
      await fn();
    }

    // Invite new members
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const leaderUser = await User.findById(team.leaderId);
    const event = await Event.findById(team.eventId);
    for (const nMember of newMembersToCreate) {
      let memberUser = await User.findOne({ email: nMember.email });
      if (!memberUser) {
        const placeholderPass = crypto.randomBytes(8).toString("hex");
        memberUser = new User({
          email: nMember.email,
          passwordHash: crypto
            .createHash("sha256")
            .update(placeholderPass)
            .digest("hex"),
          fullName: nMember.fullName,
          studentId: nMember.studentId,
          githubUsername: nMember.githubUsername,
          university: nMember.university,
          height: nMember.height ? Number(nMember.height) : null,
          weight: nMember.weight ? Number(nMember.weight) : null,
          isApproved: true,
        });
        await memberUser.save();
      } else {
        if (nMember.fullName) memberUser.fullName = nMember.fullName;
        if (nMember.studentId) memberUser.studentId = nMember.studentId;
        if (nMember.githubUsername)
          memberUser.githubUsername = nMember.githubUsername;
        if (nMember.university) memberUser.university = nMember.university;
        if (nMember.height) memberUser.height = Number(nMember.height);
        if (nMember.weight) memberUser.weight = Number(nMember.weight);
        await memberUser.save();
      }

      const confirmToken = crypto.randomBytes(32).toString("hex");
      const confirmTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const teamMember = new TeamMember({
        teamId: team._id,
        eventId: team.eventId,
        userId: memberUser._id,
        role: "member",
        confirmStatus: "pending",
        confirmTokenHash: confirmToken,
        confirmTokenExpiry,
      });
      await teamMember.save();

      // Add participant EventRole
      await EventRole.findOneAndUpdate(
        { userId: memberUser._id, eventId: team.eventId, role: "participant" },
        { status: "active" },
        { upsert: true, new: true },
      );

      // Send invitation email
      const inviteLink = `${req.protocol}://${req.get("host")}/api/teams/confirm-invite?token=${confirmToken}&memberId=${teamMember._id}`;
      emailService
        .sendTeamInvitation(
          memberUser.email,
          team.name,
          inviteLink,
          leaderUser ? leaderUser.fullName : null,
          leaderUser ? leaderUser.email : null,
          event ? event.name : null,
          "member",
          event?.seminar ? {
            title: event.seminar.title,
            description: event.seminar.description,
            scheduledAt: event.seminar.scheduledAt,
            scheduledEnd: event.seminar.scheduledEnd,
            meetUrl: event.seminar.meetUrl
          } : null,
          memberUser.fullName
        )
        .catch((err) =>
          console.error(
            `[MEMBER ADD] Failed to send invitation to ${memberUser.email}:`,
            err.message,
          ),
        );
    }

    // Update team status back to pending_confirm if new pending members were added
    if (newMembersToCreate.length > 0 && team.status === "confirmed") {
      team.status = "pending_confirm";
      await team.save();
    }

    res.json({ message: "Cập nhật thông tin và thêm thành viên thành công!" });
  } catch (error) {
    console.error("Update team members basic-info error:", error.message);
    res
      .status(500)
      .json({ message: "Lỗi hệ thống khi cập nhật thông tin thành viên." });
  }
});

/**
 * @route   DELETE /api/teams/:teamId/members/:userId
 * @desc    Team leader deletes a member from their own team
 * @access  Private (Only team leader)
 */
router.delete("/:teamId/members/:userId", authenticateToken, async (req, res) => {
  const { teamId, userId } = req.params;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    // Check if the current user is the leader of the team
    if (team.leaderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Chỉ trưởng nhóm mới có quyền xóa thành viên." });
    }

    const member = await TeamMember.findOne({ teamId, userId });
    if (!member) {
      return res.status(404).json({ message: "Không tìm thấy thành viên trong đội." });
    }

    if (member.role === "leader") {
      return res.status(400).json({ message: "Không thể tự xóa chính mình (Trưởng nhóm). Vui lòng chuyển vai trò trưởng nhóm trước." });
    }

    await TeamMember.deleteOne({ _id: member._id });

    // Auto-confirm logic
    const remainingMembers = await TeamMember.find({ teamId });
    const pendingCount = remainingMembers.filter(m => m.confirmStatus === "pending").length;

    let autoApproved = false;
    if (pendingCount === 0 && remainingMembers.length > 0 && team.status === "pending_confirm") {
      await handleTeamFullConfirmation(team);
      autoApproved = true;
    }

    res.json({
      message: "Đã xóa thành viên thành công.",
      autoApproved
    });
  } catch (error) {
    console.error("Leader delete member error:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi xóa thành viên." });
  }
});

/**
 * @route   PUT /api/teams/:teamId/members/:userId/transfer-leader
 * @desc    Team leader transfers leadership to another member in the team
 * @access  Private (Only team leader)
 */
router.put("/:teamId/members/:userId/transfer-leader", authenticateToken, async (req, res) => {
  const { teamId, userId } = req.params;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    // Check if the current user is the leader of the team
    if (team.leaderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Chỉ trưởng nhóm mới có quyền chuyển vai trò trưởng nhóm." });
    }

    const member = await TeamMember.findOne({ teamId, userId });
    if (!member) {
      return res.status(404).json({ message: "Không tìm thấy thành viên trong đội." });
    }

    if (member.role === "leader") {
      return res.status(400).json({ message: "Thành viên này đã là trưởng nhóm rồi." });
    }

    // Update old leader
    const oldLeader = await TeamMember.findOne({ teamId, role: "leader" });
    if (oldLeader) {
      oldLeader.role = "member";
      await oldLeader.save();
    }

    // Promote new leader (retain existing confirmStatus without auto-confirming)
    member.role = "leader";
    await member.save();

    // Update Team document
    team.leaderId = userId;
    await team.save();

    // Check if team can be auto-confirmed
    const remainingMembers = await TeamMember.find({ teamId });
    const pendingCount = remainingMembers.filter(m => m.confirmStatus === "pending").length;

    let autoApproved = false;
    if (pendingCount === 0 && team.status === "pending_confirm") {
      await handleTeamFullConfirmation(team);
      autoApproved = true;
    }

    res.json({
      message: "Đã chuyển vai trò trưởng nhóm thành công.",
      autoApproved
    });
  } catch (error) {
    console.error("Leader transfer leadership error:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi chuyển vai trò trưởng nhóm." });
  }
});

/**
 * @route   GET /api/teams/user-lookup
 * @desc    Lookup user by email to suggest profile for registration
 * @access  Private (Authenticated users)
 */
router.get("/user-lookup", authenticateToken, async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: "Email là bắt buộc." });
  }

  try {
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("fullName studentId githubUsername university height weight");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    res.json({ user });
  } catch (error) {
    console.error("User lookup error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi tìm kiếm người dùng." });
  }
});

/**
 * @route   GET /api/teams/my-pending-invitations
 * @desc    Get pending invitations for the current user in a specific event
 * @access  Private (Authenticated Users)
 */
router.get("/my-pending-invitations", authenticateToken, async (req, res) => {
  const { eventId } = req.query;
  if (!eventId) {
    return res.status(400).json({ message: "eventId là bắt buộc." });
  }

  try {
    const pendingMembers = await TeamMember.find({
      userId: req.user._id,
      eventId,
      confirmStatus: "pending",
    }).populate({
      path: "teamId",
      select: "name leaderId",
      populate: { path: "leaderId", select: "fullName email" },
    });

    const invitations = pendingMembers.map((m) => ({
      teamName: m.teamId?.name || "Đội thi",
      leaderName: m.teamId?.leaderId?.fullName || m.teamId?.leaderId?.email || "Trưởng nhóm",
      leaderEmail: m.teamId?.leaderId?.email || "",
      invitedAt: m.createdAt,
    }));

    res.json({ invitations });
  } catch (error) {
    console.error("My pending invitations error:", error.message);
    res.status(500).json({ message: "Lỗi khi lấy danh sách lời mời." });
  }
});

/**
 * @route   GET /api/teams/import-template
 * @desc    Download Excel template for importing teams
 * @access  Private (Authenticated users)
 */
router.get("/import-template", authenticateToken, (req, res) => {
  try {
    const wb = XLSX.utils.book_new();

    const { type } = req.query;
    const isAdmin = type === 'admin';

    // Headers
    const headers = isAdmin
      ? ["STT", "MSSV", "HỌ VÀ TÊN", "TÊN ĐỘI", "MAIL", "VAI TRÒ", "TRƯỜNG"]
      : [
          "Tên Đội Ngũ *",
          "Vai Trò *",
          "Họ Tên *",
          "Email *",
          "GitHub Username *",
          "MSSV",
          "Trường Đại Học",
          "Chiều Cao (cm) *",
          "Cân Nặng (kg) *",
        ];

    const sampleRows = isAdmin
      ? [
          [1, "SE204283", "Hoàng Quang Nhân", "Những cô gái nóng bỏng", "nhanhqse204283@fpt.edu.vn", "Leader", "Trường Đại học FPT"],
          [2, "SE203583", "Đặng Nguyễn Hữu Đức", "Những cô gái nóng bỏng", "ducduchse203583@fpt.edu.vn", "Member", "Trường Đại học FPT"],
          [3, "SE181951", "Lê Vũ Phương Hoà", "Beyond8", "hoalvpse181951@fpt.edu.vn", "Leader", "Trường Đại học FPT"],
          [4, "SE180026", "Ngô Thành Đạt", "Beyond8", "datntse180026@fpt.edu.vn", "Member", "Trường Đại học FPT"],
        ]
      : [
          [
            "Đội Thi Siêu Cấp",
            "Trưởng nhóm",
            req.user.fullName || "Nguyễn Văn A",
            req.user.email,
            req.user.githubUsername || "nguyenvana-dev",
            req.user.studentId || "SE123456",
            req.user.university || "Đại học FPT",
            req.user.height || 170,
            req.user.weight || 65,
          ],
          [
            "",
            "Thành viên",
            "Trần Thị B",
            "member1@fe.edu.vn",
            "tranthib-dev",
            "SE123457",
            "Đại học FPT",
            165,
            52,
          ],
        ];

    const wsData = [headers, ...sampleRows];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Apply styling to headers
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "0F172A" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }
    }

    // Set column widths
    const cols = [];
    for (let i = 0; i < headers.length; i++) {
      cols.push({ wch: Math.max(headers[i].length + 4, 18) });
    }
    ws["!cols"] = cols;

    XLSX.utils.book_append_sheet(wb, ws, "Template");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Template_Import_Teams.xlsx",
    );
    res.send(buffer);
  } catch (error) {
    console.error("Download template error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi tải template." });
  }
});

/**
 * @route   POST /api/teams/import
 * @desc    Import teams from Excel file
 * @access  Private (Authenticated users)
 */
router.post(
  "/import",
  authenticateToken,
  upload.single("file"),
  async (req, res) => {
    const { eventId, skipEmail } = req.body;
    const shouldSkipEmail = skipEmail === true || skipEmail === "true";

    if (!eventId) {
      return res.status(400).json({ message: "eventId là bắt buộc." });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Vui lòng upload file Excel (.xlsx)." });
    }

    let createdTeamIds = [];
    try {
      // 1. Verify Event is active & open for registration
      const event = await Event.findById(eventId);
      if (!event)
        return res
          .status(404)
          .json({ message: "Không tìm thấy thông tin cuộc thi." });

      // "coordinator" is not a valid EventRole; organisers are resolved via isEventStaff.
      const isCoordinator = await isEventStaff(req.user, eventId);

      if (event.status !== "registration" && !isCoordinator) {
        return res
          .status(400)
          .json({ message: "Cuộc thi hiện không mở đăng ký." });
      }

      // 2. Parse Excel
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      if (rawData.length < 2) {
        return res
          .status(400)
          .json({ message: "File Excel trống hoặc không có dòng dữ liệu." });
      }

      const headers = rawData[0];
      const rows = rawData.slice(1);

      // Auto-detect Excel format based on header row
      // Admin format (from Google Sheets/Excel): STT(0), MSSV(1), HỌ VÀ TÊN(2), TÊN ĐỘI(3), MAIL(4), VAI TRÒ(5), TRƯỜNG(6)
      // Standard format: Tên Đội(0), Vai Trò(1), Họ Tên(2), Email(3), GitHub(4), MSSV(5), Trường(6), Chiều cao(7), Cân nặng(8)
      const headerStr = headers.map((h) => String(h).trim().toLowerCase()).join("|");
      const isAdminFormat =
        headerStr.includes("stt") &&
        (headerStr.includes("mssv") || headerStr.includes("họ và tên") || headerStr.includes("tên đội"));

      function extractRowData(row) {
        if (isAdminFormat) {
          return {
            teamName: String(row[3] || "").trim(),
            roleStr: String(row[5] || "").trim().toLowerCase(),
            fullName: String(row[2] || "").trim(),
            email: String(row[4] || "").trim().toLowerCase(),
            github: "",
            studentId: String(row[1] || "").trim(),
            university: normalizeUniversityName(String(row[6] || "").trim()),
            height: 0,
            weight: 0,
            hasHeight: false,
            hasWeight: false,
          };
        }
        const heightVal = String(row[7] ?? "").trim();
        const weightVal = String(row[8] ?? "").trim();
        return {
          teamName: String(row[0] || "").trim(),
          roleStr: String(row[1] || "").trim().toLowerCase(),
          fullName: String(row[2] || "").trim(),
          email: String(row[3] || "").trim().toLowerCase(),
          github: String(row[4] || "").trim(),
          studentId: String(row[5] || "").trim(),
          university: normalizeUniversityName(String(row[6] || "").trim()),
          height: Number(heightVal) || 0,
          weight: Number(weightVal) || 0,
          hasHeight: !!heightVal,
          hasWeight: !!weightVal,
        };
      }

      // 3. Dry Run Validation
      const errors = [];
      const teamGroups = {}; // teamName -> { leader, members: [], rowNums: [] }
      const allEmailsInSheet = new Set();

      // Check capacity limit
      const currentActiveTeamsCount = await Team.countDocuments({
        eventId,
        status: { $in: ["confirmed", "pending_confirm"] },
      });

      // Retrieve already registered emails in this event
      const registeredTeams = await Team.find({
        eventId,
        status: { $in: ["confirmed", "pending_confirm"] },
      });
      const registeredTeamIds = registeredTeams.map((t) => t._id);
      const registeredMembers = await TeamMember.find({
        teamId: { $in: registeredTeamIds },
      }).populate("userId", "email");
      const registeredEmails = new Set(
        registeredMembers
          .map((m) => m.userId?.email?.toLowerCase()?.trim())
          .filter(Boolean),
      );
      let currentTeamName = "";

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Row number in Excel sheet

        // Skip fully empty row
        if (row.every((cell) => cell === "")) continue;

        const parsed = extractRowData(row);
        let teamName = parsed.teamName;
        if (!teamName) {
          teamName = currentTeamName;
        } else {
          currentTeamName = teamName;
        }

        const {
          roleStr,
          fullName,
          email,
          github,
          studentId,
          university,
          height,
          weight,
          hasHeight,
          hasWeight,
        } = parsed;

        if (!teamName) {
          errors.push(`Dòng ${rowNum}: Tên Đội Ngũ là bắt buộc.`);
          continue;
        }
        if (!roleStr) {
          errors.push(
            `Dòng ${rowNum}: Vai Trò là bắt buộc (nhập "Trưởng nhóm" hoặc "Thành viên").`,
          );
          continue;
        }
        if (!fullName) {
          errors.push(`Dòng ${rowNum}: Họ Tên là bắt buộc.`);
          continue;
        }
        if (!email) {
          errors.push(`Dòng ${rowNum}: Email là bắt buộc.`);
          continue;
        }
        if (!EMAIL_PATTERN.test(email)) {
          errors.push(`Dòng ${rowNum}: Email "${email}" không hợp lệ.`);
          continue;
        }

        // GitHub validation: only mandatory for non-admin standard format
        if (!isAdminFormat && !github) {
          errors.push(`Dòng ${rowNum}: GitHub Username là bắt buộc.`);
          continue;
        }

        // Height & Weight validation: only mandatory for non-admin standard format
        if (!isAdminFormat) {
          if (!hasHeight) {
            errors.push(`Dòng ${rowNum}: Chiều Cao là bắt buộc.`);
            continue;
          }
          if (!Number.isFinite(height) || height <= 0) {
            errors.push(`Dòng ${rowNum}: Chiều Cao phải là một số dương.`);
            continue;
          }
          if (!hasWeight) {
            errors.push(`Dòng ${rowNum}: Cân Nặng là bắt buộc.`);
            continue;
          }
          if (!Number.isFinite(weight) || weight <= 0) {
            errors.push(`Dòng ${rowNum}: Cân Nặng phải là một số dương.`);
            continue;
          }
        }

        // Check if username exists on GitHub (if provided)
        if (github) {
          const userExists = await githubService.checkGithubUserExists(github);
          if (!userExists) {
            errors.push(
              `Dòng ${rowNum}: GitHub Username "${github}" không tồn tại trên GitHub.`,
            );
          }
        }

        const isLeader =
          roleStr.includes("trưởng") || roleStr.includes("leader");

        // Check email duplicate in sheet
        if (allEmailsInSheet.has(email)) {
          errors.push(
            `Dòng ${rowNum}: Email "${email}" bị trùng lặp trong file Excel.`,
          );
        }
        allEmailsInSheet.add(email);

        // Check email duplicate in DB
        if (registeredEmails.has(email)) {
          errors.push(
            `Dòng ${rowNum}: Email "${email}" đã tham gia nhóm khác trong cuộc thi này.`,
          );
        }

        // Group by teamName, case-insensitively: "Beyond8" and "beyond8" are the same team
        const groupKey = teamName.toLowerCase();
        if (!teamGroups[groupKey]) {
          teamGroups[groupKey] = {
            displayName: teamName,
            leader: null,
            members: [],
            rowNums: [],
          };
        }
        teamName = teamGroups[groupKey].displayName;

        const memberInfo = {
          email,
          fullName,
          githubUsername: github || undefined,
          studentId,
          university,
          height: height || undefined,
          weight: weight || undefined,
          rowNum,
        };

        teamGroups[groupKey].rowNums.push(rowNum);

        if (isLeader) {
          if (teamGroups[groupKey].leader) {
            errors.push(
              `Dòng ${rowNum}: Đội "${teamName}" đã có Trưởng nhóm ở dòng ${teamGroups[groupKey].leader.rowNum}. Mỗi đội chỉ được phép có 1 trưởng nhóm.`,
            );
          } else {
            teamGroups[groupKey].leader = memberInfo;
          }
        } else {
          teamGroups[groupKey].members.push(memberInfo);
        }
      }

      const teamKeys = Object.keys(teamGroups);

      // Limit regular users to 1 team
      if (!isCoordinator && teamKeys.length > 1) {
        return res
          .status(403)
          .json({
            message:
              "Thí sinh chỉ được phép import đăng ký cho đúng 1 đội thi của mình.",
          });
      }

      const prospectiveTeamsCount = currentActiveTeamsCount + teamKeys.length;
      if (event.maxTeams && prospectiveTeamsCount > event.maxTeams) {
        errors.push(
          `Tổng số lượng đội thi sau khi import (${prospectiveTeamsCount}) vượt quá giới hạn tối đa của cuộc thi (${event.maxTeams}).`,
        );
      }

      for (const teamKey of teamKeys) {
        const group = teamGroups[teamKey];
        const teamName = group.displayName;

        // 1. Verify leader exists
        if (!group.leader) {
          errors.push(
            `Đội "${teamName}": Thiếu thông tin Trưởng nhóm (phải có ít nhất 1 dòng khai báo vai trò "Trưởng nhóm").`,
          );
          continue;
        }

        // Security check for regular users
        if (
          !isCoordinator &&
          group.leader.email !== req.user.email.toLowerCase()
        ) {
          errors.push(
            `Đội "${teamName}": Email Trưởng Nhóm (${group.leader.email}) phải trùng khớp với email tài khoản đăng nhập của bạn (${req.user.email}).`,
          );
        }

        // Check unique name in DB
        const existingTeam = await Team.findOne({
          eventId,
          name: { $regex: new RegExp(`^${escapeRegex(teamName)}$`, "i") },
        });
        if (existingTeam) {
          errors.push(
            `Đội "${teamName}": Tên nhóm đã tồn tại trong cuộc thi này.`,
          );
        }

        // Check member count (e.g. max 4 members plus 1 leader = 5 members total)
        // Teams have 3–5 people including the leader
        const teamSize = group.members.length + 1;
        if (teamSize > MAX_TEAM_SIZE) {
          errors.push(
            `Đội "${teamName}": Có ${teamSize} người, vượt quá giới hạn ${MAX_TEAM_SIZE} người (kể cả Trưởng nhóm).`,
          );
        }

        if (teamSize < MIN_TEAM_SIZE) {
          errors.push(`Đội "${teamName}": Có ${teamSize} người, chưa đủ tối thiểu ${MIN_TEAM_SIZE} người (kể cả Trưởng nhóm).`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          message: "Import không thành công do lỗi dữ liệu.",
          errors,
        });
      }

      // 4. Save to Database
      const importedTeams = [];
      const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

      for (const teamKey of teamKeys) {
        const group = teamGroups[teamKey];
        const teamName = group.displayName;
        const { leader, members } = group;

        // Register or update Leader User
        let leaderUser = await User.findOne({ email: leader.email });
        if (!leaderUser) {
          const placeholderPass = crypto.randomBytes(8).toString("hex");
          leaderUser = new User({
            email: leader.email,
            passwordHash: crypto
              .createHash("sha256")
              .update(placeholderPass)
              .digest("hex"),
            fullName: leader.fullName,
            studentId: leader.studentId,
            githubUsername: leader.githubUsername,
            university: leader.university,
            height: leader.height,
            weight: leader.weight,
            isApproved: true,
          });
          await leaderUser.save();
        } else {
          if (leader.fullName) leaderUser.fullName = leader.fullName;
          if (leader.studentId) leaderUser.studentId = leader.studentId;
          if (leader.githubUsername)
            leaderUser.githubUsername = leader.githubUsername;
          if (leader.university) leaderUser.university = leader.university;
          if (leader.height) leaderUser.height = leader.height;
          if (leader.weight) leaderUser.weight = leader.weight;
          await leaderUser.save();
        }

        // Create Team
        const team = new Team({
          eventId,
          leaderId: leaderUser._id,
          name: teamName,
          status: "pending_confirm",
        });
        await team.save();
        createdTeamIds.push(team._id);

        // Create Leader TeamMember
        const leaderConfirmToken = crypto.randomBytes(32).toString("hex");
        // Same 7-day validity whether invitations go out now or later via send-import-invitations
        const expiryDays = 7;
        const leaderConfirmTokenExpiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

        const leaderMember = new TeamMember({
          teamId: team._id,
          eventId: team.eventId,
          userId: leaderUser._id,
          role: "leader",
          confirmStatus: shouldSkipEmail ? "pending" : "confirmed",
          confirmTokenHash: leaderConfirmToken,
          confirmTokenExpiry: leaderConfirmTokenExpiry,
          confirmedAt: shouldSkipEmail ? undefined : new Date(),
          invitationEmailSent: !shouldSkipEmail,
        });
        await leaderMember.save();

        // Add participant EventRole for Leader
        await EventRole.findOneAndUpdate(
          { userId: leaderUser._id, eventId, role: "participant" },
          { status: "active" },
          { upsert: true, new: true },
        );

        // Send email to Leader if immediate sending is enabled and imported by admin
        if (!shouldSkipEmail && isCoordinator) {
          const event = await Event.findById(eventId);
          const leaderInviteLink = `${req.protocol}://${req.get("host")}/api/teams/confirm-invite?token=${leaderConfirmToken}&memberId=${leaderMember._id}`;
          emailService
            .sendTeamInvitation(
              leaderUser.email,
              teamName,
              leaderInviteLink,
              leaderUser.fullName,
              leaderUser.email,
              event ? event.name : null,
              "leader",
              event?.seminar ? {
                title: event.seminar.title,
                description: event.seminar.description,
                scheduledAt: event.seminar.scheduledAt,
                scheduledEnd: event.seminar.scheduledEnd,
                meetUrl: event.seminar.meetUrl
              } : null,
              leaderUser.fullName
            )
            .catch((err) =>
              console.error(
                `[IMPORT] Failed to send invitation to leader ${leaderUser.email}:`,
                err.message,
              ),
            );
        }

        // Invite other members
        for (const mData of members) {
          let memberUser = await User.findOne({ email: mData.email });
          if (!memberUser) {
            const placeholderPass = crypto.randomBytes(8).toString("hex");
            memberUser = new User({
              email: mData.email,
              passwordHash: crypto
                .createHash("sha256")
                .update(placeholderPass)
                .digest("hex"),
              fullName: mData.fullName,
              studentId: mData.studentId,
              githubUsername: mData.githubUsername,
              university: mData.university,
              height: mData.height,
              weight: mData.weight,
              isApproved: true,
            });
            await memberUser.save();
          } else {
            if (mData.fullName) memberUser.fullName = mData.fullName;
            if (mData.studentId) memberUser.studentId = mData.studentId;
            if (mData.githubUsername)
              memberUser.githubUsername = mData.githubUsername;
            if (mData.university) memberUser.university = mData.university;
            if (mData.height) memberUser.height = mData.height;
            if (mData.weight) memberUser.weight = mData.weight;
            await memberUser.save();
          }

          const confirmToken = crypto.randomBytes(32).toString("hex");
          // If skipEmail is requested by admin, extend validity to 7 days
          const confirmTokenExpiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

          const teamMember = new TeamMember({
            teamId: team._id,
            eventId,
            userId: memberUser._id,
            role: "member",
            confirmStatus: "pending",
            confirmTokenHash: confirmToken,
            confirmTokenExpiry,
            invitationEmailSent: !shouldSkipEmail,
          });
          await teamMember.save();

          // Add participant EventRole for Member
          await EventRole.findOneAndUpdate(
            { userId: memberUser._id, eventId, role: "participant" },
            { status: "active" },
            { upsert: true, new: true },
          );

          // Send Email Invitation only if not skipped
          if (!shouldSkipEmail) {
            const event = await Event.findById(eventId);
            const inviteLink = `${req.protocol}://${req.get("host")}/api/teams/confirm-invite?token=${confirmToken}&memberId=${teamMember._id}`;
            emailService
              .sendTeamInvitation(
                memberUser.email,
                teamName,
                inviteLink,
                leaderUser ? leaderUser.fullName : null,
                leaderUser ? leaderUser.email : null,
                event ? event.name : null,
                "member",
                event?.seminar ? {
                  title: event.seminar.title,
                  description: event.seminar.description,
                  scheduledAt: event.seminar.scheduledAt,
                  scheduledEnd: event.seminar.scheduledEnd,
                  meetUrl: event.seminar.meetUrl
                } : null,
                memberUser.fullName
              )
              .catch((err) =>
                console.error(
                  `[IMPORT] Failed to send invitation to ${memberUser.email}:`,
                  err.message,
                ),
              );
          }
        }

        // If registered with no additional members and not pending, auto confirm team
        const pendingCount = await TeamMember.countDocuments({
          teamId: team._id,
          confirmStatus: "pending",
        });
        if (pendingCount === 0) {
          team.status = "confirmed";
          await team.save();
        }

        importedTeams.push(team);
      }

      const importedTeamIds = importedTeams.map((t) => t._id);
      const pendingMemberCount = await TeamMember.countDocuments({
        teamId: { $in: importedTeamIds },
        confirmStatus: "pending",
        invitationEmailSent: false,
      });

      res.json({
        message: `Đã import thành công ${importedTeams.length} đội thi!`,
        count: importedTeams.length,
        teamIds: importedTeamIds,
        memberCount: pendingMemberCount,
      });
    } catch (error) {
      console.error("Import teams error:", error.message);
      if (createdTeamIds.length > 0) {
        try {
          console.log(
            `[ROLLBACK] Cleaning up ${createdTeamIds.length} teams due to import error...`,
          );
          const Team = mongoose.model("Team");
          const TeamMember = mongoose.model("TeamMember");
          await Team.deleteMany({ _id: { $in: createdTeamIds } });
          await TeamMember.deleteMany({ teamId: { $in: createdTeamIds } });
        } catch (rollbackError) {
          console.error(
            "[ROLLBACK ERROR] Failed to clean up imported teams:",
            rollbackError.message,
          );
        }
      }
      res
        .status(500)
        .json({ message: "Lỗi hệ thống khi import danh sách đội thi." });
    }
  },
);

/**
 * @route   GET /api/teams/validate-github/:username
 * @desc    Kiểm tra GitHub username có tồn tại không
 * @access  Public
 */
router.get("/validate-github/:username", async (req, res) => {
  try {
    const { username } = req.params;
    if (!username || !username.trim()) {
      return res.status(400).json({ exists: false, message: "Username là bắt buộc." });
    }
    const exists = await githubService.checkGithubUserExists(username.trim());
    res.json({ exists, username: username.trim() });
  } catch (error) {
    console.error("Validate GitHub username error:", error.message);
    res.status(500).json({ exists: false, message: "Lỗi hệ thống khi kiểm tra GitHub." });
  }
});

/**
 * @route   POST /api/teams/send-import-invitations
 * @desc    Gửi email mời cho tất cả thí sinh (Leader & Member) chưa gửi email
 * @access  Private (Coordinator / System Admin)
 */
router.post("/send-import-invitations", authenticateToken, async (req, res) => {
  try {
    const { teamIds, eventId } = req.body;
    if (!Array.isArray(teamIds) || teamIds.length === 0) {
      return res.status(400).json({ message: "Danh sách teamIds là bắt buộc." });
    }
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Sự kiện không hợp lệ." });
    }

    // Must be an organiser of THIS event (previously any event's role was accepted).
    if (!(await isEventStaff(req.user, eventId))) {
      return res.status(403).json({ message: "Không có quyền thực hiện chức năng này." });
    }

    const query = {
      eventId,
      teamId: { $in: teamIds },
      confirmStatus: "pending",
      invitationEmailSent: false,
    };

    const pendingMembers = await TeamMember.find(query).populate("userId", "email fullName");

    if (pendingMembers.length === 0) {
      return res.json({ sent: 0, failed: 0, total: 0, message: "Không có thành viên nào cần gửi email." });
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < pendingMembers.length; i++) {
      const member = pendingMembers[i];
      try {
        member.confirmTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await member.save();

        const team = await Team.findById(member.teamId).populate("leaderId", "fullName email");
        const event = await Event.findById(team?.eventId);
        const inviteLink = `${req.protocol}://${req.get("host")}/api/teams/confirm-invite?token=${member.confirmTokenHash}&memberId=${member._id}`;
        if (isQueueAvailable()) {
          await addEmailJobWithDelay(
            {
              type: "team_invite",
              email: member.userId.email,
              teamName: team?.name,
              inviteLink,
              leaderName: team?.leaderId?.fullName || null,
              leaderEmail: team?.leaderId?.email || null,
              eventName: event?.name || null,
              role: member.role,
              seminar: event?.seminar ? {
                title: event.seminar.title,
                description: event.seminar.description,
                scheduledAt: event.seminar.scheduledAt,
                scheduledEnd: event.seminar.scheduledEnd,
                meetUrl: event.seminar.meetUrl
              } : null,
              fullName: member.userId.fullName,
            },
            i * 700,
          );
        } else {
          if (i > 0) await new Promise((r) => setTimeout(r, 500));
          await emailService.sendTeamInvitation(
            member.userId.email,
            team?.name,
            inviteLink,
            team?.leaderId?.fullName || null,
            team?.leaderId?.email || null,
            event?.name || null,
            member.role,
            event?.seminar ? {
              title: event.seminar.title,
              description: event.seminar.description,
              scheduledAt: event.seminar.scheduledAt,
              scheduledEnd: event.seminar.scheduledEnd,
              meetUrl: event.seminar.meetUrl
            } : null,
            member.userId.fullName
          );
        }

        member.invitationEmailSent = true;
        await member.save();
        sent++;
      } catch (err) {
        console.error(`[SEND-INVITATIONS] Failed for ${member.userId?.email}:`, err.message);
        failed++;
      }
    }

    res.json({
      sent,
      failed,
      total: pendingMembers.length,
      message: `Đã gửi ${sent} email mời thành công!`,
    });
  } catch (error) {
    console.error("Send import invitations error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi gửi email mời." });
  }
});

/**
 * @route   POST /api/teams/send-member-invitations
 * @desc    Send or resend invitation emails to selected pending contestants
 * @access  Private (Coordinator / System Admin)
 */
router.post("/send-member-invitations", authenticateToken, async (req, res) => {
  try {
    const { eventId, memberIds } = req.body;
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: "Sự kiện không hợp lệ." });
    }

    if (!(await isEventStaff(req.user, eventId))) {
      return res.status(403).json({ message: "Không có quyền gửi email lời mời." });
    }

    if (!isQueueAvailable()) {
      return res.status(503).json({
        message: "Hàng đợi email chưa sẵn sàng. Vui lòng kiểm tra kết nối Redis rồi thử lại.",
      });
    }

    const query = {
      eventId,
      confirmStatus: "pending",
      invitationEmailStatus: { $nin: ["queued", "sending"] },
    };
    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const validMemberIds = memberIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validMemberIds.length === 0) {
        return res.status(400).json({ message: "Danh sách thí sinh không hợp lệ." });
      }
      query._id = { $in: validMemberIds };
    } else {
      query.invitationEmailSent = false;
    }

    const members = await TeamMember.find(query).populate("userId", "email fullName");
    let queued = 0;
    const failures = [];

    for (let index = 0; index < members.length; index++) {
      const member = members[index];
      try {
        if (!member.userId?.email) throw new Error("Thí sinh chưa có địa chỉ email");
        if (!member.confirmTokenHash || !member.confirmTokenExpiry || member.confirmTokenExpiry < new Date()) {
          member.confirmTokenHash = crypto.randomBytes(32).toString("hex");
          member.confirmTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }

        const team = await Team.findById(member.teamId).populate("leaderId", "fullName email");
        if (!team) throw new Error("Không tìm thấy đội thi");
        const event = await Event.findById(eventId);
        const inviteLink = `${req.protocol}://${req.get("host")}/api/teams/confirm-invite?token=${member.confirmTokenHash}&memberId=${member._id}`;

        const nextAttempt = (member.invitationEmailAttempts || 0) + 1;
        const jobId = `team-invite-${member._id}-${nextAttempt}`;
        member.invitationEmailStatus = "queued";
        member.invitationEmailJobId = jobId;
        member.invitationEmailLastError = undefined;
        await member.save();

        const job = await addEmailJobWithDelay(
          {
            type: "team_invite",
            teamMemberId: member._id.toString(),
            email: member.userId.email,
            teamName: team.name,
            inviteLink,
            leaderName: team.leaderId?.fullName || null,
            leaderEmail: team.leaderId?.email || null,
            eventName: event?.name || null,
            role: member.role,
            seminar: event?.seminar || null,
            fullName: member.userId.fullName,
          },
          index * 100,
          { jobId },
        );
        if (!job) throw new Error("Không thể thêm email vào hàng đợi");
        queued++;
      } catch (error) {
        member.invitationEmailSent = false;
        member.invitationEmailStatus = "failed";
        member.invitationEmailLastError = error.message;
        await member.save().catch(() => {});
        failures.push({ memberId: member._id, email: member.userId?.email || "", message: error.message });
      }
    }

    res.json({
      queued,
      sent: 0,
      failed: failures.length,
      total: members.length,
      failures,
      message: failures.length
        ? `Đã đưa ${queued}/${members.length} email vào hàng đợi. Có ${failures.length} email chưa thể xếp hàng.`
        : `Đã đưa ${queued} email vào hàng đợi an toàn.`,
    });
  } catch (error) {
    console.error("Send Member Invitations Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi gửi email lời mời." });
  }
});

/**
 * @route   GET /api/teams/my-team/exam-access
 * @desc    Trả về link Google Drive đề bài cho thành viên đội đã xác nhận.
 *          Link Drive phải được admin set "Anyone with the link" — không cần OAuth cấp quyền.
 * @access  Private (Confirmed team member)
 */
router.get("/my-team/exam-access", authenticateToken, async (req, res) => {
  try {
    const memberRecord = await TeamMember.findOne({
      userId: req.user._id,
      confirmStatus: "confirmed",
    });

    if (!memberRecord) {
      return res
        .status(403)
        .json({
          message:
            "Bạn cần là thành viên đã xác nhận của đội để truy cập đề bài.",
        });
    }

    const team = await Team.findById(memberRecord.teamId).populate(
      "trackId",
      "roundId name examDriveFileId examDriveFileUrl examDriveFileName isExamManualOpen",
    );
    if (!team || team.status !== "confirmed") {
      return res
        .status(403)
        .json({ message: "Đội của bạn chưa được xác nhận hoàn tất." });
    }

    const trackId = team.trackId?._id;
    if (!trackId) {
      return res.status(404).json({ message: "Đội chưa được gán bảng đấu." });
    }

    // ── Ưu tiên: kiểm tra link đề riêng của bảng (per-track) ──
    const trackAccess = await canUserAccessTrackExam(req.user._id, trackId);
    if (trackAccess.ok) {
      // Có link per-track → trả về luôn
      return res.json({ accessUrl: trackAccess.accessUrl, source: "track" });
    }

    // Nếu bảng chưa có link riêng → fallback sang round-level (backward compat)
    if (trackAccess.reason === "no_material") {
      const roundId = team.trackId?.roundId;
      if (!roundId) {
        return res
          .status(404)
          .json({ message: "Đội chưa được gán vòng thi / bảng đấu." });
      }
      const access = await canUserAccessRoundExam(req.user._id, roundId);
      if (!access.ok) {
        return res
          .status(403)
          .json({ message: access.message, reason: access.reason });
      }
      return res.json({ accessUrl: access.accessUrl, source: "round" });
    }

    // Bảng có link nhưng chưa mở
    const access = trackAccess;
    if (!access.ok) {
      return res
        .status(403)
        .json({ message: access.message, reason: access.reason });
    }

    // Trả về link Drive trực tiếp — thí sinh click vào là mở được ngay
    const accessUrl = access.accessUrl;

    res.json({
      fileName: access.round.driveFileName,
      accessUrl,
      roundName: access.round.name,
      message: "Đề bài đã sẵn sàng. Nhấn vào link để mở Google Drive.",
    });
  } catch (error) {
    console.error("Exam Access Error:", error.message);
    res
      .status(500)
      .json({ message: "Lỗi khi mở đề bài.", detail: error.message });
  }
});

/**
 * @route   POST /api/teams/submit-topic
 * @desc    Submit project topic details (Team Leader only)
 * @access  Private (Team Leader)
 */
router.post("/submit-topic", authenticateToken, async (req, res) => {
  const { teamId, title, description, documentationLink } = req.body;

  if (!teamId || !title) {
    return res
      .status(400)
      .json({ message: "ID nhóm và tên đề tài là bắt buộc." });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: "Không tìm thấy nhóm." });

    // Validate that user is the leader
    if (team.leaderId.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({
          message: "Chỉ trưởng nhóm mới có quyền nộp thông tin đề tài.",
        });
    }

    team.topicSubmission = {
      title,
      description,
      documentationLink,
      submittedAt: new Date(),
      updatedAt: new Date(),
    };

    await team.save();
    res.json({
      message: "Đã lưu chi tiết đề tài và đường dẫn thành công!",
      submission: team.topicSubmission,
    });
  } catch (error) {
    console.error("Submit Topic Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi lưu bài nộp." });
  }
});

/**
 * @route   GET /api/teams/all
 * @desc    Get all teams in an event
 * @access  Private (Coordinator or Admin)
 */
router.get("/all/:eventId", authenticateToken, async (req, res) => {
  try {
    const Event = mongoose.model("Event");
    const event = await Event.findById(req.params.eventId);
    if (event && event.isArchived) {
      // Allow only System Admin or Coordinator
      let authorized = req.user.isSystemAdmin;
      if (!authorized) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: event._id,
          role: { $in: ["coordinator", "admin_view", "student_assistant"] },
          status: "active",
        });
        authorized = !!coordRole;
      }
      if (!authorized) {
        return res
          .status(403)
          .json({
            message: "Sự kiện này đã bị ẩn. Bạn không có quyền truy cập.",
          });
      }
    }

    let query = { eventId: req.params.eventId };

    if (!req.user.isSystemAdmin) {
      const roundId = req.query.roundId;
      const roleQuery = req.query.role;
      let userRole = null;

      if (roundId) {
        const criteria = {
          userId: req.user._id,
          eventId: req.params.eventId,
          roundId: roundId,
          status: "active",
        };
        if (roleQuery) {
          criteria.role = roleQuery;
        }
        userRole = await EventRole.findOne(criteria);
      }

      if (!userRole) {
        const criteria = {
          userId: req.user._id,
          eventId: req.params.eventId,
          status: "active",
        };
        if (roleQuery) {
          criteria.role = roleQuery;
        }
        userRole = await EventRole.findOne(criteria);
      }

      if (userRole && userRole.role === "mentor") {
        const activeRound = await Round.findOne({
          eventId: req.params.eventId,
          status: "active",
        });

        const mentorRoles = await EventRole.find({
          userId: req.user._id,
          eventId: req.params.eventId,
          role: "mentor",
          status: "active",
        });

        const activeRoundMentorRoles = [];
        if (activeRound) {
          for (const role of mentorRoles) {
            if (role.trackId) {
              const track = await Track.findById(role.trackId);
              if (
                track &&
                track.roundId.toString() === activeRound._id.toString()
              ) {
                activeRoundMentorRoles.push(role);
              }
            } else {
              activeRoundMentorRoles.push(role);
            }
          }
        } else {
          activeRoundMentorRoles.push(...mentorRoles);
        }

        if (activeRound && activeRoundMentorRoles.length === 0) {
          return res
            .status(403)
            .json({
              message: "Bạn không được phân công cố vấn ở vòng thi này.",
            });
        }

        const trackIds = activeRoundMentorRoles
          .map((r) => r.trackId)
          .filter((id) => id !== null && id !== undefined);

        if (trackIds.length > 0) {
          query.trackId = { $in: trackIds };
        } else {
          query.mentorId = req.user._id;
        }
      } else if (userRole && userRole.role === "judge") {
        const roundId = req.query.roundId;

        // 1. Resolve effective round (use active round if not queried)
        let effectiveRoundId = roundId;
        if (
          !effectiveRoundId ||
          !mongoose.Types.ObjectId.isValid(effectiveRoundId)
        ) {
          const activeRound = await Round.findOne({
            eventId: req.params.eventId,
            status: "active",
          });
          if (activeRound) {
            effectiveRoundId = activeRound._id;
          }
        }

        // 2. Fetch all active judge roles for this user and event
        const judgeRoles = await EventRole.find({
          userId: req.user._id,
          eventId: req.params.eventId,
          role: "judge",
          status: "active",
        });

        // 3. Find the role assigned to the track of the effective round
        let assignedRole = null;
        if (
          effectiveRoundId &&
          mongoose.Types.ObjectId.isValid(effectiveRoundId)
        ) {
          const TrackModel = mongoose.model("Track");
          const roundTracks = await TrackModel.find({
            roundId: effectiveRoundId,
          });
          const roundTrackIds = roundTracks.map((t) => t._id.toString());
          assignedRole = judgeRoles.find(
            (role) =>
              role.trackId && roundTrackIds.includes(role.trackId.toString()),
          );
        }

        // 4. Fallback: if no role is matched for the effective round, take the first role with a trackId
        if (!assignedRole) {
          assignedRole = judgeRoles.find((role) => role.trackId);
        }

        let isFinalRound = false;
        if (
          effectiveRoundId &&
          mongoose.Types.ObjectId.isValid(effectiveRoundId)
        ) {
          const RoundModel = mongoose.model("Round");
          const roundObj = await RoundModel.findById(effectiveRoundId);
          if (
            roundObj &&
            (roundObj.name.toLowerCase().includes("chung kết") ||
              roundObj.advanceTopN === 0)
          ) {
            isFinalRound = true;
          }
        }

        if (isFinalRound) {
          // Judges can see all teams in the final round, don't restrict to track
        } else {
          if (effectiveRoundId) {
            const roundDoc = await Round.findById(effectiveRoundId);
            if (roundDoc && roundDoc.status === "completed") {
              // Hide all teams from judges if the round is already locked/completed
              return res.json([]);
            }
          }

          const trackIdToUse = assignedRole
            ? assignedRole.trackId
            : userRole.trackId;

          if (trackIdToUse) {
            const track = await Track.findById(trackIdToUse);
            if (
              track &&
              effectiveRoundId &&
              track.roundId.toString() !== effectiveRoundId.toString()
            ) {
              // Queried/active round does not match the judge's assigned track's round
              return res.json([]);
            }
            query.trackId = trackIdToUse;
          } else {
            return res.json([]);
          }
        }
      } else if (!userRole) {
        let msg = "Bạn không có quyền truy cập thông tin cuộc thi này.";
        if (roleQuery === "mentor") {
          msg = "Bạn không được phân công cố vấn ở cuộc thi này.";
        } else if (roleQuery === "judge") {
          msg = "Bạn không được phân công chấm điểm ở cuộc thi này.";
        }
        return res.status(403).json({ message: msg });
      }
    }

    // Kiểm tra xem người dùng có phải là Admin hoặc Ban tổ chức (Coordinator) không
    let isCoordinator = req.user.isSystemAdmin;
    if (!isCoordinator) {
      const coordRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: req.params.eventId,
        role: { $in: ["coordinator", "admin_view", "student_assistant"] },
        status: "active",
      });
      isCoordinator = !!coordRole;
    }

    // Support historical and current track/round query matching
    const Ranking = mongoose.model("Ranking");
    let effectiveRoundIdForRanking = req.query.roundId;
    if (!effectiveRoundIdForRanking) {
      const activeRound = await Round.findOne({
        eventId: req.params.eventId,
        status: "active",
      });
      if (activeRound) {
        effectiveRoundIdForRanking = activeRound._id;
      }
    }

    let teamIdsFromRankings = [];
    if (query.trackId) {
      const rankings = await Ranking.find({ trackId: query.trackId });
      teamIdsFromRankings = rankings.map((r) => r.teamId);
    } else if (effectiveRoundIdForRanking) {
      const rankings = await Ranking.find({
        roundId: effectiveRoundIdForRanking,
      });
      teamIdsFromRankings = rankings.map((r) => r.teamId);
    }

    let finalQuery = { ...query };
    const isFilterRequested = !!req.query.roundId || !!req.query.trackId;

    // Chỉ áp dụng bộ lọc giới hạn vòng đấu/bảng đấu nếu người dùng KHÔNG phải Admin/BTC,
    // HOẶC nếu họ chủ động truyền tham số bộ lọc (roundId/trackId) từ giao diện.
    if (isFilterRequested || !isCoordinator) {
      if (query.trackId) {
        delete finalQuery.trackId;
        finalQuery.$or = [
          { trackId: query.trackId },
          { _id: { $in: teamIdsFromRankings } },
        ];
      } else if (effectiveRoundIdForRanking) {
        const TrackModel = mongoose.model("Track");
        const roundTracks = await TrackModel.find({
          roundId: effectiveRoundIdForRanking,
        });
        const roundTrackIds = roundTracks.map((t) => t._id);

        finalQuery.$or = [
          { currentRoundId: effectiveRoundIdForRanking },
          { trackId: { $in: roundTrackIds } },
          { _id: { $in: teamIdsFromRankings } },
        ];
      }
    }

    const teams = await Team.find(finalQuery)
      .populate("trackId", "name topicName topicLink")
      .populate("originalTrackId", "name topicName topicLink")
      .populate("currentRoundId", "name order status")
      .populate("leaderId", "fullName email")
      .populate("mentorId", "fullName email");

    const Commit = mongoose.models.Commit || mongoose.model("Commit");
    const teamIds = teams.map((t) => t._id);
    const commitCountsAgg = await Commit.aggregate([
      {
        $match: {
          teamId: { $in: teamIds },
          message: { $not: /initial commit/i },
        },
      },
      {
        $group: {
          _id: "$teamId",
          count: { $sum: 1 },
        },
      },
    ]);
    const commitCountMap = {};
    commitCountsAgg.forEach((item) => {
      commitCountMap[item._id.toString()] = item.count;
    });

    const detailedTeams = await Promise.all(
      teams.map(async (t) => {
        const members = await TeamMember.find({ teamId: t._id }).populate(
          "userId",
          "fullName email studentId university githubUsername confirmStatus",
        );
        const repo = await GithubRepository.findOne({ teamId: t._id });
        const rankings = await Ranking.find({ teamId: t._id }).lean();
        const obj = t.toObject();
        if (t.originalTrackId) {
          obj.originalTrackName = t.originalTrackId.name;
        }
        return {
          ...obj,
          members,
          repository: repo,
          commitCount: commitCountMap[t._id.toString()] || 0,
          rankings: rankings || [],
        };
      }),
    );

    res.json(detailedTeams);
  } catch (error) {
    console.error("Get All Teams Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi tải danh sách nhóm." });
  }
});

/**
 * @route   GET /api/teams/:teamId
 * @desc    Get team by ID with event, members, and repository details
 * @access  Private (Coordinator, Judge, or Admin)
 */
router.get("/:teamId", authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate({
        path: "trackId",
        select:
          "name description roundId attachments environmentId examDriveFileId examDriveFileUrl examDriveFileName isExamManualOpen",
        populate: {
          path: "roundId",
          select:
            "name driveFileName driveFileId driveFileUrl startTime advanceTopN",
        },
      })
      .populate({
        path: "originalTrackId",
        select: "name description environmentId topicName topicLink",
      })
      .populate("leaderId", "fullName email")
      .populate("eventId", "name status isArchived");

    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    // Block non-coordinators/non-admins if event is archived
    if (team.eventId && team.eventId.isArchived) {
      let authorized = req.user.isSystemAdmin;
      if (!authorized) {
        const coordRole = await EventRole.findOne({
          userId: req.user._id,
          eventId: team.eventId._id,
          role: { $in: ["coordinator", "admin_view", "student_assistant"] },
          status: "active",
        });
        authorized = !!coordRole;
      }
      if (!authorized) {
        return res
          .status(403)
          .json({
            message:
              "Sự kiện của đội thi này đã bị ẩn. Bạn không có quyền truy cập.",
          });
      }
    }

    // Verify track permissions for judges/mentors
    if (!req.user.isSystemAdmin) {
      const userRoles = await EventRole.find({
        userId: req.user._id,
        eventId: team.eventId,
        status: "active",
      });

      if (userRoles.length === 0) {
        return res
          .status(403)
          .json({
            message: "Bạn không có quyền truy cập thông tin của đội thi này.",
          });
      }

      const activeRound = await Round.findOne({
        eventId: team.eventId,
        status: "active",
      });
      let isAuthorized = false;

      for (const roleObj of userRoles) {
        if (roleObj.role === "coordinator" || roleObj.role === "admin_view" || roleObj.role === "student_assistant") {
          isAuthorized = true;
          break;
        }

        if (roleObj.role === "judge") {
          if (roleObj.trackId && activeRound) {
            const track = await Track.findById(roleObj.trackId);
            if (
              track &&
              track.roundId.toString() !== activeRound._id.toString()
            ) {
              continue; // Skip role if it belongs to a different round
            }
          }

          let isFinalRound = false;
          if (team.trackId && team.trackId.roundId) {
            const r = team.trackId.roundId;
            if (
              r.name.toLowerCase().includes("chung kết") ||
              r.advanceTopN === 0
            ) {
              isFinalRound = true;
            }
          }
          if (isFinalRound) {
            isAuthorized = true;
            break;
          }
          if (
            roleObj.trackId &&
            team.trackId &&
            roleObj.trackId.toString() === team.trackId._id.toString()
          ) {
            isAuthorized = true;
            break;
          }
        }

        if (roleObj.role === "mentor") {
          if (roleObj.trackId && activeRound) {
            const track = await Track.findById(roleObj.trackId);
            if (
              track &&
              track.roundId.toString() !== activeRound._id.toString()
            ) {
              continue; // Skip role if it belongs to a different round
            }
          }

          const isTeamMentor =
            team.mentorId &&
            team.mentorId.toString() === req.user._id.toString();
          const isTrackMatch =
            roleObj.trackId &&
            team.trackId &&
            roleObj.trackId.toString() === team.trackId._id.toString();
          if (isTeamMentor || isTrackMatch) {
            isAuthorized = true;
            break;
          }
        }
      }

      if (!isAuthorized) {
        return res
          .status(403)
          .json({
            message:
              "Bạn không có quyền truy cập thông tin của đội thi thuộc bảng đấu khác.",
          });
      }
    }

    const members = await TeamMember.find({ teamId: team._id }).populate(
      "userId",
      "fullName email studentId university githubUsername confirmStatus",
    );

    const repo = await GithubRepository.findOne({ teamId: team._id });

    const teamPlain = team.toObject();

    if (teamPlain.trackId && teamPlain.trackId.roundId) {
      const r = teamPlain.trackId.roundId;
      teamPlain.trackId.roundId = {
        ...r,
        hasExamMaterial: !!(r.driveFileId || r.driveFileUrl),
      };
    }

    // Fetch environment code and active judge status if team has external code
    if (team.externalTeamCode) {
      const {
        getJudgeActive,
        getEnvironment,
      } = require("./externalTeamService");

      let isJudgeActive = false;
      let currentScenario = "NORMAL";
      try {
        const activeInfo = await getJudgeActive();
        const info = Array.isArray(activeInfo)
          ? activeInfo.find((item) => item.teamCode === team.externalTeamCode)
          : activeInfo && activeInfo.teamCode === team.externalTeamCode
            ? activeInfo
            : null;
        if (info) {
          isJudgeActive = true;
          currentScenario = info.scenario;
        }
      } catch (err) {
        console.warn(
          "[SIMULATOR] Failed to fetch active judge status:",
          err.message,
        );
      }
      teamPlain.isJudgeActive = isJudgeActive;
      teamPlain.currentScenario = currentScenario;

      const targetEnvId =
        (team.originalTrackId && team.originalTrackId.environmentId) ||
        (team.trackId && team.trackId.environmentId);

      if (targetEnvId) {
        try {
          const envInfo = await getEnvironment(targetEnvId);
          teamPlain.environmentCode = envInfo.code;
        } catch (err) {
          console.warn(
            "[SIMULATOR] Failed to fetch environment code:",
            err.message,
          );
        }
      }

      if (!teamPlain.environmentCode && info && (info.environment || info.environmentCode)) {
        teamPlain.environmentCode = info.environment || info.environmentCode;
      }
    }

    const Commit = mongoose.models.Commit || mongoose.model("Commit");
    const commitCount = await Commit.countDocuments({
      teamId: team._id,
      message: { $not: /initial commit/i },
    });

    const responseData = {
      ...teamPlain,
      members,
      repository: repo,
      commitCount: commitCount || 0,
    };

    res.json({
      ...responseData,
      team: responseData,
    });
  } catch (error) {
    console.error("Get Team By ID Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi tải thông tin nhóm." });
  }
});

/**
 * @route   PUT /api/teams/:teamId/assign-track
 * @desc    Assign a team to a track (specific or random) and provision GitHub Repo
 * @access  Private (Coordinator or Admin)
 */
router.put("/:teamId/assign-track", authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { trackId } = req.body; // can be a trackId or 'random'

  try {
    const team = await Team.findById(teamId);
    if (!team)
      return res.status(404).json({ message: "Không tìm thấy đội thi." });

    // Auth check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ["coordinator", "student_assistant"] },
        status: "active",
      });
      if (!coordinatorRole)
        return res
          .status(403)
          .json({
            message:
              "Không có quyền truy cập. Yêu cầu vai trò Điều phối viên hoặc Quản trị viên.",
          });
    }

    let targetTrackId = trackId;

    if (trackId === "random") {
      const tracks = await Track.find({ eventId: team.eventId });
      if (tracks.length === 0) {
        return res
          .status(400)
          .json({
            message:
              "Sự kiện chưa có bảng đấu nào. Vui lòng tạo bảng đấu trước.",
          });
      }
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      targetTrackId = randomTrack._id;
    }

    const track = await Track.findById(targetTrackId);
    if (!track)
      return res.status(404).json({ message: "Bảng đấu không tồn tại." });

    team.trackId = track._id;
    await team.save();

    // Sync team to external simulator if confirmed
    if (team.status === "confirmed") {
      try {
        await syncTeamToExternalSimulator(team);
      } catch (syncErr) {
        console.error("[ASSIGN TRACK] Simulator sync failed:", syncErr.message);
      }
    }

    // Create the team's GitHub repo in the background, or move the existing one to this track
    provisionTeamRepository(team, { trackId: track._id })
      .then(({ created }) => {
        if (created) {
          console.log(
            `[ASSIGN TRACK] Provisioned GitHub repo and added collaborators for team: ${team.name}`,
          );
        }
      })
      .catch((gitErr) => {
        console.error(
          `[ASSIGN TRACK] Error provisioning GitHub repo for team ${team.name}:`,
          gitErr.message,
        );
      });

    // Create EventLog
    const EventLog = mongoose.model("EventLog");
    const newLog = new EventLog({
      eventId: team.eventId,
      actorId: req.user._id,
      action: "assign_team_track",
      type: "operation",
      details: `Phân đội ${team.name} vào bảng đấu ${track.name}`,
    });
    await newLog.save();

    // Also ensure chat room is created if mentor exists
    await ensureChatRoomForTeam(team);

    res.json({
      message: `Đã phân đội ${team.name} vào bảng đấu ${track.name} thành công.`,
      team,
    });
  } catch (error) {
    console.error("Assign Track Error:", error.message);
    res.status(500).json({ message: "Server error during track assignment." });
  }
});

/**
 * @route   GET /api/teams/:teamId
 * @desc    Get details of a single team by ID
 * @access  Private
 */
router.get("/:teamId", authenticateToken, async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId)
      .populate(
        "eventId",
        "name semester year status contestEnd registrationClose",
      )
      .populate({
        path: "trackId",
        select: "name description roundId",
        populate: {
          path: "roundId",
          select: "name driveFileName driveFileId startTime",
        },
      })
      .populate("mentorId", "fullName email");

    if (!team) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy thông tin đội thi." });
    }

    const members = await TeamMember.find({ teamId: team._id }).populate(
      "userId",
      "fullName email studentId githubUsername avatarUrl",
    );

    const repo = await GithubRepository.findOne({ teamId: team._id });

    const teamObj = team.toObject();
    if (teamObj.trackId?.roundId) {
      const r = teamObj.trackId.roundId;
      teamObj.trackId.roundId = {
        _id: r._id,
        name: r.name,
        driveFileName: r.driveFileName,
        hasExamMaterial: !!r.driveFileId,
        startTime: r.startTime,
      };
    }

    res.json({
      team: teamObj,
      members,
      repository: repo,
    });
  } catch (error) {
    console.error("Fetch Single Team Error:", error.message);
    res
      .status(500)
      .json({ message: "Lỗi hệ thống khi tải thông tin chi tiết nhóm." });
  }
});

/**
 * @route   PUT /api/teams/:teamId/assign-mentor
 * @desc    Assign a mentor to a specific team and ensure their chat room is created
 * @access  Private (Coordinator or Admin)
 */
router.put("/:teamId/assign-mentor", authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { mentorId } = req.body; // Can be a User ID or null/empty to unassign

  try {
    const team = await Team.findById(teamId);
    if (!team)
      return res.status(404).json({ message: "Không tìm thấy đội thi." });

    // Auth check
    if (!req.user.isSystemAdmin) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ["coordinator", "student_assistant"] },
        status: "active",
      });
      if (!coordinatorRole) {
        return res
          .status(403)
          .json({
            message:
              "Không có quyền truy cập. Yêu cầu vai trò Điều phối viên hoặc Quản trị viên.",
          });
      }
    }

    // If mentorId is provided, verify they are actually registered as a mentor for this track/event
    if (mentorId) {
      const User = mongoose.model("User");
      const mentor = await User.findById(mentorId);
      if (!mentor)
        return res.status(404).json({ message: "Mentor không tồn tại." });

      const mentorRole = await EventRole.findOne({
        userId: mentorId,
        eventId: team.eventId,
        role: "mentor",
        status: "active",
      });
      if (!mentorRole) {
        return res
          .status(400)
          .json({
            message:
              "Người dùng được chọn không phải là Mentor của sự kiện này.",
          });
      }

      // Check if this mentor is already assigned to another team in this event
      const alreadyMentoring = await Team.findOne({
        eventId: team.eventId,
        mentorId: mentorId,
      });
      if (
        alreadyMentoring &&
        alreadyMentoring._id.toString() !== teamId.toString()
      ) {
        return res
          .status(400)
          .json({
            message: `Mentor này đã được phân công quản lý một đội thi khác (${alreadyMentoring.name}) trong cuộc thi.`,
          });
      }
    }

    team.mentorId = mentorId || undefined;
    await team.save();

    // If a mentor is assigned, ensure the chat room is created for them and this team
    if (mentorId) {
      const { ensureChatRoomForTeam } = require("../chat/chatRoomService");
      await ensureChatRoomForTeam(team);
    }

    // Create EventLog
    const EventLog = mongoose.model("EventLog");
    let logDetailsMsg = "";
    if (mentorId) {
      const User = mongoose.model("User");
      const mentorObj = await User.findById(mentorId);
      const mentorName = mentorObj ? mentorObj.fullName : mentorId;
      logDetailsMsg = `Gán Mentor "${mentorName}" cho đội thi "${team.name}"`;
    } else {
      logDetailsMsg = `Hủy gán Mentor của đội thi "${team.name}"`;
    }
    const newLog = new EventLog({
      eventId: team.eventId,
      actorId: req.user._id,
      action: mentorId ? "assign_team_mentor" : "unassign_team_mentor",
      type: "operation",
      details: logDetailsMsg,
    });
    await newLog.save();

    res.json({
      message: mentorId
        ? "Đã gán Mentor cho đội thi thành công."
        : "Đã hủy gán Mentor cho đội thi.",
      team,
    });
  } catch (error) {
    console.error("Assign Mentor Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi phân công Mentor." });
  }
});

/**
 * @route   POST /api/teams/:teamId/sync-mqtt
 * @desc    Manually sync MQTT credentials for a team
 * @access  Private (Admin, Coordinator, or Team Leader)
 */
router.post("/:teamId/sync-mqtt", authenticateToken, async (req, res) => {
  const { teamId } = req.params;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    // Auth check: System Admin, Coordinator of the event, or the team leader themselves
    let hasAccess =
      req.user.isSystemAdmin ||
      team.leaderId.toString() === req.user._id.toString();
    if (!hasAccess) {
      const coordinatorRole = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ["coordinator", "student_assistant"] },
        status: "active",
      });
      if (coordinatorRole) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện hành động này." });
    }

    // Check if track and environmentId are present
    const targetTrackId = team.originalTrackId || team.trackId;
    if (!targetTrackId) {
      return res
        .status(400)
        .json({ message: "Đội thi chưa được phân vào bảng đấu." });
    }

    const track = await Track.findById(targetTrackId);
    if (!track || !track.environmentId) {
      return res
        .status(400)
        .json({
          message: "Bảng đấu của đội thi chưa được cấu hình Environment ID.",
        });
    }

    const forceReRegister = req.body?.forceReRegister || req.query?.forceReRegister === "true";

    // If already registered on external system and not forcing re-register, fetch latest credentials using code
    if (team.externalTeamCode && !forceReRegister) {
      try {
        const { fetchExternalKeys } = require("./externalTeamService");
        const result = await fetchExternalKeys(team.externalTeamCode);

        team.testApiKey = result.testApiKey || team.testApiKey || "";
        team.judgeApiKey = result.judgeApiKey || team.judgeApiKey || "";
        team.mqttUsername = result.mqttUsername || team.mqttUsername || "";
        team.mqttPassword = result.mqttPassword || team.mqttPassword || "";
        team.testTopic =
          result.testTopic ||
          team.testTopic ||
          `hackathon/${team.externalTeamCode.toLowerCase()}/test/telemetry`;
        team.judgeTopic =
          result.judgeTopic ||
          team.judgeTopic ||
          `hackathon/${team.externalTeamCode.toLowerCase()}/judge/telemetry`;
        await team.save();

        return res.json({
          message: "Đồng bộ khóa MQTT thành công từ hệ thống simulator!",
          team,
        });
      } catch (err) {
        console.error(
          "[MQTT SERVICE] fetch keys error during manual sync:",
          err.message,
        );
        return res.status(502).json({
          message: `Không thể đồng bộ khóa từ simulator: ${err.message}`,
        });
      }
    } else {
      // Not registered yet or forcing re-register with current track environmentId
      let baseCode = generateTeamCode(team.name);
      if (!baseCode) {
        baseCode = `TEAM_${team._id.toString().substring(18).toUpperCase()}`;
      }

      let code = forceReRegister && team.externalTeamCode
        ? `${baseCode}_${crypto.randomBytes(2).toString("hex").toUpperCase()}`
        : baseCode;
      let syncSuccess = false;
      let result = null;
      let attempts = 0;

      while (!syncSuccess && attempts < 5) {
        try {
          attempts++;
          const { createExternalTeam } = require("./externalTeamService");
          result = await createExternalTeam(
            code,
            team.name,
            track.environmentId,
          );
          syncSuccess = true;
        } catch (err) {
          if (err.code === "TEAM_CODE_EXISTS" && attempts < 5) {
            const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
            code = `${baseCode}_${suffix}`;
          } else {
            console.error(
              "[MQTT SERVICE] create team error during manual sync:",
              err.message,
            );
            return res.status(err.status || 500).json({
              message: `Lỗi kết nối simulator: ${err.message}`,
            });
          }
        }
      }

      if (result) {
        team.externalTeamId = result.team?.id || "";
        team.externalTeamCode = code;
        team.accessCode = result.accessCode || "";
        team.testApiKey = result.testApiKey || "";
        team.judgeApiKey = result.judgeApiKey || "";
        team.mqttUsername = result.mqttUsername || "";
        team.mqttPassword = result.mqttPassword || "";
        team.testTopic = `hackathon/${code.toLowerCase()}/test/telemetry`;
        team.judgeTopic = `hackathon/${code.toLowerCase()}/judge/telemetry`;
        await team.save();

        return res.json({
          message:
            "Đăng ký và khởi tạo khóa MQTT thành công từ hệ thống simulator!",
          team,
        });
      }
    }
  } catch (error) {
    console.error("Manual Sync Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi đồng bộ khóa MQTT." });
  }
});

/**
 * @route   POST /api/teams/track/:trackId/re-register-mqtt
 * @desc    Re-register all teams in a track with current track environmentId
 * @access  Private (System Admin or Coordinator)
 */
router.post("/track/:trackId/re-register-mqtt", authenticateToken, async (req, res) => {
  const { trackId } = req.params;

  try {
    const track = await Track.findById(trackId);
    if (!track || !track.environmentId) {
      return res
        .status(400)
        .json({ message: "Bảng đấu chưa được cấu hình Environment ID." });
    }

    const coordinatorRole = await EventRole.findOne({
      userId: req.user._id,
      eventId: track.eventId,
      role: { $in: ["coordinator", "student_assistant"] },
      status: "active",
    });

    if (!req.user.isSystemAdmin && !coordinatorRole) {
      return res.status(403).json({ message: "Bạn không có quyền thực hiện." });
    }

    const teams = await Team.find({
      $or: [{ trackId: track._id }, { originalTrackId: track._id }],
    });

    const { createExternalTeam } = require("./externalTeamService");
    let successCount = 0;
    let failedCount = 0;

    for (const team of teams) {
      let baseCode = generateTeamCode(team.name) || `TEAM_${team._id.toString().substring(18).toUpperCase()}`;
      let code = `${baseCode}_${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
      let syncSuccess = false;
      let attempts = 0;

      while (!syncSuccess && attempts < 5) {
        try {
          attempts++;
          const result = await createExternalTeam(code, team.name, track.environmentId);
          if (result) {
            team.externalTeamId = result.team?.id || "";
            team.externalTeamCode = code;
            team.accessCode = result.accessCode || "";
            team.testApiKey = result.testApiKey || "";
            team.judgeApiKey = result.judgeApiKey || "";
            team.mqttUsername = result.mqttUsername || "";
            team.mqttPassword = result.mqttPassword || "";
            team.testTopic = `hackathon/${code.toLowerCase()}/test/telemetry`;
            team.judgeTopic = `hackathon/${code.toLowerCase()}/judge/telemetry`;
            await team.save();
            syncSuccess = true;
            successCount++;
          }
        } catch (err) {
          if (err.code === "TEAM_CODE_EXISTS" && attempts < 5) {
            const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
            code = `${baseCode}_${suffix}`;
          } else {
            console.error(`Re-register team ${team.name} failed:`, err.message);
            failedCount++;
            break;
          }
        }
      }
    }

    return res.json({
      message: `Đã đăng ký lại MQTT cho ${successCount}/${teams.length} đội trong bảng đấu ${track.name}.`,
      successCount,
      failedCount,
      total: teams.length,
    });
  } catch (error) {
    console.error("Re-register Track MQTT Error:", error.message);
    res.status(500).json({ message: "Lỗi hệ thống khi đăng ký lại MQTT cho bảng đấu." });
  }
});

/**
 * @route   PATCH /api/teams/:teamId/judge
 * @desc    Toggle active status of the judge environment for a team
 * @access  Private (System Admin or Event Judge/Coordinator)
 */
router.patch("/:teamId/judge", authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { active } = req.body;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    if (!team.externalTeamId) {
      return res
        .status(400)
        .json({ message: "Đội thi chưa được đồng bộ với hệ thống Simulator." });
    }

    // Auth check: System Admin, or Event Coordinator/Judge
    let hasAccess = req.user.isSystemAdmin;
    if (!hasAccess) {
      const role = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ["coordinator", "judge"] },
        status: "active",
      });
      if (role) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện hành động này." });
    }

    const { toggleJudgeActive } = require("./externalTeamService");
    await toggleJudgeActive(team.externalTeamId, active);

    // Emit real-time status change to team members and live room
    try {
      const socketModule = require("../chat/socket");
      const io = socketModule.getIO();

      // Emit to live room (for judges/admins)
      io.to(`live:${team.eventId}`).emit("judge_active_toggled", {
        teamId: team._id.toString(),
        isJudgeActive: active,
        judgeApiKey: active ? team.judgeApiKey : null,
        judgeTopic: active ? team.judgeTopic : null,
      });

      // Emit to each team member
      const TeamMember = mongoose.model("TeamMember");
      const members = await TeamMember.find({ teamId: team._id });
      for (const member of members) {
        if (member.userId) {
          io.to(`user:${member.userId.toString()}`).emit(
            "judge_active_toggled",
            {
              teamId: team._id.toString(),
              isJudgeActive: active,
              judgeApiKey: active ? team.judgeApiKey : null,
              judgeTopic: active ? team.judgeTopic : null,
            },
          );
        }
      }

      // If we activated this team, notify other teams in the same track that they are deactivated
      if (active) {
        const otherTeams = await Team.find({
          trackId: team.trackId,
          _id: { $ne: team._id },
        });
        for (const other of otherTeams) {
          io.to(`live:${team.eventId}`).emit("judge_active_toggled", {
            teamId: other._id.toString(),
            isJudgeActive: false,
            judgeApiKey: null,
            judgeTopic: null,
          });

          // Also notify team members of other teams
          const otherMembers = await TeamMember.find({ teamId: other._id });
          for (const member of otherMembers) {
            if (member.userId) {
              io.to(`user:${member.userId.toString()}`).emit(
                "judge_active_toggled",
                {
                  teamId: other._id.toString(),
                  isJudgeActive: false,
                  judgeApiKey: null,
                  judgeTopic: null,
                },
              );
            }
          }
        }
      }
    } catch (socketErr) {
      console.warn(
        "Socket emit judge_active_toggled failed:",
        socketErr.message,
      );
    }

    res.json({
      message: active
        ? "Đã bật môi trường chấm thi."
        : "Đã tắt môi trường chấm thi.",
    });
  } catch (error) {
    console.error("Toggle Judge Active Error:", error.message);
    res
      .status(error.status || 500)
      .json({ message: `Lỗi kết nối simulator: ${error.message}` });
  }
});

/**
 * @route   PATCH /api/teams/:teamId/judge-scenario
 * @desc    Update judge scenario for a team
 * @access  Private (System Admin or Event Judge/Coordinator)
 */
router.patch("/:teamId/judge-scenario", authenticateToken, async (req, res) => {
  const { teamId } = req.params;
  const { scenario } = req.body;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    if (!team.externalTeamId) {
      return res
        .status(400)
        .json({ message: "Đội thi chưa được đồng bộ với hệ thống Simulator." });
    }

    // Auth check: System Admin, or Event Coordinator/Judge
    let hasAccess = req.user.isSystemAdmin;
    if (!hasAccess) {
      const role = await EventRole.findOne({
        userId: req.user._id,
        eventId: team.eventId,
        role: { $in: ["coordinator", "judge"] },
        status: "active",
      });
      if (role) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res
        .status(403)
        .json({ message: "Bạn không có quyền thực hiện hành động này." });
    }

    const { updateJudgeScenario } = require("./externalTeamService");
    await updateJudgeScenario(team.externalTeamId, scenario);

    res.json({ message: "Đã cập nhật kịch bản chấm thi." });
  } catch (error) {
    console.error("Update Judge Scenario Error:", error.message);
    res
      .status(error.status || 500)
      .json({ message: `Lỗi kết nối simulator: ${error.message}` });
  }
});

/**
 * @route   GET /api/teams/judge/scenarios
 * @desc    Get all judge scenarios
 * @access  Private (System Admin or Event Judge/Coordinator)
 */
router.get("/judge/scenarios", authenticateToken, async (req, res) => {
  try {
    const { getJudgeScenarios } = require("./externalTeamService");
    const result = await getJudgeScenarios();
    res.json(result);
  } catch (error) {
    console.error("Get Judge Scenarios Error:", error.message);
    res
      .status(error.status || 500)
      .json({ message: `Lỗi kết nối simulator: ${error.message}` });
  }
});

/**
 * @route   GET /api/teams/judge/live
 * @desc    Get live sensors data
 * @access  Private (System Admin or Event Judge/Coordinator)
 */
router.get("/judge/live", authenticateToken, async (req, res) => {
  const { teamId } = req.query;
  if (!teamId) {
    return res.status(400).json({ message: "Thiếu tham số teamId." });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team || !team.externalTeamId) {
      return res
        .status(404)
        .json({ message: "Đội thi chưa được đồng bộ hoặc không tồn tại." });
    }

    const { getJudgeLive } = require("./externalTeamService");
    const result = await getJudgeLive(team.externalTeamId);
    res.json(result);
  } catch (error) {
    console.error("Get Judge Live Error:", error.message);
    res
      .status(error.status || 500)
      .json({ message: `Lỗi kết nối simulator: ${error.message}` });
  }
});

/**
 * @route   DELETE /api/teams/:teamId
 * @desc    Delete a team (only team leader can delete)
 * @access  Private
 */
router.delete("/:teamId", authenticateToken, async (req, res) => {
  const { teamId } = req.params;

  try {
    const Team = mongoose.model("Team");
    const TeamMember = mongoose.model("TeamMember");
    const GithubRepository = mongoose.model("GithubRepository");

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    // Check if the user is the leader of the team
    const memberRecord = await TeamMember.findOne({
      teamId,
      userId: req.user._id,
      role: "leader",
    });

    if (!memberRecord) {
      return res
        .status(403)
        .json({ message: "Chỉ có trưởng nhóm mới có quyền xóa đội thi." });
    }

    // Delete related records
    await Team.deleteOne({ _id: teamId });
    await TeamMember.deleteMany({ teamId });
    await GithubRepository.deleteMany({ teamId });

    res.json({ message: "Xóa đội thi thành công." });
  } catch (error) {
    console.error("Delete Team Error:", error);
    res.status(500).json({ message: "Xóa đội thi thất bại." });
  }
});

/**
 * @route   POST /api/teams/:teamId/admin/members
 * @desc    Admin add a member to the team (by email or studentId)
 * @access  Private (Admin or CTSV)
 */
router.post("/:teamId/admin/members", authenticateToken, async (req, res) => {
  if (!req.user.isSystemAdmin && !req.user.isStudentAssistant) {
    return res.status(403).json({ message: "Không có quyền thực hiện." });
  }

  const { teamId } = req.params;
  const { value } = req.body;

  if (!value) {
    return res.status(400).json({ message: "Thiếu thông tin người dùng (Email hoặc MSSV)." });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    const cleanVal = value.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: cleanVal },
        { studentId: { $regex: new RegExp(`^${escapeRegex(cleanVal)}$`, "i") } }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    // Check if user is already in this team
    const existingInTeam = await TeamMember.findOne({ teamId, userId: user._id });
    if (existingInTeam) {
      return res.status(400).json({ message: "Thành viên này đã có trong đội thi." });
    }

    // Check if user is already in another team for this event
    const existingInEvent = await TeamMember.findOne({
      eventId: team.eventId,
      userId: user._id,
      confirmStatus: { $in: ["pending", "confirmed"] }
    });
    if (existingInEvent) {
      return res.status(400).json({ message: "Thành viên này đã tham gia đội thi khác trong cùng cuộc thi." });
    }

    // Create confirmation token
    const confirmToken = crypto.randomBytes(32).toString("hex");
    const confirmTokenHash = crypto.createHash("sha256").update(confirmToken).digest("hex");
    const confirmTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const newMember = new TeamMember({
      teamId: team._id,
      eventId: team.eventId,
      userId: user._id,
      role: "member",
      confirmStatus: "pending",
      confirmTokenHash,
      confirmTokenExpiry,
      invitedAt: new Date(),
    });
    await newMember.save();

    // Send invitation email
    const inviteLink = `${req.protocol}://${req.get("host")}/api/teams/confirm-invite?token=${confirmToken}&memberId=${newMember._id}`;
    
    // Get event and seminar information for email
    const event = await Event.findById(team.eventId);
    
    try {
      const emailService = require("../notifications/emailService");
      await emailService.sendTeamInvitation(
        user.email,
        team.name,
        inviteLink,
        null,
        null,
        event ? event.name : null,
        "member",
        event?.seminar ? {
          title: event.seminar.title,
          description: event.seminar.description,
          scheduledAt: event.seminar.scheduledAt,
          scheduledEnd: event.seminar.scheduledEnd,
          meetUrl: event.seminar.meetUrl
        } : null,
        user.fullName
      );
    } catch (mailErr) {
      console.error("Lỗi gửi mail mời thành viên:", mailErr.message);
    }

    const populated = await TeamMember.findById(newMember._id).populate(
      "userId",
      "fullName email studentId university githubUsername"
    );

    res.json({
      message: "Đã thêm và gửi thư mời cho thành viên thành công.",
      member: populated
    });
  } catch (error) {
    console.error("Admin add member error:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi thêm thành viên." });
  }
});

/**
 * @route   DELETE /api/teams/:teamId/admin
 * @desc    Admin permanently deletes a team and its associated records from DB
 * @access  Private (Admin, CTSV, or Event Coordinator)
 */
router.delete("/:teamId/admin", authenticateToken, async (req, res) => {
  const { teamId } = req.params;

  try {
    const Team = mongoose.model("Team");
    const TeamMember = mongoose.model("TeamMember");
    const GithubRepository = mongoose.model("GithubRepository");

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    let isAuthorized = req.user.isSystemAdmin || req.user.isStudentAssistant;
    if (!isAuthorized) {
      const EventRole = mongoose.model("EventRole");
      const coordinatorRole = await EventRole.findOne({
        eventId: team.eventId,
        userId: req.user._id,
        role: { $in: ["admin_view", "student_assistant"] },
        status: "active"
      });
      if (coordinatorRole) isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: "Không có quyền xóa đội thi." });
    }

    // Clean up all related records
    await TeamMember.deleteMany({ teamId });
    await GithubRepository.deleteMany({ teamId });

    if (mongoose.models.ChatRoom) {
      await mongoose.model("ChatRoom").deleteMany({ teamId });
    }
    if (mongoose.models.Commit) {
      await mongoose.model("Commit").deleteMany({ teamId });
    }
    if (mongoose.models.CommitFile) {
      await mongoose.model("CommitFile").deleteMany({ teamId });
    }
    if (mongoose.models.AiAnalysis) {
      await mongoose.model("AiAnalysis").deleteMany({ teamId });
    }
    if (mongoose.models.RepositorySnapshot) {
      await mongoose.model("RepositorySnapshot").deleteMany({ teamId });
    }
    if (mongoose.models.Task) {
      await mongoose.model("Task").deleteMany({ teamId });
    }
    if (mongoose.models.Score) {
      await mongoose.model("Score").deleteMany({ teamId });
    }
    if (mongoose.models.Ranking) {
      await mongoose.model("Ranking").deleteMany({ teamId });
    }

    // Delete the team document
    await Team.deleteOne({ _id: teamId });

    if (mongoose.models.EventLog) {
      const EventLog = mongoose.model("EventLog");
      await new EventLog({
        eventId: team.eventId,
        userId: req.user._id,
        action: "delete_team",
        type: "admin",
        details: `Admin/Coordinator đã xóa vĩnh viễn đội thi "${team.name}" (ID: ${teamId}) khỏi hệ thống.`
      }).save().catch(() => {});
    }

    console.log(`[ADMIN DELETE TEAM] Permanently deleted team "${team.name}" (ID: ${teamId})`);

    res.json({ message: `Đã xóa vĩnh viễn đội thi "${team.name}" thành công!` });
  } catch (error) {
    console.error("Admin Delete Team Error:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi xóa đội thi." });
  }
});

/**
 * @route   DELETE /api/teams/:teamId/admin/members/:userId
 * @desc    Admin delete a member from a team
 * @access  Private (Admin or CTSV)
 */
router.delete("/:teamId/admin/members/:userId", authenticateToken, async (req, res) => {
  if (!req.user.isSystemAdmin && !req.user.isStudentAssistant) {
    return res.status(403).json({ message: "Không có quyền thực hiện." });
  }

  const { teamId, userId } = req.params;

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    const member = await TeamMember.findOne({ teamId, userId });
    if (!member) {
      return res.status(404).json({ message: "Không tìm thấy thành viên trong đội." });
    }

    if (member.role === "leader") {
      return res.status(400).json({ message: "Không thể xóa trưởng nhóm. Hãy bổ nhiệm thành viên khác làm trưởng nhóm trước khi xóa." });
    }

    await TeamMember.deleteOne({ _id: member._id });

    // Check if the team status needs to be promoted
    const remainingMembers = await TeamMember.find({ teamId });
    const pendingCount = remainingMembers.filter(m => m.confirmStatus === "pending").length;

    console.log(`[ADMIN DELETE MEMBER] teamId: ${teamId}, remainingMembers: ${remainingMembers.length}, pendingCount: ${pendingCount}, team.status: ${team?.status}`);

    let autoApproved = false;
    if (pendingCount === 0 && remainingMembers.length > 0 && team.status === "pending_confirm") {
      console.log(`[ADMIN DELETE MEMBER] Auto-approving team: ${team.name}`);
      await handleTeamFullConfirmation(team);
      autoApproved = true;
    }

    res.json({
      message: "Đã xóa thành viên thành công.",
      autoApproved
    });
  } catch (error) {
    console.error("Admin delete member error:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi xóa thành viên." });
  }
});

/**
 * @route   PUT /api/teams/:teamId/admin/members/:userId/role
 * @desc    Admin change a member's role (promote to leader)
 * @access  Private (Admin or CTSV)
 */
router.put("/:teamId/admin/members/:userId/role", authenticateToken, async (req, res) => {
  if (!req.user.isSystemAdmin && !req.user.isStudentAssistant) {
    return res.status(403).json({ message: "Không có quyền thực hiện." });
  }

  const { teamId, userId } = req.params;
  const { role } = req.body;

  if (role !== "leader" && role !== "member") {
    return res.status(400).json({ message: "Vai trò không hợp lệ." });
  }

  try {
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Không tìm thấy đội thi." });
    }

    const member = await TeamMember.findOne({ teamId, userId });
    if (!member) {
      return res.status(404).json({ message: "Không tìm thấy thành viên trong đội." });
    }

    if (role === "leader") {
      // Find the old leader
      const oldLeader = await TeamMember.findOne({ teamId, role: "leader" });
      if (oldLeader) {
        oldLeader.role = "member";
        await oldLeader.save();
      }

      // Promote new leader (retain existing confirmStatus without auto-confirming)
      member.role = "leader";
      await member.save();

      // Update Team document
      team.leaderId = userId;
      await team.save();

      // Check if team can be auto-confirmed
      const remainingMembers = await TeamMember.find({ teamId });
      const pendingCount = remainingMembers.filter(m => m.confirmStatus === "pending").length;

      let autoApproved = false;
      if (pendingCount === 0 && team.status === "pending_confirm") {
        await handleTeamFullConfirmation(team);
        autoApproved = true;
      }

      return res.json({
        message: "Đã thay đổi trưởng nhóm thành công.",
        autoApproved
      });
    } else {
      if (member.role === "leader") {
        return res.status(400).json({ message: "Không thể giáng chức trưởng nhóm trực tiếp. Hãy bổ nhiệm thành viên khác làm trưởng nhóm." });
      }
      return res.json({ message: "Thành viên đã ở vai trò này." });
    }
  } catch (error) {
    console.error("Admin change role error:", error);
    res.status(500).json({ message: "Lỗi hệ thống khi thay đổi vai trò." });
  }
});

module.exports = router;
