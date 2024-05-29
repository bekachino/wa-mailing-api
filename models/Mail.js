import mongoose from "mongoose";

const mailSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  phone_number: {
    type: String,
    required: true,
  },
  sent_at: {
    type: String,
    required: true,
  },
  deliver_status: {
    type: Boolean,
    required: true,
  },
  reason: String,
});

const Mail = mongoose.model("Mail", mailSchema);
export default Mail;
