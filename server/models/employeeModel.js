const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      trim: true,
    },

    password: {
      type: String,

      required: function () {
        return this.isNew;
      },

      // ✅ Prevent password from being returned in queries
      select: false,

      // ✅ Minimum password length
      minlength: 8,

      validate: {
        validator: function (value) {
          // Must contain:
          // 1 uppercase
          // 1 lowercase
          // 1 number
          // 1 special character
          return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&()[\]{}\-_=+<>]).+$/.test(
            value,
          );
        },

        message:
          "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.",
      },
    },

    // ✅ NEW: set to true after an admin reset; cleared when the user changes it
    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    // ✅ NEW: tokens issued before this time are rejected by the auth middleware
    passwordChangedAt: {
      type: Date,
      default: null,
    },

    // ✅ NEW: audit fields for admin-initiated resets
    passwordResetBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    passwordResetAt: {
      type: Date,
      default: null,
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
      required: false,
    },

    // ✅ Prefix Title (e.g., Atty., Engr., Dr.)
    prefixTitle: {
      type: String,
      trim: true,
      default: "",
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    // ✅ Middle Name
    middleName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    // ✅ Name Extension (e.g., Jr., Sr., II, III)
    nameExtension: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ Postfix Title / Certifications (e.g., PECE, PhD, MIT)
    postfixTitle: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ Email is now the primary login identifier
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    position: {
      type: String,
      required: true,
      trim: true,
    },

    // ✅ Salary references the SalaryGrade model
    salary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SalaryGrade",
      required: false,
    },

    division: {
      type: String,
      required: true,
      trim: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    dateHired: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Resigned", "Terminated"],
      default: "Active",
    },

    // ✅ Employee Type
    employeeType: {
      type: String,
      enum: ["JO", "Organic"],
      required: true,
    },

    // ✅ Signature field for organic personnel
    signature: {
      type: String,
      trim: true,
      default: null,
    },

    balances: {
      vlDays: {
        type: Number,
        default: 0,
      },

      slDays: {
        type: Number,
        default: 0,
      },

      ctoHours: {
        type: Number,
        default: 0,
      },

      wellnessDays: {
        type: Number,
        default: 0,
      },
    },

    address: {
      street: {
        type: String,
        trim: true,
      },

      city: {
        type: String,
        trim: true,
      },

      province: {
        type: String,
        trim: true,
      },
    },

    emergencyContact: {
      name: {
        type: String,
        trim: true,
      },

      phone: {
        type: String,
        trim: true,
      },

      relation: {
        type: String,
        trim: true,
      },
    },

    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
      default: null,
    },

    preferences: {
      theme: {
        type: String,
        enum: ["system", "light", "dark"],
        default: "system",
      },

      accent: {
        type: String,
        enum: [
          "blue",
          "pink",
          "green",
          "violet",
          "amber",
          "teal",
          "indigo",
          "rose",
          "cyan",
          "lime",
          "orange",
        ],
        default: "blue",
      },
    },
  },
  {
    timestamps: true,
  },
);

// ✅ Hash password before saving
employeeSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 12);

  next();
});

// ✅ Compare password method
employeeSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ✅ NEW: true if the JWT was issued before the last password change
employeeSchema.methods.changedPasswordAfter = function (jwtIssuedAtSeconds) {
  if (!this.passwordChangedAt) return false;
  return jwtIssuedAtSeconds * 1000 < new Date(this.passwordChangedAt).getTime();
};

// ✅ Hide sensitive fields from API responses
employeeSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model("Employee", employeeSchema);
