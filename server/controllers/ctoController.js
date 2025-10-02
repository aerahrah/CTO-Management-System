// controllers/ctoCredit.controller.js
const ctoCreditService = require("../services/ctoCredit.service");
const { applyCtoService } = require("../services/ctoCredit.service");

const addCreditRequest = async (req, res) => {
  try {
    const { employees, duration, memoNo, dateApproved } = req.body;
    const userId = req.user.id;

    const creditRequest = await ctoCreditService.addCredit({
      employees,
      duration,
      memoNo,
      dateApproved,
      userId,
      filePath: req.file?.path,
    });

    res.status(201).json({
      message: "CTO credit request created and credited",
      creditRequest,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const rollbackCreditedRequest = async (req, res) => {
  try {
    const { creditId } = req.params;
    const userId = req.user.id;

    const credit = await ctoCreditService.rollbackCredit({ creditId, userId });

    res.json({
      message: "CTO credit rolled back and employee balances updated",
      credit,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getRecentCreditRequests = async (req, res) => {
  try {
    const credits = await ctoCreditService.getRecentCredits();
    res.json({ message: "Showing recent 10 credit requests", credits });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAllCreditRequests = async (req, res) => {
  try {
    const credits = await ctoCreditService.getAllCredits();
    res.json({ message: "Showing all credit requests", credits });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEmployeeDetails = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await ctoCreditService.getEmployeeDetails(employeeId);

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.json({ message: "Employee fetched", employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEmployeeCredits = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const creditRequests = await ctoCreditService.getEmployeeCredits(
      employeeId
    );

    res.json({
      message: "Employee credits fetched successfully",
      employeeId,
      creditRequests,
      totalCredits: creditRequests.length,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const applyCto = async (req, res) => {
  try {
    const { requestedHours, reason, approvers } = req.body;

    // ✅ Use the logged-in user's ID
    const employeeId = req.user.id;

    const application = await applyCtoService({
      employeeId,
      requestedHours,
      reason,
      approvers,
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

// const addCreditRequestWithApprover = async (req, res) => {
//   try {
//     const { employees, hours, memoNo, approver } = req.body;

//     const creditRequest = await ctoCreditService.createCreditRequest({
//       employees,
//       hours,
//       memoNo,
//       approver,
//       filePath: req.file?.path,
//     });

//     res
//       .status(201)
//       .json({ message: "CTO credit request created", creditRequest });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// const handleApproveOrRejectCredit = async (req, res) => {
//   try {
//     const { creditId } = req.params;
//     const { decision, remarks } = req.body;
//     const userId = req.user.id;

//     const credit = await ctoCreditService.approveOrRejectCredit({
//       creditId,
//       decision,
//       remarks,
//       userId,
//     });

//     res.json({
//       message: `CTO credit ${decision.toLowerCase()}ed successfully`,
//       credit,
//     });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

// const handleCancelCreditRequest = async (req, res) => {
//   try {
//     const { creditId } = req.params;
//     const userId = req.user.id;

//     const credit = await ctoCreditService.cancelCreditRequest({
//       creditId,
//       userId,
//     });

//     res.json({
//       message: "CTO credit request canceled",
//       credit,
//     });
//   } catch (error) {
//     res.status(400).json({ message: error.message });
//   }
// };

module.exports = {
  addCreditRequest,
  rollbackCreditedRequest,
  getRecentCreditRequests,
  getAllCreditRequests,
  getEmployeeDetails,
  getEmployeeCredits,
  applyCto,
};
