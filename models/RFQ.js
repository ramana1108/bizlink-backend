import mongoose from "mongoose";

const rfqSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    company: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    industry: {
      type: String,
      default: "",
    },

    service: {
      type: String,
      default: "",
    },

    headcount: {
      type: String,
      default: "",
    },

    timeline: {
      type: String,
      default: "",
    },

    message: {
      type: String,
      default: "",
    },

    formType: {
      type: String,
      enum: ["employer", "candidate"],
      default: "employer",
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const RFQ = mongoose.model("RFQ", rfqSchema);

export default RFQ;