const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://amarmoviehouse.netlify.app"
  ],
  credentials: true
}));

app.use(express.json());

// Environment variables
const {
  DB_USER,
  DB_PASS,
  DB_NAME = 'movieMasterDB',
  PORT = 5000
} = process.env;

// MongoDB URI
const uri = `mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.0qeoous.mongodb.net/${DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;

// Mongo client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let movieCollection;

// ✅ Safe MongoDB connection for serverless
async function connectDB() {
  try {
    if (!movieCollection) {
      await client.connect();
      const db = client.db(DB_NAME);
      movieCollection = db.collection('movies');
      console.log('✅ MongoDB connected');
    }
    return movieCollection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}

// Test route
app.get('/', (req, res) => {
  res.send('✅ MovieMaster Pro Server is Running!');
});

// ✅ Get all movies
app.get('/movies', async (req, res) => {
  try {
    const collection = await connectDB();

    const { genre, minRating, maxRating } = req.query;
    const filter = {};

    if (genre) {
      filter.genre = { $in: genre.split(',') };
    }

    if (minRating || maxRating) {
      filter.rating = {};
      if (minRating) filter.rating.$gte = parseFloat(minRating);
      if (maxRating) filter.rating.$lte = parseFloat(maxRating);
    }

    const movies = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get single movie by ID
app.get('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();

    const movie = await collection.findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.json(movie);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get movies by user
app.get('/my-movies/:email', async (req, res) => {
  try {
    const collection = await connectDB();

    const movies = await collection
      .find({ addedBy: req.params.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Add movie
app.post('/movies', async (req, res) => {
  try {
    const collection = await connectDB();
    const movie = req.body;

    if (!movie.title || !movie.addedBy) {
      return res.status(400).json({
        error: 'Title and addedBy (email) are required'
      });
    }

    movie.createdAt = new Date();

    const result = await collection.insertOne(movie);

    res.status(201).json({
      success: true,
      insertedId: result.insertedId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update movie (owner only)
app.put('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const id = req.params.id;

    const { userEmail, ...updateData } = req.body;

    const movie = await collection.findOne({
      _id: new ObjectId(id)
    });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    if (movie.addedBy !== userEmail) {
      return res.status(403).json({
        error: 'Only the owner can edit this movie'
      });
    }

    delete updateData._id;
    delete updateData.addedBy;
    delete updateData.createdAt;

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: 'Movie updated successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete movie (owner only)
app.delete('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const id = req.params.id;
    const { userEmail } = req.body;

    const movie = await collection.findOne({
      _id: new ObjectId(id)
    });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    if (movie.addedBy !== userEmail) {
      return res.status(403).json({
        error: 'Only the owner can delete this movie'
      });
    }

    await collection.deleteOne({ _id: new ObjectId(id) });

    res.json({
      success: true,
      message: 'Movie deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Top rated movies
app.get('/top-rated', async (req, res) => {
  try {
    const collection = await connectDB();

    const movies = await collection
      .find()
      .sort({ rating: -1 })
      .limit(5)
      .toArray();

    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Recently added
app.get('/recent', async (req, res) => {
  try {
    const collection = await connectDB();

    const movies = await collection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Stats
app.get('/stats/count', async (req, res) => {
  try {
    const collection = await connectDB();

    const count = await collection.countDocuments();

    res.json({ totalMovies: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Local server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ✅ Export app for Vercel
module.exports = app;
