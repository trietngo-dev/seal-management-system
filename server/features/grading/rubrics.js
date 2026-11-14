const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const multer = require("multer");
const XLSX = require("xlsx-js-style");
const fs = require("fs");
const path = require("path");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ chấp nhận file Excel (.xlsx, .xls)"), false);
    }
  },
});

const Rubric = mongoose.model("Rubric");
const Criterion = mongoose.model("Criterion");
const Round = mongoose.model("Round");
const Track = mongoose.model("Track");
const EventRole = mongoose.model("EventRole");
const { authenticateToken } = require("../auth/authMiddleware");
const { isEventStaff } = require("../teams/teamAccess");
const { rubricScopeFilter, findActiveRubric } = require("./rubricResolver");

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// Rubrics decide how every team is scored, so only organisers may change them.
async function canManageRubric(req, eventId) {
  return isEventStaff(req.user, eventId);
}

async function loadRubricOr404(rubricId, res) {
  const rubric = await Rubric.findById(rubricId);
  if (!rubric) {
    res.status(404).json({ message: "Rubric not found." });
    return null;
  }
  return rubric;
}

async function getCriteriaSum(rubricId) {
  const criteria = await Criterion.find({ rubricId });
  return criteria.reduce(
    (sum, criterion) => sum + Number(criterion.weight || 0),
    0,
  );
}

function styleWorksheet(ws, headerRowsCount = 2) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);

  // Expand range to 100 rows (index 99) and 9 columns (index 8) to allow editing
  range.e.r = Math.max(range.e.r, 99);
  range.e.c = Math.max(range.e.c, 8);
  ws['!ref'] = XLSX.utils.encode_range(range);

  for (let r = range.s.r; r <= range.e.r; ++r) {
    for (let c = range.s.c; c <= range.e.c; ++c) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (!ws[cellRef]) {
        ws[cellRef] = { t: 's', v: '' };
      }

      const cell = ws[cellRef];
      const isHeader = r < headerRowsCount;

      cell.s = {
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        },
        alignment: {
          vertical: 'center',
          horizontal: isHeader || c === 2 ? 'center' : 'left',
          wrapText: true
        }
      };

      if (isHeader) {
        cell.s.font = { bold: true, name: 'Calibri' };
        cell.s.fill = {
          patternType: 'solid',
          fgColor: { rgb: 'EAEAEA' }
        };
      } else {
        cell.s.font = { name: 'Calibri' };
      }
    }
  }
}

/**
 * GET /api/rubrics
 * Query: eventId, trackId, roundId, isActive
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const filter = {};
    if (req.query.eventId) filter.eventId = req.query.eventId;
    if (req.query.trackId) filter.trackId = req.query.trackId;
    if (req.query.roundId) filter.roundId = req.query.roundId;
    if (req.query.isActive !== undefined)
      filter.isActive = req.query.isActive === "true";

    const rubrics = await Rubric.find(filter).sort({ createdAt: -1 });
    res.json(rubrics);
  } catch (error) {
    console.error("List Rubrics Error:", error.message);
    res.status(500).json({ message: "Server error retrieving rubrics." });
  }
});

/**
 * POST /api/rubrics
 * Tạo rubric cho một round
 */
router.post("/", authenticateToken, async (req, res) => {
  const {
    eventId,
    trackId,
    roundId,
    name,
    description,
    totalWeight,
    maxCriterionScore,
  } = req.body;

  if (!eventId || !roundId || !name) {
    return res
      .status(400)
      .json({
        message: "Event ID, Round ID, and Rubric name are required.",
      });
  }

  try {
    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ message: "Round not found." });

    if (round.eventId.toString() !== eventId.toString()) {
      return res
        .status(400)
        .json({
          message: "Round does not belong to the provided event.",
        });
    }

    const validTrackId = (trackId && mongoose.Types.ObjectId.isValid(trackId)) ? trackId : undefined;

    if (validTrackId) {
      const track = await Track.findById(validTrackId);
      if (!track) return res.status(404).json({ message: "Track not found." });

      if (track.roundId.toString() !== roundId.toString()) {
        return res
          .status(400)
          .json({
            message: "Track does not belong to the provided round.",
          });
      }
    }

    if (!(await canManageRubric(req, eventId))) {
      return res
        .status(403)
        .json({ message: "Unauthorized. Coordinator role required." });
    }

    const existingActive = await Rubric.findOne({ ...rubricScopeFilter(roundId, validTrackId), isActive: true });
    if (existingActive) {
      return res
        .status(400)
        .json({ message: validTrackId
          ? "Bảng đấu này đã có rubric active trong vòng thi."
          : "Vòng thi đã có rubric chung đang active." });
    }

    const rubricTotalWeight = toNumber(totalWeight, 100);
    if (rubricTotalWeight > 100) {
      return res
        .status(400)
        .json({ message: "Rubric totalWeight cannot exceed 100." });
    }

    const rubric = new Rubric({
      eventId,
      trackId: validTrackId,
      roundId,
      name: String(name).trim(),
      description,
      totalWeight: rubricTotalWeight,
      maxCriterionScore: toNumber(maxCriterionScore, 10),
      createdBy: req.user._id,
    });

    await rubric.save();

    // Create EventLog
    try {
      const EventLog = mongoose.model('EventLog');
      const roundObj = await Round.findById(roundId);
      const roundName = roundObj ? roundObj.name : roundId;
      let rubricDetailsMsg = `Tạo Rubric mới: "${rubric.name}" cho vòng thi: "${roundName}" (Trọng số: ${rubric.totalWeight}%, Điểm tối đa tiêu chí: ${rubric.maxCriterionScore})`;
      if (trackId) {
        const trackObj = await Track.findById(trackId);
        if (trackObj) {
          rubricDetailsMsg += ` tại bảng đấu: "${trackObj.name}"`;
        }
      }
      const newLog = new EventLog({
        eventId,
        actorId: req.user._id,
        action: 'create_rubric',
        type: 'operation',
        details: rubricDetailsMsg
      });
      await newLog.save();
    } catch (logErr) {
      console.error("EventLog Error:", logErr.message);
    }

    res.status(201).json(rubric);
  } catch (error) {
    console.error("Create Rubric Error:", error);
    res.status(500).json({ message: error.message || "Server error creating rubric." });
  }
});

