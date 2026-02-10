const ctoApproverSettingService = require("../services/ctoApproverSetting.service");

function sendError(res, err) {
  const status = err.statusCode || 500;
  return res.status(status).json({
    message: err.message || "Server error",
  });
}

// Get approvers by designation
exports.getApproversByDesignation = async (req, res) => {
  try {
    const { designationId } = req.params;

    const approverSetting =
      await ctoApproverSettingService.getApproversByDesignationService(
        designationId,
      );

    if (!approverSetting) {
      return res.json({
        show: false,
        message: "No approver setting found for this designation.",
      });
    }

    return res.json({
      show: true,
      data: approverSetting,
    });
  } catch (error) {
    console.error("Error fetching approver settings:", error);
    return sendError(res, error);
  }
};

// Create or update (upsert)
exports.upsertApproverSetting = async (req, res) => {
  try {
    const setting =
      await ctoApproverSettingService.upsertApproverSettingService(req.body);

    return res.json({
      message: "CTO approver setting saved successfully.",
      setting,
    });
  } catch (error) {
    console.error("Error saving approver setting:", error);
    return sendError(res, error);
  }
};

// Get all approver settings
exports.getAllApproverSettings = async (req, res) => {
  try {
    const settings =
      await ctoApproverSettingService.getAllApproverSettingsService();
    return res.json(settings);
  } catch (error) {
    console.error("Error fetching all approver settings:", error);
    return sendError(res, error);
  }
};

// Delete approver setting
exports.deleteApproverSetting = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted =
      await ctoApproverSettingService.deleteApproverSettingService(id);

    return res.json({
      message: "Approver setting deleted successfully.",
      deleted,
    });
  } catch (error) {
    console.error("Error deleting approver setting:", error);
    return sendError(res, error);
  }
};
