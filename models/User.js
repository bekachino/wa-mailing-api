import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";

const { Schema, model } = mongoose;

const SALT_WORK_FACTOR = 8;

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: async function (value) {
        if (!this.isModified("username")) return true;
        const user = await this.constructor.findOne({ username: value });
        return !user;
      },
      message: "Username is already taken",
    },
  },
  password: {
    type: String,
    required: true,
  },
  token: {
    type: String,
    required: true,
  },
});

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
  this.password = await bcrypt.hash(this.password, salt);

  next();
});

UserSchema.methods.checkPassword = function (password) {
  return bcrypt.compare(password, this.password);
};

UserSchema.methods.generateToken = function () {
  this.token = randomUUID();
};

const User = model("User", UserSchema);
export default User;
