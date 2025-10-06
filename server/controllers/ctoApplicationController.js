const {
  addCtoApplicationService,
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

module.exports = {
  addCtoApplicationRequest,
};
