import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import config from "./config.js";
import waMailing from "./routers/waMailing.js";
import users from "./routers/users.js";

const app = express();
const port = 8000;
const corsOptions = {
  origin: "*",
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({extended: false}));
app.use("/mailing/", waMailing);
app.use("/user/", users);

const run = async () => {
  void mongoose.connect(config.db);

  app.listen(port, () => console.log(port));

  process.on("exit", () => {
    mongoose.disconnect();
  });
};

void run().catch((e) => console.log(e));
