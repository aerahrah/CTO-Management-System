const {
  getAllDesignationsService,
  getDesignationByIdService,
  createDesignationService,
  updateDesignationService,
  deleteDesignationService,
} = require("../services/designation.service");

/**
 * Get all designations
 */
const getAllDesignations = async (req, res) => {
  try {
    const designations = await getAllDesignationsService();
    res.status(200).json(designations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get designation by ID
 */
const getDesignationById = async (req, res) => {
  try {
    const { id } = req.params;
    const designation = await getDesignationByIdService(id);

    if (!designation) {
      return res.status(404).json({ message: "Designation not found." });
    }

    res.status(200).json(designation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Create designation
 */
const createDesignation = async (req, res) => {
  try {
    const newDesignation = await createDesignationService(req.body);
    res.status(201).json({
      message: "Designation created successfully.",
      data: newDesignation,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Update designation
 */
const updateDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateDesignationService(id, req.body);

    res.status(200).json({
      message: "Designation updated successfully.",
      data: updated,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

/**
 * Delete designation
 */
const deleteDesignation = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteDesignationService(id);

    res.status(200).json({
      message: "Designation deleted successfully.",
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAllDesignations,
  getDesignationById,
  createDesignation,
  updateDesignation,
  deleteDesignation,
};
