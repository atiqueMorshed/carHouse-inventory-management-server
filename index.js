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

const validateJWT = (req, res, next) => {
  const token = req?.headers?.authorization.split(' ')[1];

  if (!token) return res.status(401).send({ message: 'Unauthorized Access' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: 'Forbidden Access!' });
    if (decoded) {
      req.decoded = decoded;
      next();
    }
  });
};

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
    const sliderCollection = client.db('carHouse').collection('slider');

    console.log('DB CONNECTED.');

    // Generates JWT after successful login
    app.post('/api/login', (req, res) => {
      const { email, uid } = req.body;
      const accessToken = jwt.sign({ email, uid }, process.env.JWT_SECRET, {
        expiresIn: '1d',
      });

      return res.status(201).send({ accessToken });
    });

    // Adds new car
    app.post('/api/addCar', validateJWT, async (req, res) => {
      const { carData } = req?.body;
      const decodedUid = req?.decoded?.uid;

      if (!decodedUid || decodedUid !== carData?.supplier?.uid) {
        return res.status(403).send({ message: 'Forbidden Access.' });
      }

      if (
        !carData?.carName ||
        !carData?.price ||
        !carData?.quantity ||
        !carData?.imageURL ||
        !carData?.description ||
        !carData?.supplier ||
        !carData?.supplier?.name ||
        !carData?.supplier?.uid
      ) {
        return res.status(400).send({ message: 'Insufficient form data.' });
      }

      let result;
      try {
        result = await inventoryCollection.insertOne(carData);
      } catch (error) {
        return res.status(400).send({ message: 'Insertion failed.' });
      }

      // car was successfully added to the inventory and now, we will add it to slider if isSlider was ticked from addCars form
      if (result?.acknowledged && result?.insertedId && carData?.isSlider) {
        const carSliderInfo = {
          carName: carData.carName,
          supplier: carData.supplier,
          imageURL: carData.imageURL,
          carId: result.insertedId,
        };
        try {
          const sliderResult = await sliderCollection.insertOne(carSliderInfo);
          return res.status(201).send(sliderResult);
        } catch (error) {
          res.status(400).send({ message: 'Insertion failed.' });
        }
      } else {
        return res.status(201).send({ ...result, sliderInsertionFailed: true });
      }
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
