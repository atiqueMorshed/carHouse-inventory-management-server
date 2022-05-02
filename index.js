import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from 'mongodb';
import jwt from 'jsonwebtoken';

const app = express();
const port = process.env.PORT || 5000;
const uri = `mongodb+srv://warehouse-management-admin:${[
  process.env.DB_PASSWORD,
]}@cluster0.uvu74.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

// Middleware
app.use(express.json());
app.use(cors());

// Mongo API
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const inventoryCollection = client.db('carHouse').collection('inventory');
    console.log('DB CONNECTED.');

    app.post('/api/login', (req, res) => {
      const { email } = req.body;
      const accessToken = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: '1d',
      });

      res.send({ accessToken });
    });
  } finally {
  }
};

run().catch(console.dir);

// Test API
app.get('/', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
