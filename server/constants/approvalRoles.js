// constants/approvalRoles.js

const APPROVAL_ROLES = {
  RECOMMENDING_APPROVAL_INITIAL: "Recommending Approval Initial",
  RECOMMENDING_APPROVAL: "Recommending Approval",

  AFD_SIGNATURE: "AFD Chief Signature",
  ARD_INITIAL: "ARD Initial",
  ARD_SIGNATURE: "ARD Signature",
  RD_SIGNATURE: "Regional Director Signature",
  HR_INITIAL: "HR Initial",
};

// Extracted array of just the string values for Mongoose enum validation
const APPROVAL_ROLE_VALUES = Object.values(APPROVAL_ROLES);

// Optional: A map of roles to their descriptions if you need to serve this to the frontend
const APPROVAL_ROLE_DESCRIPTIONS = {
  [APPROVAL_ROLES.RECOMMENDING_APPROVAL_INITIAL]:
    "Initial signature of recommending approval.",
  [APPROVAL_ROLES.RECOMMENDING_APPROVAL]:
    "Final signature of recommending  approval.",
  [APPROVAL_ROLES.AFD_SIGNATURE]: "Signature for Finance/Admin operations.",
  [APPROVAL_ROLES.ARD_INITIAL]: "Initial by the Assistant Regional Director.",
  [APPROVAL_ROLES.ARD_SIGNATURE]:
    "Final signature  by the Assistant Regional Director.",
  [APPROVAL_ROLES.RD_SIGNATURE]: "Final signature  by the Regional Director.",
  [APPROVAL_ROLES.HR_INITIAL]: "Initial check by Human Resources.",
};

module.exports = {
  APPROVAL_ROLES,
  APPROVAL_ROLE_VALUES,
  APPROVAL_ROLE_DESCRIPTIONS,
};
