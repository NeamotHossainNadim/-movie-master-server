const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// ---------- Middleware ----------
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://amarmoviehouse.netlify.app"
  ],
  credentials: true
}));

app.use(express.json());

// ---------- Environment variables ----------
const {
  DB_USER,
  DB_PASS,
  DB_NAME = 'movieMasterDB',
  PORT = 5000,
  NODE_ENV
} = process.env;

// ---------- MongoDB URI ----------
const uri = `mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.0qeoous.mongodb.net/${DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;

// ---------- Mongo Client (Vercel safe) ----------
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let movieCollection = null;

// ---------- Safe DB connection ----------
async function connectDB() {
  if (movieCollection) return movieCollection;

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    movieCollection = db.collection('movies');
    console.log('✅ MongoDB Connected');
    return movieCollection;
  } catch (error) {
    console.error('❌ MongoDB Connection Failed:', error.message);
    throw error;
  }
}

// ---------- Test Route ----------
app.get('/', (req, res) => {
  res.send('✅ MovieMaster API is running successfully!');
});

// ---------- Get All Movies ----------
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
      if (minRating) filter.rating.$gte = Number(minRating);
      if (maxRating) filter.rating.$lte = Number(maxRating);
    }

    const movies = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movies', details: error.message });
  }
});

// ---------- Get Single Movie ----------
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movie', details: error.message });
  }
});

// ---------- Get Movies By User ----------
app.get('/my-movies/:email', async (req, res) => {
  try {
    const collection = await connectDB();

    const movies = await collection
      .find({ addedBy: req.params.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user movies', details: error.message });
  }
});

// ---------- Add Movie ----------
app.post('/movies', async (req, res) => {
  try {
    const collection = await connectDB();
    const movie = req.body;

    if (!movie.title || !movie.addedBy) {
      return res.status(400).json({
        error: 'Title and addedBy are required'
      });
    }

    movie.createdAt = new Date();

    const result = await collection.insertOne(movie);

    res.status(201).json({
      success: true,
      insertedId: result.insertedId
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add movie', details: error.message });
  }
});

// ---------- Update Movie (Owner Only) ----------
app.put('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const id = req.params.id;

    const { userEmail, ...updateData } = req.body;

    const movie = await collection.findOne({ _id: new ObjectId(id) });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    if (movie.addedBy !== userEmail) {
      return res.status(403).json({ error: 'You are not allowed to update this movie' });
    }

    delete updateData._id;
    delete updateData.addedBy;
    delete updateData.createdAt;

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    res.json({ success: true, message: 'Movie updated successfully' });

  } catch (error) {
    res.status(500).json({ error: 'Failed to update movie', details: error.message });
  }
});

// ---------- Delete Movie (Owner Only) ----------
app.delete('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const id = req.params.id;
    const { userEmail } = req.body;

    const movie = await collection.findOne({ _id: new ObjectId(id) });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    if (movie.addedBy !== userEmail) {
      return res.status(403).json({ error: 'You are not allowed to delete this movie' });
    }

    await collection.deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: 'Movie deleted successfully' });

  } catch (error) {
    res.status(500).json({ error: 'Failed to delete movie', details: error.message });
  }
});

// ---------- Top Rated Movies ----------
app.get('/top-rated', async (req, res) => {
  try {
    const collection = await connectDB();

    const movies = await collection
      .find()
      .sort({ rating: -1 })
      .limit(5)
      .toArray();

    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch top rated movies', details: error.message });
  }
});

// ---------- Recently Added Movies ----------
app.get('/recent', async (req, res) => {
  try {
    const collection = await connectDB();

    const movies = await collection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent movies', details: error.message });
  }
});

// ---------- Stats ----------
app.get('/stats/count', async (req, res) => {
  try {
    const collection = await connectDB();

    const count = await collection.countDocuments();

    res.json({ totalMovies: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch movie count', details: error.message });
  }
});

// ✅ Only run locally — NOT for Vercel
if (NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

// ✅ Export for Vercel
module.exports = app;
