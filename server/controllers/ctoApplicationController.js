// controllers/ctoApplicationController.js
const {
  addCtoApplicationService,
  getAllCtoApplicationsService,
  getCtoApplicationsByEmployeeService,
  cancelCtoApplicationService,
  followUpCtoApplicationService,
  requestRevocationCtoApplicationService,
  processRevocationRequestService,
  getRevocationRequestsService,
  getCtoRevocationByIdService,
  cancelRevocationCtoRequestService,
} = require("../services/ctoApplication.service");

const addCtoApplicationRequest = async (req, res) => {
  try {
    const { requestedHours, reason, routeId, employeeType, commutation } =
      req.body;

    // ⚠️ CRITICAL: When using multer (multipart/form-data), complex objects
    // and arrays come in as JSON strings. We must parse them.
    const approvers =
      typeof req.body.approvers === "string"
        ? JSON.parse(req.body.approvers)
        : req.body.approvers;

    const inclusiveDates =
      typeof req.body.inclusiveDates === "string"
        ? JSON.parse(req.body.inclusiveDates)
        : req.body.inclusiveDates;

    const memos =
      typeof req.body.memos === "string"
        ? JSON.parse(req.body.memos)
        : req.body.memos;

    const certificationOfLeaveCredits =
      typeof req.body.certificationOfLeaveCredits === "string"
        ? JSON.parse(req.body.certificationOfLeaveCredits)
        : req.body.certificationOfLeaveCredits;

    const actionDetails =
      typeof req.body.actionDetails === "string"
        ? JSON.parse(req.body.actionDetails)
        : req.body.actionDetails;

    let lateFiling =
      typeof req.body.lateFiling === "string"
        ? JSON.parse(req.body.lateFiling)
        : req.body.lateFiling;

    // ✅ Map the Multer file into the lateFiling attachment object if it exists
    if (req.file) {
      if (!lateFiling) lateFiling = { isLateFiling: true };

      lateFiling.attachment = {
        fileName: req.file.originalname,
        fileUrl: req.file.path, // Use req.file.location if using S3/Cloudinary
        fileType: req.file.mimetype,
        uploadedAt: new Date(),
      };
    }

    const userId = req.user.id || req.user._id;

    const application = await addCtoApplicationService({
      userId,
      requestedHours,
      reason,
      routeId,
      approvers,
      inclusiveDates,
      memos,
      employeeType,
      commutation,
      certificationOfLeaveCredits,
      actionDetails,
      lateFiling,
    });

    res.status(201).json({
      message: "CTO application submitted successfully",
      application,
    });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

const getAllCtoApplicationsRequest = async (req, res) => {
  try {
    const { page, limit, status, from, to, search, employeeId, employeeType } =
      req.query;

    const result = await getAllCtoApplicationsService(
      { status, from, to, search, employeeId, employeeType },
      page,
      limit,
    );

    res.status(200).json({
      message: "Fetched CTO applications successfully",
      ...result,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Server error while fetching CTO applications",
    });
  }
};

const getCtoApplicationsByEmployeeRequest = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user.id || req.user._id;
    const { page, limit, status, from, to, search, employeeType } = req.query;

    const result = await getCtoApplicationsByEmployeeService(
      employeeId,
      page,
      limit,
      { status, from, to, search, employeeType },
    );

    res.status(200).json({
      message: "Fetched CTO applications successfully",
      ...result,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Server error while fetching CTO applications",
    });
  }
};

const getCtoRevocationByIdRequest = async (req, res) => {
  try {
    const applicationId = req.params.applicationId;
    const application = await getCtoRevocationByIdService(applicationId);

    res.status(200).json({
      message: "Fetched CTO revocation application successfully",
      ...application._doc,
      application,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Server error while fetching CTO application",
    });
  }
};

const cancelCtoApplicationRequest = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const applicationId = req.params.applicationId;

    const application = await cancelCtoApplicationService({
      userId,
      applicationId,
    });

    res.status(200).json({
      message: "CTO application cancelled successfully",
      application,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Server error while cancelling CTO application",
    });
  }
};

const followUpCtoApplicationRequest = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const applicationId = req.params.applicationId;

    const result = await followUpCtoApplicationService({
      userId,
      applicationId,
    });

    res.status(200).json({
      message: result.message,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Server error while sending follow-up",
    });
  }
};

const getRevocationRequestsController = async (req, res) => {
  try {
    const { page, limit, search, status, from, to, employeeType, employeeId } =
      req.query;

    const filters = { search, status, from, to, employeeType, employeeId };

    const result = await getRevocationRequestsService(filters, page, limit);

    res.status(200).json({
      message: "Revocation requests fetched successfully",
      ...result,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Server error while fetching revocation requests",
    });
  }
};

const requestRevocationController = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const applicationId = req.params.applicationId;

    const { reason } = req.body;

    let attachment = null;
    if (req.file) {
      attachment = {
        url: req.file.path,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };
    } else if (req.body.attachment) {
      attachment = req.body.attachment;
    }

    const application = await requestRevocationCtoApplicationService({
      userId,
      applicationId,
      reason,
      attachment,
    });

    res.status(200).json({
      message:
        "Revocation request submitted successfully. Awaiting HR approval.",
      application,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "Server error while requesting revocation",
    });
  }
};

const cancelRevocationController = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const applicationId = req.params.applicationId;

    const application = await cancelRevocationCtoRequestService({
      userId,
      applicationId,
    });

    res.status(200).json({
      message: "Revocation request cancelled successfully.",
      application,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error:
        error.message || "Server error while cancelling revocation request",
    });
  }
};

const processRevocationController = async (req, res) => {
  try {
    const adminId = req.user.id || req.user._id;
    const applicationId = req.params.applicationId;
    const { action, remarks } = req.body;

    const application = await processRevocationRequestService({
      adminId,
      applicationId,
      action,
      remarks,
    });

    const msg =
      action === "APPROVE"
        ? "Revocation approved. Credits restored."
        : "Revocation rejected. Leave remains approved.";

    res.status(200).json({
      message: msg,
      application,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      error:
        error.message || "Server error while processing revocation request",
    });
  }
};

module.exports = {
  addCtoApplicationRequest,
  getAllCtoApplicationsRequest,
  getCtoApplicationsByEmployeeRequest,
  getCtoRevocationByIdRequest,
  cancelCtoApplicationRequest,
  followUpCtoApplicationRequest,
  getRevocationRequestsController,
  requestRevocationController,
  cancelRevocationController,
  processRevocationController,
};