/**
 * GET /api/rubrics/round/:roundId
 * Lấy rubric active của round kèm danh sách criteria
 */
router.get("/round/:roundId", authenticateToken, async (req, res) => {
  try {
    // trackId: rubric applying to that track (its own, else the round-wide one).
    // exact=true: only that scope, used by the admin editor to manage each rubric separately.
    const { trackId, exact } = req.query;
    const rubric = exact === "true"
      ? await Rubric.findOne({ ...rubricScopeFilter(req.params.roundId, trackId), isActive: true })
      : await findActiveRubric(req.params.roundId, trackId);
    if (!rubric) {
      return res
        .status(404)
        .json({ message: "No active rubric found for this round." });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({
      order: 1,
      createdAt: 1,
    });
    res.json({ rubric, criteria });
  } catch (error) {
    console.error("Fetch Rubric Error:", error.message);
    res.status(500).json({ message: "Server error retrieving rubric." });
  }
});

/**
 * GET /api/rubrics/:rubricId
 * Lấy chi tiết rubric theo ID
 */
router.get("/:rubricId", authenticateToken, async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) {
      return res.status(404).json({ message: "Rubric not found." });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({
      order: 1,
      createdAt: 1,
    });
    res.json({ rubric, criteria });
  } catch (error) {
    console.error("Fetch Rubric By ID Error:", error.message);
    res.status(500).json({ message: "Server error retrieving rubric." });
  }
});

/**
 * PUT /api/rubrics/:rubricId
 * Sửa rubric
 */
router.put("/:rubricId", authenticateToken, async (req, res) => {
  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked. It cannot be edited." });
    }

    const { name, description, totalWeight, maxCriterionScore, isActive } =
      req.body;

    let rubricDetails = [];

    if (name !== undefined && String(name).trim() !== rubric.name) {
      rubricDetails.push(`Tên: "${rubric.name}" -> "${String(name).trim()}"`);
      rubric.name = String(name).trim();
    }
    if (description !== undefined && description !== rubric.description) {
      rubricDetails.push(`Mô tả`);
      rubric.description = description;
    }

    if (totalWeight !== undefined) {
      const parsedTotalWeight = toNumber(totalWeight, rubric.totalWeight);
      if (parsedTotalWeight > 100) {
        return res
          .status(400)
          .json({ message: "Rubric totalWeight cannot exceed 100." });
      }

      const criteriaSum = await getCriteriaSum(rubric._id);
      if (criteriaSum > parsedTotalWeight) {
        return res.status(400).json({
          message: `Cannot reduce rubric totalWeight below current criteria sum (${criteriaSum}).`,
        });
      }

      if (parsedTotalWeight !== rubric.totalWeight) {
        rubricDetails.push(`Trọng số: ${rubric.totalWeight}% -> ${parsedTotalWeight}%`);
        rubric.totalWeight = parsedTotalWeight;
      }
    }

    if (maxCriterionScore !== undefined) {
      const parsedMaxScore = toNumber(maxCriterionScore, rubric.maxCriterionScore);
      if (parsedMaxScore !== rubric.maxCriterionScore) {
        rubricDetails.push(`Điểm tối đa tiêu chí: ${rubric.maxCriterionScore} -> ${parsedMaxScore}`);
        rubric.maxCriterionScore = parsedMaxScore;
      }
    }

    if (isActive !== undefined && !!isActive !== rubric.isActive) {
      rubricDetails.push(`Trạng thái hoạt động: ${rubric.isActive} -> ${!!isActive}`);
      rubric.isActive = !!isActive;
    }

    await rubric.save();

    let details = `Cập nhật Rubric: ${rubric.name}`;
    if (rubricDetails.length > 0) {
      details = `Cập nhật Rubric "${rubric.name}": ${rubricDetails.join(', ')}`;
    }

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'update_rubric',
      type: 'operation',
      details
    });
    await newLog.save();

    res.json(rubric);
  } catch (error) {
    console.error("Update Rubric Error:", error.message);
    res.status(500).json({ message: "Server error updating rubric." });
  }
});

/**
 * DELETE /api/rubrics/:rubricId
 * Xóa mềm rubric
 */
