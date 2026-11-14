const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Rubric = mongoose.model("Rubric");
const Criterion = mongoose.model("Criterion");
const EventRole = mongoose.model("EventRole");
const { authenticateToken } = require("../auth/authMiddleware");
const { isEventStaff } = require("../teams/teamAccess");

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return !!value;
}

function validateGradingLevels(levels) {
  if (levels === undefined) return { ok: true, levels: [] };

  if (!Array.isArray(levels)) {
    return { ok: false, message: "gradingLevels must be an array." };
  }

  const normalized = levels.map((level) => ({
    label: String(level.label || "").trim(),
    minScore: toNumber(level.minScore, NaN),
    maxScore: toNumber(level.maxScore, NaN),
    description: String(level.description || "").trim(),
  }));

  for (const level of normalized) {
    if (!level.label) {
      return { ok: false, message: "Each grading level needs a label." };
    }
    if (Number.isNaN(level.minScore) || Number.isNaN(level.maxScore)) {
      return {
        ok: false,
        message: "Each grading level needs minScore and maxScore.",
      };
    }
    if (level.minScore > level.maxScore) {
      return {
        ok: false,
        message: "gradingLevel minScore cannot be greater than maxScore.",
      };
    }
  }

  normalized.sort((a, b) => a.minScore - b.minScore);

  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].minScore <= normalized[i - 1].maxScore) {
      return { ok: false, message: "gradingLevels cannot overlap." };
    }
  }

  return { ok: true, levels: normalized };
}

// "coordinator" is not a valid EventRole, so organisers are resolved via isEventStaff.
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

async function loadCriterionOr404(rubricId, criterionId, res) {
  const criterion = await Criterion.findOne({
    _id: criterionId,
    rubricId,
  });

  if (!criterion) {
    res.status(404).json({ message: "Criterion not found." });
    return null;
  }

  return criterion;
}

async function getCriteriaSum(rubricId, excludeCriterionId = null) {
  const criteria = await Criterion.find({ rubricId });

  return criteria.reduce((sum, criterion) => {
    if (
      excludeCriterionId &&
      criterion._id.toString() === excludeCriterionId.toString()
    ) {
      return sum;
    }
    return sum + Number(criterion.weight || 0);
  }, 0);
}

/**
 * GET /api/criteria/rubric/:rubricId
 * Lấy toàn bộ criterion của một rubric
 */
router.get("/rubric/:rubricId", authenticateToken, async (req, res) => {
  try {
    const rubric = await loadRubricOr404(req.params.rubricId, res);
    if (!rubric) return;

    const criteria = await Criterion.find({ rubricId: rubric._id }).sort({
      order: 1,
      createdAt: 1,
    });
    res.json({ rubric, criteria });
  } catch (error) {
    console.error("List Criteria Error:", error.message);
    res.status(500).json({ message: "Server error retrieving criteria." });
  }
});

/**
 * GET /api/criteria/:criterionId
 * Lấy chi tiết một criterion
 */
router.get("/:criterionId", authenticateToken, async (req, res) => {
  try {
    const criterion = await Criterion.findById(req.params.criterionId);
    if (!criterion) {
      return res.status(404).json({ message: "Criterion not found." });
    }

    res.json(criterion);
  } catch (error) {
    console.error("Fetch Criterion Error:", error.message);
    res.status(500).json({ message: "Server error retrieving criterion." });
  }
});

/**
 * POST /api/criteria/rubric/:rubricId
 * Thêm criterion mới vào rubric
 */
