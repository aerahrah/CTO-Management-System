const {
  getAllProvincialOfficesService,
  getProvincialOfficeByIdService,
  createProvincialOfficeService,
  updateProvincialOfficeService,
  deleteProvincialOfficeService,
} = require("../services/provincialOffice.service");

const getAllProvincialOffices = async (req, res) => {
  try {
    const offices = await getAllProvincialOfficesService();
    res.json(offices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getProvincialOfficeById = async (req, res) => {
  try {
    const { id } = req.params;
    const office = await getProvincialOfficeByIdService(id);

    if (!office)
      return res.status(404).json({ message: "Provincial office not found." });

    res.json(office);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProvincialOffice = async (req, res) => {
  try {
    const newOffice = await createProvincialOfficeService(req.body);
    res
      .status(201)
      .json({ message: "Provincial office created successfully.", newOffice });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateProvincialOffice = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateProvincialOfficeService(id, req.body);
    res.json({ message: "Provincial office updated successfully.", updated });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteProvincialOffice = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteProvincialOfficeService(id);
    res.json({ message: "Provincial office deleted successfully." });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAllProvincialOffices,
  getProvincialOfficeById,
  createProvincialOffice,
  updateProvincialOffice,
  deleteProvincialOffice,
};
