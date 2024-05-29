import express from "express";
import config from "./config.js";
import cors from "cors";
import mongoose from "mongoose";
import waMailing from "./routers/waMailing.js";
import users from "./routers/users.js";
import expressWs from 'express-ws';
import { sendToOne } from './routers/waMailing.js'
import { sendToAll } from './routers/waMailing.js'

const app = express();
const port = 8000;
const corsOptions = {
  origin: "*",
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({extended: false}));
app.use("/mailing", waMailing);
app.use("/user", users);
expressWs(app);

let webSocket = null;
let clientIsReady = false;
let qr = '';

export const sendClientReadyStatus = (status) => {
  if (!webSocket) return;
  webSocket.send(JSON.stringify({type: 'connection', status}));
  clientIsReady = status;
};

export const sendQr = async (message) => {
  if (!webSocket) return;
  webSocket.send(JSON.stringify({type: 'qr', message}));
  qr = message;
};

export const clientConnected = () => {
  if (!webSocket) return;
  webSocket.send(JSON.stringify({type: 'clientConnection', message: 'Сессия зарегистрирована'}));
};

app.ws('/ws', async (ws) => {
  try {
    webSocket = ws;
    ws.on('connection', () => {
      console.log(1);
      ws.send(JSON.stringify({type: 'connection', status: false}));
    })
    
    if (clientIsReady) {
      ws.send(JSON.stringify({type: 'connection', status: true}));
    }
    
    ws.on("message", async (msg) => {
        const decodedMessage = JSON.parse(msg.toString());
        const {message, phone_number, abons, scheduleDate} = decodedMessage.payload || {};
        if (decodedMessage.type === 'singleMailing') {
          const newMail = await sendToOne(phone_number, message);
          ws.send(JSON.stringify({type: 'mailing', status: newMail}));
        } else if (decodedMessage.type === 'mailToAll') {
          await sendToAll(abons, message, scheduleDate);
          ws.send(JSON.stringify({type: 'mailing', status: true}));
        } else if (decodedMessage.type === 'get_qr') {
          if (qr) void sendQr(qr);
        }
      }
    );
    
    ws.on("close", async () => {
      console.log('Client disconnected!');
    });
  } catch
    (e) {
    console.log(e);
  }
});

const run = async () => {
  void mongoose.connect(config.db);
  
  app.listen(port, () => console.log(port));
  
  process.on("exit", () => {
    mongoose.disconnect();
  });
};

void run().catch((e) => console.log(e));
