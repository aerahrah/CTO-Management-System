const {
  addCtoApplicationService,
  getMyCtoApplicationsService,
} = require("../services/ctoApplication.service");

const addCtoApplicationRequest = async (req, res) => {
  try {
    const {
      requestedHours,
      reason,
      level1Approver,
      level2Approver,
      level3Approver,
    } = req.body;
    const userId = req.user.id;

    const application = await addCtoApplicationService({
      userId,
      requestedHours,
      reason,
      level1Approver,
      level2Approver,
      level3Approver,
    });

    res.status(201).json({
      message: "CTO application submitted successfully",
      application,
    });
  } catch (error) {
    console.error("Error applying CTO:", error);
    const status = error.status || 500;
    res
      .status(status)
      .json({ error: error.message || "Server error while applying CTO" });
  }
};

const getMyCtoApplicationsRequest = async (req, res) => {
  try {
    const userId = req.user.id;

    const applications = await getMyCtoApplicationsService(userId);

    res.status(200).json({
      message: "Fetched CTO applications successfully",
      count: applications.length,
      applications,
    });
  } catch (error) {
    console.error("Error fetching CTO applications:", error);
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || "Server error while fetching CTO applications",
    });
  }
};

module.exports = {
  addCtoApplicationRequest,
  getMyCtoApplicationsRequest,
};
