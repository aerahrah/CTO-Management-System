const Role = require("../models/roleModel");
const Employee = require("../models/employeeModel");

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ createdAt: 1 });
    res.json(roles);
  } catch (error) {
    next(error);
  }
};

const getRoleById = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) throw httpError("Role not found", 404);
    res.json(role);
  } catch (error) {
    next(error);
  }
};

const createRole = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;
    
    if (!name) throw httpError("Role name is required", 400);

    const existingRole = await Role.findOne({ name });
    if (existingRole) throw httpError("Role with this name already exists", 409);

    const role = new Role({
      name,
      description,
      permissions: permissions || [],
      isSystem: false,
    });

    await role.save();
    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
};

const updateRole = async (req, res, next) => {
  try {
    const { name, description, permissions } = req.body;
    const role = await Role.findById(req.params.id);

    if (!role) throw httpError("Role not found", 404);

    if (role.isSystem && name && name !== role.name) {
      throw httpError("Cannot rename a system role", 403);
    }

    if (name && name !== role.name) {
      const existingRole = await Role.findOne({ name });
      if (existingRole) throw httpError("Role with this name already exists", 409);
      role.name = name;
    }

    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;

    await role.save();
    res.json(role);
  } catch (error) {
    next(error);
  }
};

const deleteRole = async (req, res, next) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) throw httpError("Role not found", 404);

    if (role.isSystem) {
      throw httpError("Cannot delete a system role", 403);
    }

    // Check if any employees are using this role
    const usersWithRole = await Employee.countDocuments({ role: role._id });
    if (usersWithRole > 0) {
      throw httpError(`Cannot delete role. It is assigned to ${usersWithRole} employees.`, 409);
    }

    await Role.findByIdAndDelete(req.params.id);
    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
};
