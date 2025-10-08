const CtoApproverSetting = require("../models/ctoApproverSettingModel");
const ProvincialOffice = require("../models/provincialOfficeModel");
const Employee = require("../models/employeeModel");

const getApproversByProvincialOfficeService = async (provincialOfficeId) => {
  const approverSetting = await CtoApproverSetting.findOne({
    provincialOffice: provincialOfficeId,
  })
    .populate("provincialOffice", "name code province")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position");

  return approverSetting;
};

const upsertApproverSettingService = async (data) => {
  const { provincialOffice, level1Approver, level2Approver, level3Approver } =
    data;

  const officeExists = await ProvincialOffice.findById(provincialOffice);
  if (!officeExists) throw new Error("Provincial office not found.");

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

  const setting = await CtoApproverSetting.findOneAndUpdate(
    { provincialOffice },
    {
      provincialOffice,
      level1Approver: validLevel1,
      level2Approver: validLevel2,
      level3Approver: validLevel3,
    },
    { new: true, upsert: true }
  )
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position")
    .populate("provincialOffice", "name");

  return setting;
};

const getAllApproverSettingsService = async () => {
  const settings = await CtoApproverSetting.find()
    .populate("provincialOffice", "name code province")
    .populate("level1Approver", "firstName lastName position")
    .populate("level2Approver", "firstName lastName position")
    .populate("level3Approver", "firstName lastName position");

  return settings;
};

const deleteApproverSettingService = async (id) => {
  const deleted = await CtoApproverSetting.findByIdAndDelete(id);
  if (!deleted) throw new Error("Approver setting not found.");
  return deleted;
};

module.exports = {
  getApproversByProvincialOfficeService,
  upsertApproverSettingService,
  getAllApproverSettingsService,
  deleteApproverSettingService,
};
