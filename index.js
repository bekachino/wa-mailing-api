import express from "express";
import config from "./config.js";
import cors from "cors";
import mongoose from "mongoose";
import axios from "axios";

const app = express();
const port = 8002;
const corsOptions = {
  origin: "*",
};
const PATH_TO_EXCEL = './public/Абоненты.xlsx';
const login = 'asyl';
const password = '*hjvfirf';
let token = '';

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
//app.use("/mailing", waMailing);
//app.use("/user", users);

const authorize = async () => {
  try {
    const req = await axios.post(`https://hydra.snt.kg:8000/rest/v2/login`, {
      session: {
        login,
        password
      }
    });
    
    return await req.data?.session?.token;
  } catch (e) {
    console.log(e?.response);
  }
};

const assignTags = async () => {
  try {
    //const workbook = XLSX.readFile(PATH_TO_EXCEL);
    //const sheetName = workbook.SheetNames[0];
    //const abons = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    const abons = [
      {
        ls_abon: '175050620',
        tag: 'кара-суу'
      },
      {
        ls_abon: '175078915',
        tag: 'кара-суу'
      },
      {
        ls_abon: '175078912',
        tag: 'кара-суу'
      },
    ];
    const data = [];
    
    for (let i = 0; i < abons.length; i++) {
      const req = await axios(`https://hydra.snt.kg:8000/rest/v2/search?query=${abons[i]?.ls_abon}`, {
        headers: {
          Authorization: `Token token=${token}`
        }
      });
      
      const foundAbon = req.data?.search_results?.find(abon => abon?.vc_section === 'SEARCH_SECTION_Accounts');
      
      if (!!foundAbon) {
        const n_result_id = req.data?.search_results[0]?.n_result_id;
        
        if (!!n_result_id) {
          const reqToTags = await axios(`https://hydra.snt.kg:8000/rest/v2/subjects/customers/${n_result_id}`, {
            headers: {
              Authorization: `Token token=${token}`
            }
          });
          const tags = [
            ...reqToTags.data?.customer?.t_tags,
            abons[i]?.tag
          ];
          
          const updateAbonTags = await axios.put(`https://hydra.snt.kg:8000/rest/v2/subjects/customers/${n_result_id}`, {
            customer: {
              t_tags: tags,
            }
          }, {
            headers: {
              Authorization: `Token token=${token}`
            }
          });
          
          data.push({
            ls_abon: abons[i]?.ls_abon,
            tags: updateAbonTags.data
          });
        }
      }
    }
    return data;
  } catch (e) {
    console.log(e?.response);
  }
};

app.get("/assign_tags", async (req, res) => {
  try {
    if (!token) {
      token = await authorize()
    }
    if (!!token) {
      const abonsData = await assignTags();
      res.json(abonsData);
    }
    //const abons = assignTags();
    //res.json(abons.slice(0, 100));
  } catch (e) {
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
