import express from "express";
import bodyParser from "body-parser"
import wppconnect from '@wppconnect-team/wppconnect';
import auth from "../middleware/auth.js";
import xlsx from 'xlsx';
import multer from "multer";
import Mail from "../models/Mail.js";
import schedule from "node-schedule";
import { promises as fs } from 'fs';

const waMailing = express();
waMailing.use(bodyParser.urlencoded({extended: false}));
waMailing.use(bodyParser.json());

const storage = multer.memoryStorage();
const upload = multer({storage: storage});

waMailing.get('/get_qr', async (req, res) => {
  try {
    // Check if tokens directory exists
    const tokensDirExists = await fs.access('./tokens').then(() => true).catch(() => false);

    // If tokens directory exists, delete it
    if (tokensDirExists) {
      await fs.rmdir('./tokens', { recursive: true });
      console.log('Tokens directory deleted');
    }

    // Create WPPConnect session
    wppconnect.create({
      session: 'sessionName',
      catchQR: (qrCode, asciiQR) => {
        // Send the raw QR code data to the client
        res.send({ qrCode });
      },
      statusFind: (statusSession, session) => {
        console.log('Status:', statusSession);
        // You can handle different session statuses here if needed
      }
    }).then(client => {
      // You can use the client instance for further operations
      console.log('Client is ready!');
    }).catch(error => {
      console.error('Error during session creation:', error);
      res.status(500).send('Error generating QR code');
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error generating QR code');
  }
});

waMailing.get('/get_all', auth, async (req, res) => {
  try {
    const mails = await Mail.find();
    return res.json(mails);
  }
  catch (e) {
    res.status(e.status || 500).send({...e});
  }
});

waMailing.post('/send_to_all', auth, upload.single('excel_file'), async (req, res) => {
  try {
    const { message, scheduleDate } = req.body;
    const shouldSchedule = scheduleDate && !isNaN(Date.parse(scheduleDate));

    if (shouldSchedule) {
      const scheduledDate = new Date(scheduleDate);

      console.log(scheduleDate);
      schedule.scheduleJob(scheduledDate, async () => {
        await sendWhatsAppMessage(message, req.file.buffer);
      });

      return res.status(200).json({ success: true, message: 'Message scheduled successfully' });
    } else {
      // Execute the task immediately
      await sendWhatsAppMessage(message, req.file.buffer);

      return res.status(200).json({ success: true, message: 'Message sent successfully' });
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ success: false, error: 'Failed to send WhatsApp message' });
  }
});

  waMailing.post('/send_to_one', auth, async (req, res) => {
    try {
      const {phone_number, message} = req.body;

      // Create WPPConnect client
      const client = await wppconnect.create({
        session: 'mySession',
        catchQR: true,
        browserSessionToken: true,
      });

      // Connect to WhatsApp
      await client.start();

      // Send the WhatsApp message
      await client.sendText(phone_number.replace(/\s/g, ''), message);
      const mail = new Mail(
        {
          text: message,
          phone_number: phone_number.replace(/\s/g, ''),
          sent_at: new Date(),
          deliver_status: 'success',
        }
      );
      await mail.save();

      // Disconnect from WhatsApp
      await client.close();

      res.status(200).json({success: true, message: 'Messages sent successfully'});
    }
    catch (error) {
      console.error('Error sending WhatsApp message:', error);
      res.status(500).json({success: false, error: 'Failed to send WhatsApp message'});
    }
  });

  waMailing.get('/hello', (req, res) => res.sendStatus(200));

  const sendWhatsAppMessage = async (message, fileBuffer) => {
    const workbook = xlsx.read(fileBuffer, {type: 'buffer'});
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(sheet);
    // const jsonData = [{
    //   'Абонент': 'Бектур',
    //   'Лицевой счет': 1122334455,
    //   'Баланс': '-1234.56',
    //   'Мобильный телефон': '996 707 777 404'
    // }];

    // Create WPPConnect client
    const client = await wppconnect.create({
      session: 'mySession',
      catchQR: true,
      browserSessionToken: true,
    });

    // Connect to WhatsApp
    await client.start();

    // Iterate over each number and send the WhatsApp message
    for (const data of jsonData) {
      const customizedMessage = message.replace('$имя', data['Абонент'] || '?')
        .replace('$лс', Math.floor(Number(data['Лицевой счет'])) || '?')
        .replace('$баланс', data['Баланс'] || '?');
      const waMessage = await client.sendText(data['Мобильный телефон'].toString().replace(/\s/g, ''), customizedMessage);
      const mail = new Mail({
        text: customizedMessage,
        phone_number: data['Мобильный телефон'].toString().replace(/\s/g, ''),
        sent_at: new Date(),
        deliver_status: !!waMessage?.id,
      });
      await mail.save();
    }

    // Disconnect from WhatsApp
    await client.close();
  }

  export default waMailing;
