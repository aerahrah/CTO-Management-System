const CtoApproverSetting = require("../models/ctoApproverSettingModel");
const Designation = require("../models/designationModel"); // changed
const Employee = require("../models/employeeModel");

/**
 * Get approvers by designation
 * @param {String} designationId - ObjectId of designation
 */
const getApproversByDesignationService = async (designationId) => {
  const approverSetting = await CtoApproverSetting.findOne({
    designation: designationId,
  })
    .populate("designation", "name")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position");

  return approverSetting;
};

/**
 * Create or update approver setting per designation
 * @param {Object} data - { designation, level1Approver, level2Approver, level3Approver }
 */
const upsertApproverSettingService = async (data) => {
  const { designation, level1Approver, level2Approver, level3Approver } = data;

  // Validate designation
  const designationExists = await Designation.findById(designation);
  if (!designationExists) throw new Error("Designation not found.");

  // Validate employee IDs
  const validateEmployee = async (employeeId, levelName) => {
    if (!employeeId) return null;
    const exists = await Employee.findById(employeeId);
    if (!exists) throw new Error(`Invalid ${levelName}: employee not found.`);
    return employeeId;
  };

  const validLevel1 = await validateEmployee(
    level1Approver,
    "Level 1 Approver"
  );
  const validLevel2 = await validateEmployee(
    level2Approver,
    "Level 2 Approver"
  );
  const validLevel3 = await validateEmployee(
    level3Approver,
    "Level 3 Approver"
  );

  // Upsert setting
  const setting = await CtoApproverSetting.findOneAndUpdate(
    { designation },
    {
      designation,
      level1Approver: validLevel1,
      level2Approver: validLevel2,
      level3Approver: validLevel3,
    },
    { new: true, upsert: true }
  )
    .populate("designation", "name")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position");

  return setting;
};

/**
 * Get all approver settings
 */
const getAllApproverSettingsService = async () => {
  const settings = await CtoApproverSetting.find()
    .populate("designation", "name")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position");

  return settings;
};

/**
 * Delete approver setting by ID
 * @param {String} id - CtoApproverSetting ObjectId
 */
const deleteApproverSettingService = async (id) => {
  const deleted = await CtoApproverSetting.findByIdAndDelete(id);
  if (!deleted) throw new Error("Approver setting not found.");
  return deleted;
};

module.exports = {
  getApproversByDesignationService,
  upsertApproverSettingService,
  getAllApproverSettingsService,
  deleteApproverSettingService,
};
