import { fileURLToPath } from 'url';
import path from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const rootPath = path.dirname(__filename);
dotenv.config();

const config = {
  rootPath,
  publicPath: path.join(rootPath, "public"),
  db: "mongodb://127.0.0.1:27017/wa-mailing",
};

export default config;