router.post("/rubric/:rubricId", authenticateToken, async (req, res) => {
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

    const normalizedCode = normalizeCode(code);
    const duplicate = await Criterion.findOne({
      rubricId: rubric._id,
      code: normalizedCode,
    });

    if (duplicate) {
      return res
        .status(400)
        .json({
          message: "A criterion with this code already exists in this rubric.",
        });
    }

    const parsedWeight = toNumber(weight, NaN);
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

    const levelsCheck = validateGradingLevels(gradingLevels);
    if (!levelsCheck.ok) {
      return res.status(400).json({ message: levelsCheck.message });
    }

    let finalOrder = order !== undefined ? parseInt(order, 10) : undefined;
    if (finalOrder === undefined || isNaN(finalOrder)) {
      const maxCrit = await Criterion.findOne({ rubricId: rubric._id }).sort({ order: -1 });
      finalOrder = maxCrit && typeof maxCrit.order === 'number' ? maxCrit.order + 1 : 1;
    }

    const criterion = new Criterion({
      rubricId: rubric._id,
      code: normalizedCode,
      name: String(name).trim(),
      description,
      weight: parsedWeight,
      maxScore: toNumber(maxScore, 10),
      excellentDescription,
      goodDescription,
      passedDescription,
      failedDescription,
      order: finalOrder,
      gradingLevels: levelsCheck.levels,
    });

    await criterion.save();

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'create_criterion',
      type: 'operation',
      details: `Tạo tiêu chí mới: ${criterion.name} (${criterion.code}, trọng số: ${criterion.weight}%) trong Rubric: ${rubric.name}`
    });
    await newLog.save();

    res.status(201).json(criterion);
  } catch (error) {
    console.error("Create Criterion Error:", error.message);
    res.status(500).json({ message: "Server error creating criterion." });
  }
});

/**
 * PUT /api/criteria/:criterionId
 * Sửa criterion
 */
router.put("/:criterionId", authenticateToken, async (req, res) => {
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

  try {
    const criterion = await Criterion.findById(req.params.criterionId);
    if (!criterion) {
      return res.status(404).json({ message: "Criterion not found." });
    }

    const rubric = await loadRubricOr404(criterion.rubricId, res);
    if (!rubric) return;

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked. Criteria cannot be modified." });
    }

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    let normalizedCode = "";
    if (code !== undefined) {
      normalizedCode = normalizeCode(code);
      const duplicate = await Criterion.findOne({
        rubricId: rubric._id,
        code: normalizedCode,
        _id: { $ne: criterion._id },
      });

      if (duplicate) {
        return res
          .status(400)
          .json({
            message:
              "A criterion with this code already exists in this rubric.",
          });
      }
    }

    let critDetails = [];

    if (code !== undefined && normalizedCode !== criterion.code) {
      critDetails.push(`Mã: "${criterion.code}" -> "${normalizedCode}"`);
      criterion.code = normalizedCode;
    }
    if (name !== undefined && String(name).trim() !== criterion.name) {
      critDetails.push(`Tên: "${criterion.name}" -> "${String(name).trim()}"`);
      criterion.name = String(name).trim();
    }
    if (description !== undefined && description !== criterion.description) {
      critDetails.push(`Mô tả`);
      criterion.description = description;
    }

    if (weight !== undefined) {
      const parsedWeight = toNumber(weight, NaN);
      if (Number.isNaN(parsedWeight)) {
        return res
          .status(400)
          .json({ message: "Criterion weight must be a number." });
      }

      const otherWeights = await getCriteriaSum(rubric._id, criterion._id);
      if (otherWeights + parsedWeight > rubric.totalWeight) {
        return res.status(400).json({
          message: `Cannot update criterion. Current weight sum plus new weight exceeds rubric totalWeight (${rubric.totalWeight}).`,
        });
      }

      if (parsedWeight !== criterion.weight) {
        critDetails.push(`Trọng số: ${criterion.weight}% -> ${parsedWeight}%`);
        criterion.weight = parsedWeight;
      }
    }

    if (maxScore !== undefined) {
      const parsedMaxScore = toNumber(maxScore, criterion.maxScore);
      if (parsedMaxScore !== criterion.maxScore) {
        critDetails.push(`Điểm tối đa: ${criterion.maxScore} -> ${parsedMaxScore}`);
        criterion.maxScore = parsedMaxScore;
      }
    }
    if (excellentDescription !== undefined)
      criterion.excellentDescription = excellentDescription;
    if (goodDescription !== undefined)
      criterion.goodDescription = goodDescription;
    if (passedDescription !== undefined)
      criterion.passedDescription = passedDescription;
    if (failedDescription !== undefined)
      criterion.failedDescription = failedDescription;
    if (order !== undefined && order !== null && order !== "") {
      const parsed = parseInt(order, 10);
      if (!isNaN(parsed) && parsed !== criterion.order) {
        critDetails.push(`Thứ tự: ${criterion.order} -> ${parsed}`);
        criterion.order = parsed;
      }
    }

    if (gradingLevels !== undefined) {
      const levelsCheck = validateGradingLevels(gradingLevels);
      if (!levelsCheck.ok) {
        return res.status(400).json({ message: levelsCheck.message });
      }
      criterion.gradingLevels = levelsCheck.levels;
    }

    await criterion.save();

    let details = `Cập nhật tiêu chí: ${criterion.name} (${criterion.code}, trọng số: ${criterion.weight}%) trong Rubric: ${rubric.name}`;
    if (critDetails.length > 0) {
      details = `Cập nhật tiêu chí "${criterion.name}" (${criterion.code}) trong Rubric "${rubric.name}": ${critDetails.join(', ')}`;
    }

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'update_criterion',
      type: 'operation',
      details
    });
    await newLog.save();

    res.json(criterion);
  } catch (error) {
    console.error("Update Criterion Error:", error.message);
    res.status(500).json({ message: "Server error updating criterion." });
  }
});

