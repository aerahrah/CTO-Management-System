// controllers/wellnessApplicationController.js
const {
  addWellnessApplicationService,
  getAllWellnessApplicationsService,
  getWellnessApplicationsByEmployeeService,
  cancelWellnessApplicationService,
  followUpWellnessApplicationService,
  requestRevocationWellnessApplicationService,
  processRevocationWellnessRequestService,
  getRevocationRequestsService,
  getWellnessRevocationByIdService,
  cancelRevocationWellnessRequestService, // ✅ Imported the new cancel service
} = require("../services/wellnessApplicationService");

/* =========================
   Controllers
========================= */

const addWellnessApplicationRequest = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;

    // ✅ Safely parse lateFiling if it arrives as a JSON string via FormData
    let parsedLateFiling = req.body.lateFiling;
    if (typeof parsedLateFiling === "string") {
      try {
        parsedLateFiling = JSON.parse(parsedLateFiling);
      } catch (e) {
        console.warn("Could not parse lateFiling string");
      }
    }

    // ✅ Attach the uploaded file to the lateFiling object if present
    if (parsedLateFiling && String(parsedLateFiling.isLateFiling) === "true") {
      if (req.file) {
        parsedLateFiling.attachment = {
          fileUrl: req.file.path.replace(/\\/g, "/"), // Normalize path for Windows/Linux
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
        };
      }
    }

    // ✅ Safely parse inclusiveDates if it arrives as a JSON string via FormData
    let parsedInclusiveDates = req.body.inclusiveDates;
    if (typeof parsedInclusiveDates === "string") {
      try {
        parsedInclusiveDates = JSON.parse(parsedInclusiveDates);
      } catch (e) {
        // Fallback if it's just a single date string
        parsedInclusiveDates = [req.body.inclusiveDates];
      }
    }

    // ✅ Safely parse memos or approvers if necessary (standard FormData handling)
    let parsedApprovers = req.body.approvers;
    if (typeof parsedApprovers === "string") {
      try {
        parsedApprovers = JSON.parse(parsedApprovers);
      } catch (e) {
        console.warn("Could not parse approvers string");
      }
    }

    const payload = {
      ...req.body,
      userId,
      inclusiveDates: parsedInclusiveDates || req.body.inclusiveDates,
      approvers: parsedApprovers || req.body.approvers,
      lateFiling: parsedLateFiling, // ✅ Inject the structured lateFiling object
    };

    const application = await addWellnessApplicationService(payload);

    res.status(201).json({
      success: true,
      message: "Wellness Leave application submitted successfully",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

const getAllWellnessApplicationsRequest = async (req, res, next) => {
  try {
    // ✅ Extract employeeType here so frontend filters work
    const { status, from, to, search, employeeId, employeeType, page, limit } =
      req.query;

    /* 
      ✅ REMOVED THE VISIBILITY SHIELD:
      This was silently forcing `data: []` if the user wasn't the global approver.
      Now it behaves exactly like CTO and trusts your route middleware.
    */

    const result = await getAllWellnessApplicationsService(
      { status, from, to, search, employeeId, employeeType },
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

const getWellnessApplicationsByEmployeeRequest = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.user.id || req.user._id;

    // ✅ Extract employeeType
    const {
      page = 1,
      limit = 20,
      status,
      search,
      from,
      to,
      employeeType,
    } = req.query;

    const result = await getWellnessApplicationsByEmployeeService(
      employeeId,
      page,
      limit,
      {
        status,
        search,
        from,
        to,
        employeeType, // ✅ Pass it to the service
      },
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

const getWellnessRevocationByIdRequest = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const application = await getWellnessRevocationByIdService(applicationId);

    res.status(200).json({
      success: true,
      message: "Fetched Wellness revocation application successfully",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

const cancelWellnessApplicationRequest = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const userId = req.user.id || req.user._id;

    const application = await cancelWellnessApplicationService({
      userId,
      applicationId,
    });

    res.status(200).json({
      success: true,
      message: "Wellness Leave application cancelled successfully",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

const followUpWellnessApplicationRequest = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const userId = req.user.id || req.user._id;

    const result = await followUpWellnessApplicationService({
      userId,
      applicationId,
    });

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

const requestRevocationWellnessController = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const applicationId = req.params.id;
    const { reason } = req.body;

    let attachment = null;
    if (req.file) {
      attachment = {
        url: req.file.path.replace(/\\/g, "/"),
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
      };
    } else if (req.body.attachment) {
      attachment = req.body.attachment;
    }

    const application = await requestRevocationWellnessApplicationService({
      userId,
      applicationId,
      reason,
      attachment,
    });

    res.status(200).json({
      success: true,
      message:
        "Revocation request submitted successfully. Awaiting HR approval.",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

const processRevocationWellnessController = async (req, res, next) => {
  try {
    const adminId = req.user.id || req.user._id;
    const applicationId = req.params.id;
    const { action, remarks } = req.body;

    const application = await processRevocationWellnessRequestService({
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
      success: true,
      message: msg,
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

const getRevocationRequestsController = async (req, res, next) => {
  try {
    // ✅ Extract employeeType here
    const { status, from, to, search, employeeId, employeeType, page, limit } =
      req.query;

    /* 
      ✅ REMOVED THE VISIBILITY SHIELD:
      This was silently forcing `data: []` because it demanded a specific `globalApprover` ID.
    */

    const result = await getRevocationRequestsService(
      { status, from, to, search, employeeId, employeeType }, // ✅ Passed employeeType
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

// ✅ NEW: Controller to cancel a pending revocation request
const cancelRevocationWellnessController = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const userId = req.user.id || req.user._id;

    const application = await cancelRevocationWellnessRequestService({
      userId,
      applicationId,
    });

    res.status(200).json({
      success: true,
      message: "Revocation request cancelled successfully.",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addWellnessApplicationRequest,
  getAllWellnessApplicationsRequest,
  getWellnessApplicationsByEmployeeRequest,
  getWellnessRevocationByIdRequest,
  cancelWellnessApplicationRequest,
  followUpWellnessApplicationRequest,
  requestRevocationWellnessController,
  processRevocationWellnessController,
  getRevocationRequestsController,
  cancelRevocationWellnessController, // ✅ Exported the new controller
};
