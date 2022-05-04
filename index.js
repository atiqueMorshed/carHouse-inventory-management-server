import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import jwt from 'jsonwebtoken';

const app = express();
const port = process.env.PORT;
const uri = `mongodb+srv://warehouse-management-admin:${[
  process.env.DB_PASSWORD,
]}@cluster0.uvu74.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

// Middleware
app.use(express.json());
app.use(cors());

app.use((err, req, res, next) => {
  // Checks if the incoming req.body is valid json
  if (err.status === 400)
    return res.status(err.status).send('Invalid JSON Object');

  return next(err);
});

const validateJWT = (req, res, next) => {
  const token = req?.headers?.authorization?.split(' ')[1];

  if (!token)
    return res
      .status(401)
      .send({ message: 'Unauthorized Access (Invalid JWT)' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err)
      return res
        .status(403)
        .send({ message: 'Forbidden Access! (Invalid JWT)' });
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
      if (isNaN(carData.price) || isNaN(carData.quantity)) {
        return res
          .status(406)
          .send({ message: 'Price and quantity must me numeric.' });
      }

      let result;
      try {
        carData.quantity = +carData.quantity;
        carData.price = +carData.price;
        result = await inventoryCollection.insertOne({
          ...carData,
          lastModified: new Date(),
          sold: 0,
        });
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

    // Gets slider data
    app.get('/api/slider', async (req, res) => {
      const query = {};

      try {
        const cursor = sliderCollection.find(query);
        const sliders = await cursor.toArray();
        res.status(200).send(sliders);
      } catch (error) {
        res
          .status(503)
          .send({ message: error?.message || 'Could not fetch data.' });
      }
    });

    // Gets car showcase data
    app.get('/api/carShowcase', async (req, res) => {
      const query = {};
      try {
        const cursor = inventoryCollection.find(query);
        const carShowcase = await cursor.limit(6).toArray();
        res.status(200).send(carShowcase);
      } catch (error) {
        res
          .status(503)
          .send({ message: error?.message || 'Could not fetch data' });
      }
    });

    // Gets inventory car information
    app.get('/api/inventory/:id', async (req, res) => {
      const { id } = req.params;
      if (!id)
        return res.status(406).send({ message: 'Car ID cannot be empty.' });

      if (!ObjectId.isValid(id))
        return res
          .status(404)
          .send({ message: 'The provided ID was invalid.' });

      try {
        const query = { _id: ObjectId(id) };
        const inventoryCar = await inventoryCollection.findOne(query);
        res.status(200).send(inventoryCar);
      } catch (error) {
        return res.status(406).send({ message: 'Incorrect car ID.' });
      }
    });

    // Updates quantity and sold cars
    app.post('/api/updateDelivery', validateJWT, async (req, res) => {
      //
      const id = req?.body?.postData;
      try {
        if (!ObjectId.isValid(id)) {
          return res
            .status(406)
            .send({ message: 'The provided ID was invalid.' });
        }
      } catch (error) {
        return res.status(406).send({ message: error.message });
      }
      // Checks if the objectId is valid.

      // Checks if the quantity is greater than 0 in the DB.
      const query = { _id: ObjectId(id) };
      try {
        const inventoryCar = await inventoryCollection.findOne(query);
        if (inventoryCar?.quantity <= 0) {
          return res.status(403).send({ message: 'The car is not available.' });
        }
      } catch (error) {
        return res.status(503).send({ message: error?.message });
      }

      // Updates the Inventory Car
      try {
        const result = await inventoryCollection.findOneAndUpdate(query, {
          $inc: { quantity: -1, sold: 1 },
          $set: { lastModified: new Date() },
        });
        return res.status(200).send(result);
      } catch (error) {
        res.status(500).send({ message: error?.message });
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
