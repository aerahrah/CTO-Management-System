// services/ctoApproverSetting.service.js
const mongoose = require("mongoose");
const CtoApproverSetting = require("../models/ctoApproverSettingModel");
const Designation = require("../models/designationModel");
const Employee = require("../models/employeeModel");

// --- HELPER FUNCTIONS ---

function createServiceError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, label = "ID") {
  if (!mongoose.isValidObjectId(id)) {
    throw createServiceError(`Invalid ${label} format.`, 400);
  }
}

/**
 * Checks if a document exists to validate relationships before insertion.
 */
async function assertExists(Model, id, label) {
  const exists = await Model.exists({ _id: id });
  if (!exists) {
    throw createServiceError(`${label} not found.`, 404);
  }
}

// --- SERVICE METHODS ---

async function getApproversByDesignationService(designationId) {
  assertObjectId(designationId, "designation id");

  return CtoApproverSetting.findOne({ designation: designationId })
    .select("-__v")
    .populate("designation", "name status")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position")
    .lean();
}

async function upsertApproverSettingService(data = {}) {
  const { designation, level1Approver, level2Approver, level3Approver } = data;

  // 1. Validate Formats
  assertObjectId(designation, "designation");
  assertObjectId(level1Approver, "level1Approver");
  assertObjectId(level2Approver, "level2Approver");
  assertObjectId(level3Approver, "level3Approver");

  // 2. Prevent Duplicate Approvers
  const distinct = new Set([
    String(level1Approver),
    String(level2Approver),
    String(level3Approver),
  ]);

  if (distinct.size !== 3) {
    throw createServiceError("Approvers must be distinct.", 400);
  }

  // 3. Concurrent Relationship Validation (Performance Boost)
  await Promise.all([
    assertExists(Designation, designation, "Designation"),
    assertExists(Employee, level1Approver, "Level 1 Approver employee"),
    assertExists(Employee, level2Approver, "Level 2 Approver employee"),
    assertExists(Employee, level3Approver, "Level 3 Approver employee"),
  ]);

  // 4. Secure Upsert Execution
  const setting = await CtoApproverSetting.findOneAndUpdate(
    { designation },
    {
      $set: {
        designation,
        level1Approver,
        level2Approver,
        level3Approver,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
      lean: true, // Return plain JS object
    },
  )
    .select("-__v")
    .populate("designation", "name status")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position");

  return setting;
}

async function getAllApproverSettingsService() {
  return CtoApproverSetting.find()
    .select("-__v")
    .populate("designation", "name status")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position")
    .sort({ createdAt: -1 })
    .lean();
}

async function deleteApproverSettingService(id) {
  assertObjectId(id, "approver setting id");

  // Select only ID to limit memory overhead on deletion
  const deleted = await CtoApproverSetting.findByIdAndDelete(id)
    .select("_id")
    .lean();

  if (!deleted) {
    throw createServiceError("Approver setting not found.", 404);
  }

  return deleted;
}

module.exports = {
  getApproversByDesignationService,
  upsertApproverSettingService,
  getAllApproverSettingsService,
  deleteApproverSettingService,
};
