// controllers/wellnessApplicationApproverController.js
const {
  fetchPendingWellnessCountService,
  getWellnessApplicationsForApproverService,
  getWellnessApplicationByIdService,
  approveWellnessApplicationService,
  rejectWellnessApplicationService,
} = require("../services/wellnessApplicationApproval.service");

const getPendingCountForWellnessApproverController = async (req, res, next) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) return res.status(401).json({ message: "Unauthorized" });

    const pendingCount = await fetchPendingWellnessCountService(approverId);
    return res.status(200).json({ pending: pendingCount });
  } catch (err) {
    return next(err);
  }
};

const getWellnessApplicationsForApprover = async (req, res, next) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) return res.status(401).json({ message: "Unauthorized" });

    const { search = "", status = "", page = 1, limit = 10 } = req.query;

    const allowedLimits = [10, 20, 50, 100];
    const parsedLimit = allowedLimits.includes(Number(limit))
      ? Number(limit)
      : 10;
    const parsedPage = Number(page) > 0 ? Number(page) : 1;

    const result = await getWellnessApplicationsForApproverService(
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

const getWellnessApplicationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await getWellnessApplicationByIdService(id);

    return res.status(200).json({
      success: true,
      data: application,
    });
  } catch (err) {
    return next(err);
  }
};

const approveWellnessApplication = async (req, res, next) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) return res.status(401).json({ message: "Unauthorized" });

    const { applicationId } = req.params;

    const data = await approveWellnessApplicationService({
      approverId,
      applicationId,
      req,
    });

    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

const rejectWellnessApplication = async (req, res, next) => {
  try {
    const approverId = req.user?.id;
    if (!approverId) return res.status(401).json({ message: "Unauthorized" });

    const { applicationId } = req.params;
    const { remarks } = req.body;

    const result = await rejectWellnessApplicationService({
      approverId,
      applicationId,
      remarks,
      req,
    });

    return res.status(200).json({
      message: "Wellness Application has been rejected successfully.",
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getPendingCountForWellnessApproverController,
  getWellnessApplicationsForApprover,
  getWellnessApplicationById,
  approveWellnessApplication,
  rejectWellnessApplication,
};
