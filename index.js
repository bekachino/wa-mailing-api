import express from "express";
import bodyParser from "body-parser"
import wppconnect from '@wppconnect-team/wppconnect';
import Mail from "./models/Mail.js";
import config from "./config.js";
import cors from "cors";
import mongoose from "mongoose";
import waMailing from "./routers/waMailing.js";
import users from "./routers/users.js";
import expressWs from 'express-ws';

const app = express();
waMailing.use(bodyParser.urlencoded({extended: false}));
waMailing.use(bodyParser.json());
expressWs(app);
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

let clientInstance;

app.ws('/ws', async (ws) => {
  try {
    ws.on("message", async (msg) => {
        const decodedMessage = JSON.parse(msg.toString());
        if (decodedMessage.type === 'singleMailing' || decodedMessage.type === 'mailToAll') {
          const {message, phone_number, abons} = decodedMessage.payload;
          
          const connectClient = async () => {
            ws.send(JSON.stringify({type: 'connecting'}));
            clientInstance = await wppconnect.create({
              session: 'wa_mailing',
              catchQR: (qrCode) => {
                ws.send(JSON.stringify({type: 'qrCode', qrCode}));
              },
            }).catch(() => ws.send(JSON.stringify({type: 'error', message: 'Что-то пошло не так, попробуйте снова'})));
            return ws.send(JSON.stringify({type: 'connected'}));
          };
          
          if (!clientInstance?.sendText) {
            await connectClient()
            .catch(() => ws.send(JSON.stringify({type: 'error', message: 'Что-то пошло не так, попробуйте снова'})));
          }
          
          try {
            if (decodedMessage.type === 'singleMailing') {
              const sentMessage = await clientInstance.sendText(phone_number, message)
              .catch(() => ws.send(JSON.stringify({type: 'error', message: 'Что-то пошло не так, попробуйте снова'})));
              if (sentMessage.id) {
                ws.send(JSON.stringify({type: 'success', message: 'message sent'}));
                const mail = new Mail({
                  text: message,
                  phone_number: phone_number.replace(/\s/g, ''),
                  sent_at: new Date(),
                  deliver_status: 'success',
                });
                await mail.save()
              }
            } else if (decodedMessage.type === 'mailToAll') {
              for (const abon of abons) {
                const keyNames = Object.keys(abon);
                let customizedMessage = message;
                for (const key of keyNames) {
                  customizedMessage = customizedMessage?.replace(`@${key}`, `${abon[key]}`);
                }
                console.log(customizedMessage);
                const waMessage = await clientInstance.sendText(abon['Мобильный телефон'].toString()
                ?.replace(/\s/g, ''), customizedMessage)
                // .catch(() => ws.send(JSON.stringify({type: 'error', message: 'Что-то пошло не так, попробуйте снова'})));
                const mail = new Mail({
                  text: customizedMessage,
                  phone_number: abon['Мобильный телефон'].toString()
                  ?.replace(/\s/g, ''),
                  sent_at: new Date(),
                  deliver_status: !!waMessage?.id,
                });
                await mail.save();
              }
            }
            ws.send(JSON.stringify({type: 'success', message: 'message sent'}));
          } catch
            (e) {
            console.log(e);
            clientInstance = null;
            ws.send(JSON.stringify({type: 'error', message: 'Что-то пошло не так, попробуйте снова'}));
          }
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