router.delete("/:rubricId", authenticateToken, async (req, res) => {
  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked and cannot be deleted." });
    }

    rubric.isActive = false;
    await rubric.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const Round = mongoose.model('Round');
    const roundObj = await Round.findById(rubric.roundId);
    const roundName = roundObj ? roundObj.name : rubric.roundId;
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'delete_rubric',
      type: 'operation',
      details: `Hủy kích hoạt Rubric: "${rubric.name}" khỏi vòng thi: "${roundName}"`
    });
    await newLog.save();

    res.json({ message: "Rubric deactivated successfully." });
  } catch (error) {
    console.error("Delete Rubric Error:", error.message);
    res.status(500).json({ message: "Server error deleting rubric." });
  }
});

/**
 * POST /api/rubrics/:rubricId/lock
 * Khóa rubric sau khi hoàn tất criteria
 */
router.post("/:rubricId/lock", authenticateToken, async (req, res) => {
  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id });
    const weightSum = criteria.reduce(
      (sum, criterion) => sum + Number(criterion.weight || 0),
      0,
    );

    if (Math.abs(weightSum - rubric.totalWeight) > 0.01) {
      return res.status(400).json({
        message: `Không thể khóa rubric. Tổng trọng số tiêu chí (${weightSum}) phải bằng trọng số rubric (${rubric.totalWeight}).`,
      });
    }

    rubric.isLocked = true;
    rubric.lockedBy = req.user._id;
    rubric.lockedAt = new Date();
    await rubric.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const Round = mongoose.model('Round');
    const roundObj = await Round.findById(rubric.roundId);
    const roundName = roundObj ? roundObj.name : rubric.roundId;
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'lock_rubric',
      type: 'operation',
      details: `Khóa Rubric: "${rubric.name}" của vòng thi: "${roundName}"`
    });
    await newLog.save();

    res.json({ message: "Rubric locked and ready for grading.", rubric });
  } catch (error) {
    console.error("Lock Rubric Error:", error.message);
    res.status(500).json({ message: "Server error locking rubric." });
  }
});

/**
 * POST /api/rubrics/:rubricId/unlock
 * Bẻ khóa Rubric (Force Unlock) cho Super-Admin / Coordinator để mở lại luồng chấm điểm
 */
router.post("/:rubricId/unlock", authenticateToken, async (req, res) => {
  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    rubric.isLocked = false;
    rubric.lockedBy = null;
    rubric.lockedAt = null;
    await rubric.save();

    // Create EventLog
    try {
      const EventLog = mongoose.model('EventLog');
      const Round = mongoose.model('Round');
      const roundObj = await Round.findById(rubric.roundId);
      const roundName = roundObj ? roundObj.name : rubric.roundId;
      const newLog = new EventLog({
        eventId: rubric.eventId,
        actorId: req.user._id,
        action: 'unlock_rubric',
        details: `Mở khóa Tối thượng (Force Unlock) Rubric: "${rubric.name}" của vòng thi: "${roundName}"`
      });
      await newLog.save();
    } catch (logErr) {
      console.error("EventLog Error:", logErr.message);
    }

    res.json({ message: "Bẻ khóa Rubric thành công! Bạn có thể chỉnh sửa lại tiêu chí.", rubric });
  } catch (error) {
    console.error("Unlock Rubric Error:", error.message);
    res.status(500).json({ message: error.message || "Server error unlocking rubric." });
  }
});

/**
 * POST /api/rubrics/:rubricId/criteria
 * Thêm hoặc liên kết criterion mới trực tiếp qua rubric (Legacy URL support)
 */
router.post("/:rubricId/criteria", authenticateToken, async (req, res) => {
  const {
    code,
    name,
    description,
    weight,
    maxScore,
    excellentDescription,
    goodDescription,
    passedDescription,
    failedDescription,
    order,
    gradingLevels,
  } = req.body;

  if (!code || !name || weight === undefined) {
    return res
      .status(400)
      .json({ message: "Criterion code, name, and weight are required." });
  }

  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked. Criteria cannot be modified." });
    }

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const duplicate = await Criterion.findOne({
      rubricId: rubric._id,
      code: String(code).trim().toUpperCase(),
    });

    if (duplicate) {
      return res
        .status(400)
        .json({
          message: "A criterion with this code already exists in this rubric.",
        });
    }

    const parsedWeight = Number(weight);
    if (Number.isNaN(parsedWeight)) {
      return res
        .status(400)
        .json({ message: "Criterion weight must be a number." });
    }

    const criteriaSum = await getCriteriaSum(rubric._id);
    if (criteriaSum + parsedWeight > rubric.totalWeight) {
      return res.status(400).json({
        message: `Cannot add criterion. Current weight sum (${criteriaSum}) plus new weight (${parsedWeight}) exceeds rubric totalWeight (${rubric.totalWeight}).`,
      });
    }

    let levels = [];
    if (Array.isArray(gradingLevels)) {
      levels = gradingLevels.map((lvl) => ({
        label: String(lvl.label || "").trim(),
        minScore: Number(lvl.minScore),
        maxScore: Number(lvl.maxScore),
        description: String(lvl.description || "").trim(),
      }));
    }

    const criterion = new Criterion({
      rubricId: rubric._id,
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      description,
      weight: parsedWeight,
      maxScore: maxScore !== undefined ? Number(maxScore) : 10,
      excellentDescription,
      goodDescription,
      passedDescription,
      failedDescription,
      order: order !== undefined ? parseInt(order, 10) : undefined,
      gradingLevels: levels,
    });

    await criterion.save();
    res.status(201).json(criterion);
  } catch (error) {
    console.error("Create Criterion Legacy Error:", error.message);
    res.status(500).json({ message: "Server error creating criterion." });
  }
});

