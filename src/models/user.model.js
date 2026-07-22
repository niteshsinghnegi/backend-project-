// Import mongoose to create schema and model
import mongoose, { Schema } from "mongoose";

// Import JWT for generating Access & Refresh Tokens
import jwt from "jsonwebtoken";

// Import bcrypt for hashing passwords
import bcrypt from "bcrypt";

// ==============================
// User Schema
// ==============================

const userSchema = new Schema(
  {
    // Username of the user
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Email of the user
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Full Name
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Avatar Image URL (Cloudinary)
    avatar: {
      type: String,
      required: true,
    },

    // Cover Image URL (Optional)
    coverImage: {
      type: String,
      default: "",
    },

    // Watch History
    // Stores ObjectIds of watched videos
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],

    // Password
    password: {
      type: String,
      required: [true, "Password is required"],
    },

    // Refresh Token
    refreshToken: {
      type: String,
    },
  },
  {
    // Automatically creates createdAt & updatedAt
    timestamps: true,
  }
);

// ======================================================
// Hash Password Before Saving
// ======================================================

userSchema.pre("save", async function (next) {
  // If password is not modified, don't hash again
  if (!this.isModified("password")) return next();

  // Hash password with salt rounds = 10
  this.password = await bcrypt.hash(this.password, 10);

  next();
});

// ======================================================
// Compare Entered Password with Database Password
// ======================================================

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// ======================================================
// Generate Access Token
// ======================================================

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};

// ======================================================
// Generate Refresh Token
// ======================================================

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

// ======================================================
// Export User Model
// ======================================================

export const User = mongoose.model("User", userSchema);