const ctoApproverSettingService = require("../services/ctoApproverSetting.service");

// Get approvers by designation
exports.getApproversByDesignation = async (req, res) => {
  try {
    const { designationId } = req.params;
    console.log(designationId);
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

    res.json({
      show: true,
      data: approverSetting,
    });
  } catch (error) {
    console.error("Error fetching approver settings:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Create or update (upsert)
exports.upsertApproverSetting = async (req, res) => {
  try {
    const setting =
      await ctoApproverSettingService.upsertApproverSettingService(req.body);
    res.json({ message: "CTO approver setting saved successfully.", setting });
  } catch (error) {
    console.error("Error saving approver setting:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all approver settings
exports.getAllApproverSettings = async (req, res) => {
  try {
    const settings =
      await ctoApproverSettingService.getAllApproverSettingsService();
    res.json(settings);
  } catch (error) {
    console.error("Error fetching all approver settings:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete approver setting
exports.deleteApproverSetting = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted =
      await ctoApproverSettingService.deleteApproverSettingService(id);
    res.json({ message: "Approver setting deleted successfully.", deleted });
  } catch (error) {
    console.error("Error deleting approver setting:", error);
    res.status(500).json({ message: "Server error" });
  }
};
