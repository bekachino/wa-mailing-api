import express from "express";
import bodyParser from "body-parser";
import auth from "../middleware/auth.js";
import schedule from "node-schedule";
import Mail from "../models/Mail.js";
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
import { sendClientReadyStatus } from '../index.js';
import { sendQr } from '../index.js';
import { clientConnected } from '../index.js';

const {Client, LocalAuth} = pkg;

const waMailing = express();
waMailing.use(bodyParser.urlencoded({extended: false}));
waMailing.use(bodyParser.json());

const client = new Client({
  authStrategy: new LocalAuth(),
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  },
});

client.on('qr', (qr) => {
  console.log('QR сгенерирован', qr);
  qrcode.toDataURL(qr, (err, url) => {
    sendQr(url);
    if (err) {
      console.error('Error generating QR code', err);
    }
  });
});

client.on('ready', () => {
  console.log('Client is ready!');
  sendClientReadyStatus(true);
});

client.on('authenticated', () => {
  clientConnected();
  console.log('Client authenticated!');
});

client.on('disconnected', () => {
  client.initialize();
  console.log('Client disconnected!');
});

client.initialize();

export const sendToOne = async (phone_number, message) => {
  let status = false;
  await client.sendMessage('996' + `${phone_number}`.slice(-9) + '@c.us', message)
  .then(() => {
    const mail = new Mail({
      text: message,
      phone_number,
      sent_at: new Date().toISOString(),
      deliver_status: true,
    });
    mail.save();
    status = true;
  })
  .catch(() => {
    const mail = new Mail({
      phone_number,
      text: message,
      sent_at: new Date().toISOString(),
      deliver_status: false,
    });
    mail.save();
    status = false;
  });
  return status;
};

export const sendToAll = async (abons, message, scheduleDate) => {
  if (scheduleDate) {
    schedule.scheduleJob(scheduleDate, () => {
      void sendMessages(abons, message, scheduleDate);
    });
    console.log(`Message scheduled to be sent at ${scheduleDate}`);
  } else {
    void sendMessages(abons, message);
  }
};

const sendMessages = async (abons, message) => {
  for (const abon of abons) {
    let customMessage = message;
    Object.keys(abon).forEach(key => {
      customMessage = customMessage.replace(`@${key}`, abon[key]);
    });
    await client.sendMessage('996' + `${abon[Object.keys(abon)[0]]}`.slice(-9) + '@c.us', customMessage)
    .then(() => {
      const mail = new Mail({
        phone_number: abon[Object.keys(abon)[0]],
        text: customMessage,
        sent_at: new Date().toISOString(),
        deliver_status: true,
      });
      mail.save();
    })
    .catch(() => {
      const mail = new Mail({
        phone_number: abon[Object.keys(abon)[0]],
        text: customMessage,
        sent_at: new Date().toISOString(),
        deliver_status: false,
      });
      mail.save();
    });
  }
};

waMailing.get('/get_all', auth, async (req, res) => {
  try {
    const mails = await Mail.find();
    return res.json(mails);
  } catch (e) {
    res.status(e.status || 500).send({...e});
  }
});

export default waMailing;
