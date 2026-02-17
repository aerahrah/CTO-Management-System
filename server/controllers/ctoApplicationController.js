const {
  addCtoApplicationService,
  getAllCtoApplicationsService,
  getCtoApplicationsByEmployeeService,
  cancelCtoApplicationService,
} = require("../services/ctoApplication.service");

const addCtoApplicationRequest = async (req, res) => {
  try {
    const {
      requestedHours,
      reason,
      approver1,
      approver2,
      approver3,
      inclusiveDates,
      memos,
    } = req.body;

    const userId = req.user.id;

    const application = await addCtoApplicationService({
      userId,
      requestedHours,
      reason,
      approvers: [approver1, approver2, approver3],
      inclusiveDates,
      memos,
    });

    res.status(201).json({
      message: "CTO application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("Error applying CTO:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
};

const getAllCtoApplicationsRequest = async (req, res) => {
  try {
    const { page, limit, status, from, to, search, employeeId } = req.query;

    const result = await getAllCtoApplicationsService(
      { status, from, to, search, employeeId },
      page,
      limit,
    );

    res.status(200).json({
      message: "Fetched CTO applications successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error fetching CTO applications:", error);
    res.status(error.status || 500).json({
      error: error.message || "Server error while fetching CTO applications",
    });
  }
};

const getCtoApplicationsByEmployeeRequest = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user.id;
    const { page, limit, status, from, to, search } = req.query;

    const result = await getCtoApplicationsByEmployeeService(
      employeeId,
      page,
      limit,
      { status, from, to, search },
    );

    res.status(200).json({
      message: "Fetched CTO applications successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error fetching CTO applications:", error);
    res.status(error.status || 500).json({
      error: error.message || "Server error while fetching CTO applications",
    });
  }
};

/**
 * ✅ Cancel CTO application (employee-initiated)
 * Route suggestion: PATCH /cto/applications/:id/cancel
 */
const cancelCtoApplicationRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const applicationId = req.params.id;

    const application = await cancelCtoApplicationService({
      userId,
      applicationId,
    });

    res.status(200).json({
      message: "CTO application cancelled successfully",
      application,
    });
  } catch (error) {
    console.error("Error cancelling CTO application:", error);
    res.status(error.status || 500).json({
      error: error.message || "Server error while cancelling CTO application",
    });
  }
};

module.exports = {
  addCtoApplicationRequest,
  getAllCtoApplicationsRequest,
  getCtoApplicationsByEmployeeRequest,
  cancelCtoApplicationRequest,
};
