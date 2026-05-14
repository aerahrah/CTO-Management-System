const {
  addWellnessApplicationService,
  getAllWellnessApplicationsService,
  getWellnessApplicationsByEmployeeService,
  cancelWellnessApplicationService,
} = require("../services/wellnessApplicationService"); // Adjust path if necessary

/* =========================
   Controllers
========================= */

const addWellnessApplicationRequest = async (req, res, next) => {
  try {
    // Assuming authenticateToken middleware attaches user info to req.user
    const userId = req.user.id || req.user._id;
    const payload = { ...req.body, userId };

    const application = await addWellnessApplicationService(payload);

    res.status(201).json({
      success: true,
      message: "Wellness Leave application submitted successfully",
      data: application,
    });
  } catch (error) {
    next(error); // Passes to your global error handler in server.js
  }
};

const getAllWellnessApplicationsRequest = async (req, res, next) => {
  try {
    // Extract query parameters for the advanced aggregation filtering
    const { status, from, to, search, employeeId, page, limit } = req.query;

    const result = await getAllWellnessApplicationsService(
      { status, from, to, search, employeeId },
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      ...result, // Spreads data, pagination, and statusCounts from the service
    });
  } catch (error) {
    next(error);
  }
};

const getWellnessApplicationsByEmployeeRequest = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.user.id;

    const { page = 1, limit = 20, status, search, from, to } = req.query;

    const result = await getWellnessApplicationsByEmployeeService(
      employeeId,
      page,
      limit,
      {
        status,
        search,
        from,
        to,
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

const cancelWellnessApplicationRequest = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const userId = req.user.id || req.user._id; // Ensure only the owner can cancel

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

module.exports = {
  addWellnessApplicationRequest,
  getAllWellnessApplicationsRequest,
  getWellnessApplicationsByEmployeeRequest,
  cancelWellnessApplicationRequest,
};
