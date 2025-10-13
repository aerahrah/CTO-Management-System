const {
  getCtoApplicationsForApproverService,
} = require("../services/ctoApplicationApprover.service");

const getCtoApplicationsForApprover = async (req, res, next) => {
  try {
    const approverId = req.user.id;
    const data = await getCtoApplicationsForApproverService(approverId);
    console.log("hi");
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCtoApplicationsForApprover,
};
