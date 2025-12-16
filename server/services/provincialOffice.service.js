const ProvincialOffice = require("../models/provincialOfficeModel");

const getAllProvincialOfficesService = async () => {
  return await ProvincialOffice.find().sort({ province: 1 });
};

const getProvincialOfficeByIdService = async (id) => {
  return await ProvincialOffice.findById(id);
};

const createProvincialOfficeService = async (data) => {
  const { name, province, region } = data;

  const newOffice = new ProvincialOffice({ name, province, region });
  return await newOffice.save();
};

const updateProvincialOfficeService = async (id, data) => {
  const updated = await ProvincialOffice.findByIdAndUpdate(id, data, {
    new: true,
  });
  if (!updated) throw new Error("Provincial office not found.");
  return updated;
};

const deleteProvincialOfficeService = async (id) => {
  const deleted = await ProvincialOffice.findByIdAndDelete(id);
  if (!deleted) throw new Error("Provincial office not found.");
  return deleted;
};

module.exports = {
  getAllProvincialOfficesService,
  getProvincialOfficeByIdService,
  createProvincialOfficeService,
  updateProvincialOfficeService,
  deleteProvincialOfficeService,
};
