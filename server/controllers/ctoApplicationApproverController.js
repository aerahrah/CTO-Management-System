// controllers/ctoApplicationApproverController.js
const {
  getCtoApplicationsForApproverService,
  approveCtoApplicationService,
  rejectCtoApplicationService,
  getCtoApplicationByIdService,
  getApproverOptionsService,
  fetchPendingCtoCountService,
} = require("../services/ctoApplicationApprover.service");

const getPendingCountForApproverController = async (req, res, next) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) return res.status(401).json({ message: "Unauthorized" });

    const pendingCount = await fetchPendingCtoCountService(approverId);
    return res.status(200).json({ pending: pendingCount });
  } catch (err) {
    return next(err);
  }
};

const getApproverOptions = async (req, res) => {
  try {
    const data = await getApproverOptionsService();

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("Failed to fetch approver options:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load approver options",
    });
  }
};

const getCtoApplicationsForApprover = async (req, res, next) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) return res.status(401).json({ message: "Unauthorized" });

    const { search = "", status = "", page = 1, limit = 10 } = req.query;

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

    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
      page: parsedPage,
      totalPages: result.totalPages,
      statusCounts: result.statusCounts,
    });
  } catch (err) {
    return next(err);
  }
};

const getCtoApplicationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await getCtoApplicationByIdService(id);

    return res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    return next(err);
  }
};

const approveCtoApplication = async (req, res, next) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) return res.status(401).json({ message: "Unauthorized" });

    const { applicationId } = req.params;

    const data = await approveCtoApplicationService({
      approverId,
      applicationId,
      req,
    });

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

const rejectCtoApplication = async (req, res, next) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) return res.status(401).json({ message: "Unauthorized" });

    const { applicationId } = req.params;
    const { remarks } = req.body;

    const result = await rejectCtoApplicationService({
      approverId,
      applicationId,
      remarks,
      req,
    });

    return res.status(200).json({
      message: "CTO Application has been rejected successfully.",
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getPendingCountForApproverController,
  getApproverOptions,
  getCtoApplicationsForApprover,
  getCtoApplicationById,
  approveCtoApplication,
  rejectCtoApplication,
};
