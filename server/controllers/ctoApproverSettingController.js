const ctoApproverSettingService = require("../services/ctoApproverSetting.service");

// Get approvers by provincial office
exports.getApproversByProvincialOffice = async (req, res) => {
  try {
    const { provincialOfficeId } = req.params;
    const approverSetting =
      await ctoApproverSettingService.getApproversByProvincialOfficeService(
        provincialOfficeId
      );

    if (!approverSetting) {
      return res.status(404).json({
        message: "No approver setting found for this provincial office.",
      });
    }

    res.json(approverSetting);
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

// Get all
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

// Delete
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
