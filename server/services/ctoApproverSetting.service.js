// services/ctoApproverSetting.service.js
const mongoose = require("mongoose");
const CtoApproverSetting = require("../models/ctoApproverSettingModel");
const Designation = require("../models/designationModel");
const Employee = require("../models/employeeModel");

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertObjectId(id, label = "id") {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(`Invalid ${label}`, 400);
  }
}

async function assertExists(Model, id, label) {
  const exists = await Model.exists({ _id: id });
  if (!exists) throw httpError(`${label} not found.`, 404);
}

async function getApproversByDesignationService(designationId) {
  assertObjectId(designationId, "designation id");

  return CtoApproverSetting.findOne({ designation: designationId })
    .populate("designation", "name status")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position");
}

async function upsertApproverSettingService(data) {
  const { designation, level1Approver, level2Approver, level3Approver } =
    data || {};

  assertObjectId(designation, "designation");
  assertObjectId(level1Approver, "level1Approver");
  assertObjectId(level2Approver, "level2Approver");
  assertObjectId(level3Approver, "level3Approver");

  const distinct = new Set([
    String(level1Approver),
    String(level2Approver),
    String(level3Approver),
  ]);
  if (distinct.size !== 3) throw httpError("Approvers must be distinct.", 400);

  await assertExists(Designation, designation, "Designation");
  await assertExists(Employee, level1Approver, "Level 1 Approver employee");
  await assertExists(Employee, level2Approver, "Level 2 Approver employee");
  await assertExists(Employee, level3Approver, "Level 3 Approver employee");

  const setting = await CtoApproverSetting.findOneAndUpdate(
    { designation },
    { designation, level1Approver, level2Approver, level3Approver },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )
    .populate("designation", "name status")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position");

  return setting;
}

async function getAllApproverSettingsService() {
  return CtoApproverSetting.find()
    .populate("designation", "name status")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position")
    .sort({ createdAt: -1 });
}

async function deleteApproverSettingService(id) {
  assertObjectId(id, "approver setting id");

  const deleted = await CtoApproverSetting.findByIdAndDelete(id);
  if (!deleted) throw httpError("Approver setting not found.", 404);
  return deleted;
}

module.exports = {
  getApproversByDesignationService,
  upsertApproverSettingService,
  getAllApproverSettingsService,
  deleteApproverSettingService,
};