/**
 * @route   GET /api/rubrics
 * @desc    Get all active rubrics with their criteria
 * @access  Private (Coordinator or Admin)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const rubrics = await Rubric.find({ isActive: true })
      .populate('eventId', 'name')
      .populate('trackId', 'name')
      .populate('roundId', 'name');

    // Fetch criteria for each rubric
    const rubricsWithCriteria = await Promise.all(
      rubrics.map(async (r) => {
        const criteria = await Criterion.find({ rubricId: r._id }).sort({ order: 1 });
        return {
          ...r.toObject(),
          criteria
        };
      })
    );

    res.json(rubricsWithCriteria);
  } catch (error) {
    console.error('Fetch All Rubrics Error:', error.message);
    res.status(500).json({ message: 'Server error retrieving rubrics.' });
  }
});

/**
 * @route   POST /api/rubrics/clone
 * @desc    Clone an existing rubric to a new event round
 * @access  Private (Coordinator or Admin)
 */
router.post('/clone', authenticateToken, async (req, res) => {
  const { fromRubricId, eventId, trackId, roundId, name } = req.body;

  if (!fromRubricId || !eventId || !roundId || !name) {
    return res.status(400).json({ message: 'From Rubric ID, Event ID, Round ID, and New Rubric Name are required.' });
  }

  try {
    // Auth Check
    if (!(await canManageRubric(req, eventId))) {
      return res.status(403).json({ message: 'Unauthorized.' });
    }

    // Check if rubric already exists for this target round
    const existing = await Rubric.findOne({ ...rubricScopeFilter(roundId, trackId), isActive: true });
    if (existing) {
      return res.status(400).json({ message: 'An active rubric already exists for this round/track.' });
    }

    // Find source rubric
    const sourceRubric = await Rubric.findById(fromRubricId);
    if (!sourceRubric) {
      return res.status(404).json({ message: 'Source rubric not found.' });
    }

    // Create new rubric
    const newRubric = new Rubric({
      eventId,
      trackId: trackId || undefined,
      roundId,
      name,
      description: sourceRubric.description,
      totalWeight: sourceRubric.totalWeight,
      maxCriterionScore: sourceRubric.maxCriterionScore,
      createdBy: req.user._id
    });

    await newRubric.save();

    // Find source criteria and clone them
    const sourceCriteria = await Criterion.find({ rubricId: fromRubricId });
    const newCriteria = sourceCriteria.map(c => new Criterion({
      rubricId: newRubric._id,
      code: c.code,
      name: c.name,
      description: c.description,
      weight: c.weight,
      maxScore: c.maxScore,
      excellentDescription: c.excellentDescription,
      goodDescription: c.goodDescription,
      passedDescription: c.passedDescription,
      failedDescription: c.failedDescription,
      order: c.order
    }));

    await Criterion.insertMany(newCriteria);

    res.status(201).json({
      message: 'Rubric cloned successfully!',
      rubric: newRubric,
      criteria: newCriteria
    });

  } catch (error) {
    console.error('Clone Rubric Error:', error.message);
    res.status(500).json({ message: 'Server error cloning rubric.' });
  }
});

/**
/**
 * @route   GET /api/rubrics/:rubricId/export
 * @desc    Export a rubric and its criteria as JSON
 * @access  Private (Coordinator or Admin)
 */
router.get('/:rubricId/export', authenticateToken, async (req, res) => {
  try {
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) return res.status(404).json({ message: 'Rubric not found.' });

    // Auth check
    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });

    const exportData = {
      name: rubric.name,
      description: rubric.description,
      totalWeight: rubric.totalWeight,
      maxCriterionScore: rubric.maxCriterionScore,
      criteria: criteria.map(c => ({
        code: c.code,
        name: c.name,
        description: c.description,
        weight: c.weight,
        maxScore: c.maxScore,
        excellentDescription: c.excellentDescription,
        goodDescription: c.goodDescription,
        passedDescription: c.passedDescription,
        failedDescription: c.failedDescription,
        order: c.order,
        gradingLevels: c.gradingLevels ? c.gradingLevels.map(lvl => ({
          label: lvl.label,
          minScore: lvl.minScore,
          maxScore: lvl.maxScore,
          description: lvl.description
        })) : []
      }))
    };

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const Round = mongoose.model('Round');
    const roundObj = await Round.findById(rubric.roundId);
    const roundName = roundObj ? roundObj.name : rubric.roundId;
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'export_rubric',
      type: 'operation',
      details: `Xuất cấu hình Rubric: "${rubric.name}" của vòng thi: "${roundName}" thành file JSON`
    });
    await newLog.save();

    res.setHeader('Content-disposition', `attachment; filename=rubric-${rubric._id}.json`);
    res.setHeader('Content-type', 'application/json');
    res.json(exportData);

  } catch (error) {
    console.error('Export Rubric Error:', error.message);
    res.status(500).json({ message: 'Server error exporting rubric.' });
  }
});

