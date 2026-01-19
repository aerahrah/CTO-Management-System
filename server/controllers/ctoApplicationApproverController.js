const {
  getCtoApplicationsForApproverService,
  approveCtoApplicationService,
  rejectCtoApplicationService,
} = require("../services/ctoApplicationApprover.service");

const getCtoApplicationsForApprover = async (req, res, next) => {
  try {
    const approverId = req.user.id;

    // Get query params
    const { search = "", page = 1, limit = 10 } = req.query;

    // Allowed limits
    const allowedLimits = [10, 20, 50, 100];
    const parsedLimit = allowedLimits.includes(Number(limit))
      ? Number(limit)
      : 10;
    const parsedPage = Number(page) > 0 ? Number(page) : 1;

    const result = await getCtoApplicationsForApproverService(
      approverId,
      search,
      parsedPage,
      parsedLimit
    );

    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: parsedPage,
      totalPages: result.totalPages,
    });
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