/**
 * DELETE /api/criteria/:criterionId
 * Xóa criterion
 */
router.delete("/:criterionId", authenticateToken, async (req, res) => {
  try {
    const criterion = await Criterion.findById(req.params.criterionId);
    if (!criterion) {
      return res.status(404).json({ message: "Criterion not found." });
    }

    const rubric = await loadRubricOr404(criterion.rubricId, res);
    if (!rubric) return;

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked. Criteria cannot be modified." });
    }

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    await Criterion.deleteOne({ _id: criterion._id });

    // Create EventLog
    const EventLog = mongoose.model('EventLog');
    const newLog = new EventLog({
      eventId: rubric.eventId,
      actorId: req.user._id,
      action: 'delete_criterion',
      type: 'operation',
      details: `Xóa tiêu chí: ${criterion.name} (${criterion.code}) khỏi Rubric: ${rubric.name}`
    });
    await newLog.save();

    res.json({ message: "Criterion deleted successfully." });
  } catch (error) {
    console.error("Delete Criterion Error:", error.message);
    res.status(500).json({ message: "Server error deleting criterion." });
  }
});

/**
 * PUT /api/criteria/:criterionId/order
 * Đổi thứ tự criterion trong rubric
 */
router.put("/:criterionId/order", authenticateToken, async (req, res) => {
  try {
    const criterion = await Criterion.findById(req.params.criterionId);
    if (!criterion) {
      return res.status(404).json({ message: "Criterion not found." });
    }

    const rubric = await loadRubricOr404(criterion.rubricId, res);
    if (!rubric) return;

    if (rubric.isLocked) {
      return res
        .status(400)
        .json({ message: "Rubric is locked. Criteria cannot be modified." });
    }

    if (!(await canManageRubric(req, rubric.eventId))) {
      return res.status(403).json({ message: "Unauthorized." });
    }

    const order = parseInt(req.body.order, 10);
    if (Number.isNaN(order)) {
      return res.status(400).json({ message: "Order must be a number." });
    }

    criterion.order = order;
    await criterion.save();

    res.json(criterion);
  } catch (error) {
    console.error("Update Criterion Order Error:", error.message);
    res.status(500).json({ message: "Server error updating criterion order." });
  }
});

module.exports = router;
