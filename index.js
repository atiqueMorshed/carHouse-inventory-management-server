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

const validateUserWithJWT = (req, res, next) => {
  const decodedUid = req?.decoded?.uid;
  let uid = req.body?.uid;
  if (!uid) uid = req?.query?.uid;

  if (!decodedUid || decodedUid !== uid) {
    return res
      .status(403)
      .send({ message: 'Forbidden Access. (Not User JWT)' });
  }

  next();
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

    // Gets the latest modified cars
    app.get('/api/latestCars', async (req, res) => {
      const query = {};
      try {
        const cursor = inventoryCollection
          .find({})
          .sort({ lastModified: -1 })
          .limit(6);
        const latestCars = await cursor.toArray();
        return res.status(200).send(latestCars);
      } catch (error) {
        return res.status(500).send(error.message);
      }
    });

    // Gets total car count
    app.get('/api/carcount', async (req, res) => {
      try {
        const count = await inventoryCollection.countDocuments();
        return res.status(200).json(count);
      } catch (error) {
        return res
          .status(503)
          .send({ message: error?.message || 'Could not fetch data' });
      }
    });

    // Get all inventory cars
    app.get('/api/inventory', validateJWT, async (req, res) => {
      let page = req?.query?.page;
      let size = req?.query?.size;

      // For any invalid queries, the website resets to first page and 10 cars
      try {
        page = parseInt(page);
        size = parseInt(size);

        if (page < 0) {
          page = 0;
        }
      } catch (error) {
        page = 0;
        size = 10;
      }

      // Gets inventory data
      let inventory;
      const query = {};
      try {
        const cursor = inventoryCollection.find(query);
        inventory = await cursor
          .skip(page * size)
          .limit(size)
          .toArray();

        if (inventory) {
          return res.status(200).send(inventory);
        } else {
          inventory = await cursor.toArray();
          return res.status(200).send(inventory);
        }
      } catch (error) {
        res.status(404).send({ message: error?.message });
      }
    });

    app.get(
      '/api/userInventory',
      validateJWT,
      validateUserWithJWT,
      async (req, res) => {
        const uid = req?.query?.uid;
        if (!uid) {
          return res
            .status(401)
            .send({ message: 'Unauthorized. (UID not found)' });
        }
        // const decodedUid = req?.decoded?.uid;
        // if (!decodedUid || decodedUid !== uid) {
        //   return res
        //     .status(403)
        //     .send({ message: 'Forbidden Access. (Wrong User JWT)' });
        // }
        // User is valid
        const query = { 'supplier.uid': uid };
        // Finds user inventory
        try {
          const cursor = inventoryCollection.find(query);
          const userInventory = await cursor.toArray();
          console.log(userInventory);
          return res.status(200).send(userInventory);
        } catch (error) {
          return res.status(500).send({ message: error?.message });
        }
      }
    );

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
        return res.status(200).send(inventoryCar);
      } catch (error) {
        return res.status(406).send({ message: 'Incorrect car ID.' });
      }
    });

    // Deletes an inventory with its ID
    app.delete('/api/inventory', validateJWT, async (req, res) => {
      let id = req?.body?.id;
      if (!id) {
        return res
          .status(406)
          .send({ message: 'Cannot complete request without car ID.' });
      }
      if (!ObjectId.isValid(id)) {
        return res.status(406).send({ message: 'Invalid car ID.' });
      }

      // Now we have valid car ID
      // Performs atomic delete operation from both inventory and slider documents.

      const transactionOptions = {
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
        readPreference: 'primary',
        readPreference: 'primary',
      };

      const session = client.startSession();
      try {
        session.startTransaction(transactionOptions);
        let query = { carId: ObjectId(id) };
        const sliderDeleteResult = await sliderCollection.deleteOne(query, {
          session,
        });
        if (!sliderDeleteResult) throw new Error('Deletion failed (s).');
        if (
          !(
            sliderDeleteResult?.deletedCount === 0 ||
            sliderDeleteResult?.deletedCount === 1
          )
        ) {
          throw new Error('Deletion failed (s)..');
        }

        query = { _id: ObjectId(id) };
        const inventoryDeleteResult = await inventoryCollection.deleteOne(
          query,
          { session }
        );
        if (!inventoryDeleteResult) throw new Error('Deletion failed (i).');

        if (inventoryDeleteResult?.deletedCount !== 1) {
          await session.endSession();
          return res
            .status(404)
            .send({ message: 'Inventory car unavailable.' });
        }

        await session.commitTransaction();
        await session.endSession();
        return res.status(200).send({ message: 'Deletion successful.' });
      } catch (error) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(500).send({ message: error?.message });
      } finally {
      }
    });

    // Updates quantity and sold cars
    app.post('/api/updateDelivery', validateJWT, async (req, res) => {
      //
      const id = req?.body?.postData;

      // Checks if the objectId is valid.
      try {
        if (!ObjectId.isValid(id)) {
          return res
            .status(406)
            .send({ message: 'The provided ID was invalid.' });
        }
      } catch (error) {
        return res.status(406).send({ message: error.message });
      }

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
        return res.status(500).send({ message: error?.message });
      }
    });

    // Updates quantity and sold cars
    app.post('/api/updateStock', validateJWT, async (req, res) => {
      const id = req?.body?.postData?.id;
      let restockBy = req?.body?.postData?.restockBy;

      if (!id || !restockBy) {
        return res.status(406).send({ message: 'Invalid request.' });
      }

      // Checks if restock value is valid
      if (isNaN(restockBy)) {
        return res.status(406).send({ message: 'Valid number required.' });
      }

      restockBy = parseInt(restockBy);
      if (restockBy <= 0) {
        return res
          .status(406)
          .send({ message: 'Valid positive number required.' });
      }

      // Checks if the objectId is valid.
      try {
        if (!ObjectId.isValid(id)) {
          return res
            .status(406)
            .send({ message: 'The provided ID was invalid.' });
        }
      } catch (error) {
        return res.status(406).send({ message: error.message });
      }

      // Updates the Inventory Car stock value
      const query = { _id: ObjectId(id) };
      try {
        const result = await inventoryCollection.findOneAndUpdate(query, {
          $inc: { quantity: restockBy },
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
