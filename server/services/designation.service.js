const Designation = require("../models/designationModel");

/**
 * Get all designations
 */
const getAllDesignationsService = async () => {
  return await Designation.find().sort({ name: 1 });
};

/**
 * Get designation by ID
 */
const getDesignationByIdService = async (id) => {
  return await Designation.findById(id);
};

/**
 * Create new designation
 */
const createDesignationService = async (data) => {
  const { name, department, level } = data;

  const newDesignation = new Designation({
    name,
    department,
    level,
  });

  return await newDesignation.save();
};

/**
 * Update designation
 */
const updateDesignationService = async (id, data) => {
  const updated = await Designation.findByIdAndUpdate(id, data, {
    new: true,
  });

  if (!updated) throw new Error("Designation not found.");
  return updated;
};

/**
 * Delete designation
 */
const deleteDesignationService = async (id) => {
  const deleted = await Designation.findByIdAndDelete(id);

  if (!deleted) throw new Error("Designation not found.");
  return deleted;
};

module.exports = {
  getAllDesignationsService,
  getDesignationByIdService,
  createDesignationService,
  updateDesignationService,
  deleteDesignationService,
};
