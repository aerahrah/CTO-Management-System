// controllers/ctoCredit.controller.js
const ctoCreditService = require("../services/ctoCredit.service");

const fs = require("fs");
const path = require("path");

const addCtoCreditRequest = async (req, res) => {
  try {
    const { employees, duration, memoNo, dateApproved } = req.body;
    const userId = req.user.id;

    let filePath = req.file?.path;

    if (filePath) {
      const extension = path.extname(req.file.originalname);
      const cleanMemoNo = memoNo
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "");
      const cleanDate = dateApproved.replace(/-/g, "");
      const newFileName = `${cleanMemoNo}_${cleanDate}${extension}`;
      const newPath = path.join(path.dirname(filePath), newFileName);
      fs.renameSync(filePath, newPath);
      filePath = newPath;
    }

    const employeesArray = JSON.parse(employees);
    const durationObj = JSON.parse(duration);

    const creditRequest = await ctoCreditService.addCredit({
      employees: employeesArray,
      duration: durationObj,
      memoNo,
      dateApproved,
      userId,
      filePath,
    });

    res.status(201).json({
      message: "CTO credit request created",
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

const getAllCreditRequests = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;

    const credits = await ctoCreditService.getAllCredits({
      page,
      limit,
      search,
      filters: { status },
    });

    res.json({
      message: "Showing credit requests",
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      total: credits.totalCount,
      credits: credits.items,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getEmployeeCredits = async (req, res) => {
  try {
    const employeeId = req.params.employeeId || req.user.id;
    const { search, status, page, limit } = req.query;

    const result = await ctoCreditService.getEmployeeCredits(employeeId, {
      search,
      filters: { status },
      page,
      limit,
    });

    res.json({
      message: "Employee credits fetched successfully",
      employeeId,
      ...result,
    });
  } catch (error) {
    console.error("Controller error:", error.message);
    res.status(400).json({ message: error.message });
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
  addCtoCreditRequest,
  rollbackCreditedRequest,
  getAllCreditRequests,
  getEmployeeDetails,
  getEmployeeCredits,
};
