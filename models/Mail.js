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
    type: String,
    required: true,
  },
});

const Mail = mongoose.model("Mail", mailSchema);
export default Mail;
