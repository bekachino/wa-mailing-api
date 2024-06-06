import express from "express";
import bodyParser from "body-parser";
import auth from "../middleware/auth.js";
import schedule from "node-schedule";
import Mail from "../models/Mail.js";
import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
import puppeteer from 'puppeteer';

const waMailing = express();
waMailing.use(bodyParser.urlencoded({extended: false}));
waMailing.use(bodyParser.json());

const prefixes = [
  '70', '50', '77', '55', '312', '99', '22'
];

const {Client, LocalAuth} = pkg;
let clientIsReady = false;
let qrImgSrc = '';

const phoneNumFormatFits = (phoneNumber) => {
  const slicedPhoneNum = phoneNumber.toString().replace(/\D/g, '').slice(-9);
  return prefixes.some(prefix => slicedPhoneNum.toString().replace(/\D/g, '').startsWith(prefix)) && slicedPhoneNum.length === 9;
};

waMailing.get('/get_all', auth, async (req, res) => {
  try {
    const mails = await Mail.find();
    return res.json(mails);
  } catch (e) {
    res.status(e.status || 500).send(e);
  }
});

waMailing.get('/get_qr', async (req, res) => {
  try {
    res.send({hasQr: !!qrImgSrc, qrImgSrc, clientIsReady});
  } catch (e) {
    console.log(e);
    res.send(e);
  }
});

waMailing.post('/send_to_one', async (req, res) => {
  try {
    const {phone_number, message} = req.body;
    
    if (!phone_number || !message) return res.status(400).send({message: 'Заполните все поля!'});
    if (!clientIsReady) return res.status(400).send({message: 'Идёт подключение к Whatsapp...'});
    if (!phoneNumFormatFits(phone_number)) return res.status(400).send({message: 'Неверный формат номера телефона'});
    
    const newMail = await sendToOne(phone_number.toString().replace(/\D/g, '').slice(-9), message);
    return res.status(newMail ? 200 : 400).send({message: newMail ? 'Сообщение отправлено' : 'Сообщение не отправлено'})
  } catch (e) {
    console.log(e);
    res.send(e);
  }
});

waMailing.post('/send_to_all', async (req, res) => {
  try {
    const {abons, message, scheduleDate} = req.body || {};
    
    if (!abons || !message) return res.status(400).send({message: 'Заполните все поля!'});
    if (!clientIsReady) return res.status(400).send({message: 'Идёт подключение к Whatsapp...'});
    
    void sendToAll(abons, message, scheduleDate);
    return res.send({message: 'Отправка сообщений...'});
  } catch (e) {
    console.log(e);
    res.send(e);
  }
});

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
    qrImgSrc = url;
    if (err) {
      return console.error('Error generating QR code', err);
    }
  });
});

client.on('ready', () => {
  console.log('Client is ready!');
  clientIsReady = true;
  qrImgSrc = '';
});

client.on('authenticated', () => {
  console.log('Client authenticated!');
  qrImgSrc = '';
});

client.on('disconnected', () => {
  console.log('Client disconnected!');
  clientIsReady = false;
  setTimeout(() => client.initialize(), 5000);
});

client.initialize();

export const sendToOne = async (phone_number, message) => {
  let status = false;
  await client.sendMessage(`996${phone_number}@c.us`, message)
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
      reason: 'Ошибка сервера',
    });
    mail.save();
    status = false;
  });
  return status;
};

const sendToAll = async (abons, message) => {
  const interval = 10000;
  const batchSize = 1;
  let currentIndex = 0;
  
  const sendBatch = async (startIndex, endIndex) => {
    for (let i = startIndex; i < endIndex; i++) {
      const abon = abons[i];
      let customMessage = message;
      const phone_number = abon[Object.keys(abon)[0]].toString().replace(/\D/g, '').slice(-9);
      Object.keys(abon).forEach(key => {
        customMessage = customMessage.replace(`@${key}`, abon[key]);
      });
      
      if (!phoneNumFormatFits(phone_number)) {
        const mail = new Mail({
          phone_number,
          text: customMessage,
          sent_at: new Date().toISOString(),
          deliver_status: false,
          reason: 'Неверный формат номера телефона',
        });
        await mail.save();
        continue;
      }
      
      try {
        await client.sendMessage(`996${phone_number}@c.us`, customMessage);
        const mail = new Mail({
          phone_number,
          text: customMessage,
          sent_at: new Date().toISOString(),
          deliver_status: true,
        });
        await mail.save();
      } catch (error) {
        const mail = new Mail({
          phone_number,
          text: customMessage,
          sent_at: new Date().toISOString(),
          deliver_status: false,
          reason: 'Ошибка сервера',
        });
        await mail.save();
      }
    }
  };
  
  const sendInBatches = async () => {
    while (currentIndex < abons.length) {
      const endIndex = Math.min(currentIndex + batchSize, abons.length);
      
      await sendBatch(currentIndex, endIndex);
      
      currentIndex = endIndex;
      
      if (currentIndex < abons.length) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  };
  
  // Start sending messages in batches
  await sendInBatches();
};

export default waMailing;
