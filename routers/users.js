import express from "express";
import User from '../models/User.js';
import mongoose from "mongoose";

const usersRouter = express();

usersRouter.post("/register", async (req, res, next) => {
  try {
    const user = new User({
      username: req.body.username,
      password: req.body.password,
    });

    user.generateToken();

    await user.save();
    return res.send(user);
  } catch (e) {
    if (e instanceof mongoose.Error.ValidationError) {
      return res.status(400).send(e);
    }

    return next(e);
  }
});

usersRouter.post("/login", async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.body.username });

    if (!user) {
      return res.status(400).send({ error: "Wrong password or username!" });
    }

    const isMatch = await user.checkPassword(req.body.password);

    if (!isMatch) {
      return res.status(400).send({ error: "Wrong password or username!" });
    }

    user.generateToken();
    await user.save();

    res.send({
      message: "Username and password correct!",
      user,
    });
  } catch (e) {
    next(e);
  }
});

export default usersRouter;