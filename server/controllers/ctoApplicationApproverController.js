const {
  getCtoApplicationsForApproverService,
  approveCtoApplicationService,
  rejectCtoApplicationService,
  getCtoApplicationByIdService,
  getApproverOptionsService,
} = require("../services/ctoApplicationApprover.service");

const getApproverOptions = async (req, res) => {
  try {
    const data = await getApproverOptionsService();

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("Failed to fetch approver options:", err);
    res.status(500).json({
      success: false,
      message: "Failed to load approver options",
    });
  }
};

const getCtoApplicationsForApprover = async (req, res, next) => {
  try {
    const approverId = req.user.id;

    const {
      search = "",
      status = "", // ✅ ADDED
      page = 1,
      limit = 10,
    } = req.query;

    const allowedLimits = [10, 20, 50, 100];
    const parsedLimit = allowedLimits.includes(Number(limit))
      ? Number(limit)
      : 10;
    const parsedPage = Number(page) > 0 ? Number(page) : 1;

    const result = await getCtoApplicationsForApproverService(
      approverId,
      search,
      status,
      parsedPage,
      parsedLimit,
    );

    res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: parsedPage,
      totalPages: result.totalPages,
      statusCounts: result.statusCounts,
    });
  } catch (err) {
    next(err);
  }
};

const getCtoApplicationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await getCtoApplicationByIdService(id);

    res.status(200).json({
      success: true,
      data: application,
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
  getApproverOptions,
  getCtoApplicationsForApprover,
  getCtoApplicationById,
  approveCtoApplication,
  rejectCtoApplication,
};
