const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: [
        "super_master_admin",
        "super_admin",
        "doctor",
        "nurse",
        "billing_staff",
        "pharmacy_staff",
        "patient",
      ],
      required: true,
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: function () {
        return this.role !== "super_master_admin" && this.role !== "patient";
      },
    },
    specialization: {
      type: String,
      required: function () {
        return this.role === "doctor";
      },
    },
    specialty: {
      type: String,
    },
    licenseNumber: {
      type: String,
      required: function () {
        return this.role === "doctor" || this.role === "nurse";
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    // Password Reset OTP fields
    resetOTP: {
      type: String,
    },
    resetOTPExpires: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP
userSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.otp = otp;
  this.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  return otp;
};

module.exports = mongoose.model("User", userSchema);