/**
 * GET /api/rubrics/template/download
 * Download file Excel template mẫu cho import criteria
 */
router.get('/template/download', authenticateToken, async (req, res) => {
  try {
    const wb = XLSX.utils.book_new();

    // Header row matching the new format exactly (1-row header)
    const headers = [
      ["Mã", "Tiêu chí", "Trọng số", "Điểm 5", "Điểm 4", "Điểm 3", "Điểm 2", "Điểm 1"]
    ];

    // Data rows matching the new format exactly
    const sampleData = [
      [
        "R2_01",
        "Độ hoàn thiện và ổn định của sản phẩm",
        "25%",
        "Sản phẩm hoàn thiện, hoạt động ổn định, xử lý đầy đủ các luồng chính và vượt qua tốt kịch bản đánh giá.",
        "Sản phẩm tương đối hoàn thiện; có lỗi nhỏ nhưng không ảnh hưởng lớn đến kết quả.",
        "Có đầy đủ chức năng chính nhưng còn lỗi hoặc thiếu một số phần phụ.",
        "Sản phẩm chưa hoàn thiện; lỗi xảy ra thường xuyên và ảnh hưởng đến quá trình sử dụng.",
        "Sản phẩm không thể vận hành hoặc không đủ chức năng để đánh giá."
      ],
      [
        "R2_02",
        "Năng lực phân tích và hỗ trợ quyết định của AI",
        "25%",
        "AI phân tích chính xác, xác định được bất thường hoặc rủi ro, hỗ trợ chẩn đoán và đề xuất hành động phù hợp.",
        "AI hỗ trợ tốt việc phân tích và ra quyết định; còn hạn chế nhỏ về độ sâu hoặc tính nhất quán.",
        "AI đưa ra kết quả cơ bản nhưng còn chung chung hoặc giá trị hỗ trợ quyết định chưa cao.",
        "Kết quả phân tích thiếu chính xác; đề xuất chưa hợp lý khó áp dụng.",
        "AI không hỗ trợ hiệu quả cho việc phân tích hoặc ra quyết định."
      ],
      [
        "R2_03",
        "Độ tin cậy, an toàn và khả năng giải thích",
        "20%",
        "Kết quả AI có thể kiểm chứng; hệ thống giải thích rõ cơ sở phân tích, xử lý tốt dữ liệu bất thường và hạn chế cảnh báo sai.",
        "Kết quả nhìn chung đáng tin cậy; có khả năng giải thích nhưng chưa đầy đủ ở một số tình huống.",
        "Có kiểm soát cơ bản nhưng giải thích còn hạn chế; đôi lúc xuất hiện kết quả thiếu nhất quán.",
        "Thiếu cơ chế kiểm chứng; cảnh báo sai hoặc kết quả khó giải thích.",
        "Kết quả không đáng tin cậy; không có khả năng giải thích hoặc kiểm soát lỗi."
      ],
      [
        "R2_04",
        "Tính sáng tạo, khả năng mở rộng và ứng dụng thực tế",
        "15%",
        "Giải pháp có điểm khác biệt rõ ràng; kiến trúc có thể mở rộng và có tiềm năng triển khai thực tế cao.",
        "Có yếu tố sáng tạo; phương án mở rộng và ứng dụng tương đối khả thi.",
        "Giải pháp an toàn, phổ biến; khả năng mở rộng và ứng dụng ở mức chấp nhận được.",
        "Ít sáng tạo; phương án mở rộng chưa rõ ràng hoặc khó triển khai thực tế.",
        "Không có điểm mới; không thể mở rộng hoặc áp dụng trong thực tế."
      ],
      [
        "R2_05",
        "Kỹ năng Demo, trình bày và phản biện",
        "15%",
        "Demo trôi chảy; trình bày thuyết phục; trả lời rõ ràng và bảo vệ tốt các quyết định kỹ thuật, sản phẩm.",
        "Demo và trình bày tốt; trả lời được phần lớn câu hỏi nhưng còn thiếu chiều sâu ở một số nội dung.",
        "Trình bày ở mức cơ bản; trả lời được các câu hỏi trực tiếp nhưng phản biện còn hạn chế.",
        "Demo thiếu ổn định; trình bày rời rạc, lúng túng khi trả lời câu hỏi.",
        "Không demo hoặc không trả lời được các câu hỏi chính của Ban Giám khảo."
      ]
    ];

    const wsData = [...headers, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // No merged cells in the new template
    ws['!merges'] = [];

    // Set column widths
    ws['!cols'] = [
      { wch: 10 }, // A - Mã
      { wch: 35 }, // B - Tiêu chí
      { wch: 12 }, // C - Trọng số
      { wch: 30 }, // D - Điểm 5
      { wch: 30 }, // E - Điểm 4
      { wch: 30 }, // F - Điểm 3
      { wch: 30 }, // G - Điểm 2
      { wch: 30 }, // H - Điểm 1
    ];

    styleWorksheet(ws, 1);

    XLSX.utils.book_append_sheet(wb, ws, 'R1_Rubrics');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=Template_Criteria.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Download Template Error:', error.message);
    res.status(500).json({ message: 'Server error generating template.' });
  }
});

/**
 * @route   POST /api/rubrics/import
 * @desc    Import a rubric from JSON
 * @access  Private (Coordinator or Admin)
 */
router.post('/import', authenticateToken, async (req, res) => {
  const { eventId, trackId, roundId, rubricData } = req.body;

  if (!eventId || !roundId || !rubricData) {
    return res.status(400).json({ message: 'Event ID, Round ID, and Rubric data are required.' });
  }

  try {
    // Auth Check
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ quản trị viên mới được quyền tạo Rubric.' });
    }

    // Check if rubric already exists for this target round
    const existing = await Rubric.findOne({ ...rubricScopeFilter(roundId, trackId), isActive: true });
    if (existing) {
      return res.status(400).json({ message: 'An active rubric already exists for this round/track.' });
    }

    // Create new rubric
    const newRubric = new Rubric({
      eventId,
      trackId: trackId || undefined,
      roundId,
      name: rubricData.name || 'Imported Rubric',
      description: rubricData.description || '',
      totalWeight: rubricData.totalWeight || 100,
      maxCriterionScore: rubricData.maxCriterionScore || 10,
      createdBy: req.user._id
    });

    await newRubric.save();

    // Create criteria
    const criteriaList = [];
    if (Array.isArray(rubricData.criteria)) {
      for (const c of rubricData.criteria) {
        const criterion = new Criterion({
          rubricId: newRubric._id,
          code: String(c.code).trim().toUpperCase(),
          name: String(c.name).trim(),
          description: c.description || '',
          weight: Number(c.weight || 0),
          maxScore: c.maxScore !== undefined ? Number(c.maxScore) : 10,
          excellentDescription: c.excellentDescription || '',
          goodDescription: c.goodDescription || '',
          passedDescription: c.passedDescription || '',
          failedDescription: c.failedDescription || '',
          order: c.order,
          gradingLevels: Array.isArray(c.gradingLevels) ? c.gradingLevels.map(lvl => ({
            label: String(lvl.label || '').trim(),
            minScore: Number(lvl.minScore || 0),
            maxScore: Number(lvl.maxScore || 0),
            description: String(lvl.description || '').trim()
          })) : []
        });
        criteriaList.push(criterion);
      }
      await Criterion.insertMany(criteriaList);
    }

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const Round = mongoose.model('Round');
    const roundObj = await Round.findById(roundId);
    const roundName = roundObj ? roundObj.name : roundId;
    const newLog = new EventLog({
      eventId,
      actorId: req.user._id,
      action: 'import_rubric',
      type: 'operation',
      details: `Nhập cấu hình Rubric mới từ file JSON: "${newRubric.name}" cho vòng thi: "${roundName}"`
    });
    await newLog.save();

    res.status(201).json({
      message: 'Rubric imported successfully!',
      rubric: newRubric,
      criteria: criteriaList
    });

  } catch (error) {
    console.error('Import Rubric Error:', error.message);
    res.status(500).json({ message: 'Server error importing rubric.' });
  }
});

