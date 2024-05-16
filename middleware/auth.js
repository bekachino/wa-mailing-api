import User from "../models/User.js";

const auth = async (expressReq, res, next) => {
  const req = expressReq;
  const token = req.get("Authorization");

  if (!token) {
    return res.status(401).send({ error: "No token provided" });
  }

  const user = await User.findOne({ token });

  if (!user) {
    return res.status(401).send({ error: "Wrong token!" });
  }

  req.user = user;
  next();
};

export default auth;
