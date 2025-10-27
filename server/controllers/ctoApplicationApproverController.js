const {
  getCtoApplicationsForApproverService,
  approveCtoApplicationService,
  rejectCtoApplicationService,
} = require("../services/ctoApplicationApprover.service");

const getCtoApplicationsForApprover = async (req, res, next) => {
  try {
    const approverId = req.user.id;
    const data = await getCtoApplicationsForApproverService(approverId);
    console.log("hi");
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const approveCtoApplication = async (req, res, next) => {
  try {
    const approverId = req.user.id;
    const { applicationId } = req.params;
    const data = await approveCtoApplicationService({
      approverId,
      applicationId,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const rejectCtoApplication = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const approverId = req.user.id;
    const { remarks } = req.body;

    const result = await rejectCtoApplicationService({
      approverId,
      applicationId,
      remarks,
    });

    res.status(200).json({
      message: "CTO Application has been rejected successfully.",
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCtoApplicationsForApprover,
  approveCtoApplication,
  rejectCtoApplication,
};