/**
 * POST /api/rubrics/:rubricId/import-criteria
 * Import và đồng bộ hóa criteria từ file Excel upload
 * Hỗ trợ Thêm mới, Cập nhật tiêu chí trùng mã, và Xóa tiêu chí bị thiếu trong file Excel
 */
router.post('/:rubricId/import-criteria', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    // 1. Load and validate rubric
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) {
      return res.status(404).json({ message: 'Rubric not found.' });
    }

    if (rubric.isLocked) {
      return res.status(400).json({ message: 'Rubric đã bị khóa. Không thể thay đổi tiêu chí.' });
    }

    // Check permissions
    if (!req.user.isSystemAdmin) {
      return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ quản trị viên mới được quyền import Rubric.' });
    }

    // 2. Check file
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng upload file Excel (.xlsx).' });
    }

    // 3. Parse Excel
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ message: 'File Excel không có sheet nào.' });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawData.length < 2) {
      return res.status(400).json({
        message: 'File Excel không đúng định dạng mẫu tiêu chí.',
      });
    }

    // Auto-detect header format:
    // If the first cell of row 2 (index 1) is a valid criteria code or is not "mã", it is a 1-header file
    const cell0 = String(rawData[0][0] || '').trim().toLowerCase();
    const cell1 = String(rawData[1][0] || '').trim().toUpperCase();
    const isOneHeader = cell0 === 'mã' && (cell1.match(/^[A-Z0-9_-]+$/) || cell1 !== 'mã');

    let headerRow;
    let dataStartIdx;
    if (isOneHeader) {
      headerRow = rawData[0];
      dataStartIdx = 1;
    } else {
      if (rawData.length < 3) {
        return res.status(400).json({
          message: 'File Excel dạng 2 dòng header phải có ít nhất 2 hàng header và 1 hàng dữ liệu.',
        });
      }
      headerRow = rawData[1];
      dataStartIdx = 2;
    }

    // 4. Parse grading levels from headerRow starting from column index 3 (Col D)
    const gradingLevelDefs = [];
    const gradingLevelRegex = /^(.+?)\s*\(\s*([\d.]+)\s*-\s*([\d.]+)\s*\)$/;
    const diemRegex = /^Điểm\s*([\d.]+)$/i;
    const numericRegex = /^([\d.]+)$/;

    for (let col = 3; col < headerRow.length; col++) {
      const headerVal = String(headerRow[col] || '').trim();
      if (!headerVal) continue; // skip empty columns

      // Try matching old format: "Xuất sắc (9.0 - 10.0)"
      let match = headerVal.match(gradingLevelRegex);
      if (match) {
        gradingLevelDefs.push({
          colIndex: col,
          label: match[1].trim(),
          minScore: parseFloat(match[2]),
          maxScore: parseFloat(match[3]),
        });
        continue;
      }

      // Try matching new format: "Điểm 5"
      match = headerVal.match(diemRegex);
      if (match) {
        const score = parseFloat(match[1]);
        gradingLevelDefs.push({
          colIndex: col,
          label: `Điểm ${score}`,
          minScore: score,
          maxScore: score,
        });
        continue;
      }

      // Try matching plain number: "5"
      match = headerVal.match(numericRegex);
      if (match) {
        const score = parseFloat(match[1]);
        gradingLevelDefs.push({
          colIndex: col,
          label: `Điểm ${score}`,
          minScore: score,
          maxScore: score,
        });
        continue;
      }

      // Default fallback
      gradingLevelDefs.push({
        colIndex: col,
        label: headerVal,
        minScore: 0,
        maxScore: 0,
      });
    }

    if (gradingLevelDefs.length === 0) {
      return res.status(400).json({
        message: 'Không tìm thấy định nghĩa mức điểm nào bắt đầu từ cột D.',
      });
    }

    // 5. Parse data rows
    const existingCriteria = await Criterion.find({ rubricId: rubric._id });

    const maxScoreFromExcel = gradingLevelDefs.reduce((max, lvl) => Math.max(max, lvl.maxScore || 0), 0);

    const toImport = [];
    const errors = [];
    let newWeightSum = 0;
    let nextOrder = 1;

    for (let rowIdx = dataStartIdx; rowIdx < rawData.length; rowIdx++) {
      const row = rawData[rowIdx];
      const rowNum = rowIdx + 1; // 1-based for user display

      const code = String(row[0] || '').trim().toUpperCase();
      const name = String(row[1] || '').trim();
      const weightRaw = row[2];

      // Skip completely empty rows
      if (!code && !name && (weightRaw === '' || weightRaw === undefined)) {
        continue;
      }

      // Validate required fields
      if (!code) {
        errors.push(`Dòng ${rowNum}: Thiếu mã tiêu chí (cột A).`);
        continue;
      }
      if (!name) {
        errors.push(`Dòng ${rowNum}: Thiếu tên tiêu chí (cột B).`);
        continue;
      }

      // Parse weight intelligently
      let weight = NaN;
      const weightRawStr = String(weightRaw || '').trim();
      if (weightRawStr.endsWith('%')) {
        weight = parseFloat(weightRawStr);
      } else {
        weight = Number(weightRaw);
        if (!isNaN(weight) && weight > 0 && weight <= 1.0) {
          // Auto-convert decimal fraction (0.25) to percentage (25)
          weight = weight * 100;
        }
      }

      if (isNaN(weight) || weight <= 0) {
        errors.push(`Dòng ${rowNum}: Trọng số không hợp lệ (cột C). Giá trị: "${weightRaw}"`);
        continue;
      }

      // Check duplicate within import file
      if (toImport.some((item) => item.code === code)) {
        errors.push(`Dòng ${rowNum}: Mã "${code}" bị trùng trong file import.`);
        continue;
      }

      // Build grading levels for this row
      let missingLevel = false;
      const gradingLevels = [];
      for (const def of gradingLevelDefs) {
        const desc = String(row[def.colIndex] || '').trim();
        if (!desc) {
          errors.push(`Dòng ${rowNum}: Thiếu mô tả cho mức chấm điểm "${def.label}" (Cột ${String.fromCharCode(65 + def.colIndex)}).`);
          missingLevel = true;
        }
        gradingLevels.push({
          label: def.label,
          minScore: def.minScore,
          maxScore: def.maxScore,
          description: desc,
        });
      }

      if (missingLevel) {
        continue;
      }

      newWeightSum += weight;

      toImport.push({
        rubricId: rubric._id,
        code,
        name,
        weight,
        maxScore: maxScoreFromExcel || rubric.maxCriterionScore || 10,
        order: nextOrder++,
        gradingLevels,
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Có lỗi dữ liệu trong file Excel.',
        errors,
        imported: 0,
      });
    }

    if (toImport.length === 0) {
      return res.status(400).json({
        message: 'Không có tiêu chí hợp lệ nào trong file Excel.',
        errors,
        imported: 0,
      });
    }

    // 6. Validate total weight
    if (newWeightSum > rubric.totalWeight) {
      return res.status(400).json({
        message: `Không thể import. Tổng trọng số của file Excel (${newWeightSum}%) vượt quá giới hạn của Rubric (${rubric.totalWeight}%).`,
        errors,
        imported: 0,
      });
    }

    // 7. Sync logic: Determine adds, updates, deletes
    const importCodes = new Set(toImport.map((item) => item.code));
    const toDeleteIds = existingCriteria
      .filter((c) => !importCodes.has(c.code.toUpperCase()))
      .map((c) => c._id);

    // Delete missing criteria
    if (toDeleteIds.length > 0) {
      await Criterion.deleteMany({ _id: { $in: toDeleteIds } });
    }

    // Insert new / Update existing
    let insertedCount = 0;
    let updatedCount = 0;
    const toInsert = [];

    for (const item of toImport) {
      const existing = existingCriteria.find((c) => c.code.toUpperCase() === item.code);
      if (existing) {
        existing.name = item.name;
        existing.weight = item.weight;
        existing.gradingLevels = item.gradingLevels;
        existing.maxScore = item.maxScore;
        existing.order = item.order;
        await existing.save();
        updatedCount++;
      } else {
        toInsert.push(item);
      }
    }

    if (toInsert.length > 0) {
      const inserted = await Criterion.insertMany(toInsert);
      insertedCount = inserted.length;
    }

    if (maxScoreFromExcel > 0 && maxScoreFromExcel !== rubric.maxCriterionScore) {
      rubric.maxCriterionScore = maxScoreFromExcel;
      await rubric.save();
    }

    // Return the final list of criteria
    const finalCriteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });

    res.status(201).json({
      message: `Đồng bộ tiêu chí thành công!`,
      imported: insertedCount,
      updated: updatedCount,
      deleted: toDeleteIds.length,
      errorCount: errors.length,
      errors,
      criteria: finalCriteria,
    });
  } catch (error) {
    console.error('Import Criteria Error:', error.message);
    if (error.message === 'Chỉ chấp nhận file Excel (.xlsx, .xls)') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error importing criteria.' });
  }
});

/**
 * GET /api/rubrics/:rubricId/export-criteria
 * Xuất danh sách criteria hiện tại ra file Excel để chỉnh sửa / xóa
 */
router.get('/:rubricId/export-criteria', authenticateToken, async (req, res) => {
  try {
    // 1. Load rubric
    const rubric = await Rubric.findById(req.params.rubricId);
    if (!rubric) {
      return res.status(404).json({ message: 'Rubric not found.' });
    }

    // Check permissions
    if (!req.user.isSystemAdmin) {
      const role = await EventRole.findOne({
        userId: req.user._id,
        eventId: rubric.eventId,
        role: 'admin_view',
        status: 'active',
      });
      if (!role) {
        return res.status(403).json({ message: 'Unauthorized. Coordinator role required.' });
      }
    }

    // 2. Load criteria
    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({ order: 1 });

    // 3. Define grading levels for this rubric (based on existing criteria if possible)
    let gradingLevelDefs = [];
    if (criteria.length > 0 && criteria[0].gradingLevels && criteria[0].gradingLevels.length > 0) {
      // Use existing labels and score mapping
      gradingLevelDefs = criteria[0].gradingLevels.map(lvl => ({
        label: lvl.label,
        minScore: lvl.minScore,
        maxScore: lvl.maxScore
      }));
    } else {
      // Default fallback grading levels definitions (new 5-point scale)
      gradingLevelDefs = [
        { label: 'Điểm 5', minScore: 5.0, maxScore: 5.0 },
        { label: 'Điểm 4', minScore: 4.0, maxScore: 4.0 },
        { label: 'Điểm 3', minScore: 3.0, maxScore: 3.0 },
        { label: 'Điểm 2', minScore: 2.0, maxScore: 2.0 },
        { label: 'Điểm 1', minScore: 1.0, maxScore: 1.0 }
      ];
    }

    // 4. Create Workbook & Worksheet
    const wb = XLSX.utils.book_new();

    // Headers Construction (new 1-row header format)
    const headers = [['Mã', 'Tiêu chí', 'Trọng số', ...gradingLevelDefs.map(def => def.label)]];

    // Data rows
    const dataRows = [];
    for (const c of criteria) {
      const percentWeight = c.weight > 1 ? c.weight : c.weight * 100;
      const formattedWeight = `${percentWeight}%`;
      const row = [c.code, c.name, formattedWeight];
      for (const def of gradingLevelDefs) {
        const match = c.gradingLevels && c.gradingLevels.find(
          lvl => lvl.label === def.label &&
            Math.abs(lvl.minScore - def.minScore) < 0.01 &&
            Math.abs(lvl.maxScore - def.maxScore) < 0.01
        );
        row.push(match ? match.description : '');
      }
      dataRows.push(row);
    }

    const wsData = [...headers, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // No merged cells in the new template
    ws['!merges'] = [];

    // Columns width
    ws['!cols'] = [
      { wch: 10 }, // A - Mã
      { wch: 35 }, // B - Tiêu chí
      { wch: 12 }, // C - Trọng số
    ];
    for (let i = 0; i < gradingLevelDefs.length; i++) {
      ws['!cols'].push({ wch: 30 });
    }

    styleWorksheet(ws, 1);

    const sanitizedSheetName = rubric.name.substring(0, 30).replace(/[*?:\\/\[\]]/g, '') || 'Criteria';
    XLSX.utils.book_append_sheet(wb, ws, sanitizedSheetName);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeFilename = `Criteria_${rubric.name.replace(/\s+/g, '_')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(safeFilename)}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Export Criteria Error:', error.message);
    res.status(500).json({ message: 'Server error exporting criteria.' });
  }
});

module.exports = router;
