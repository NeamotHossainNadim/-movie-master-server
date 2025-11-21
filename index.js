const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://amarmoviehouse.netlify.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

const {
  DB_USER,
  DB_PASS,
  DB_NAME = 'movieMasterDB',
  PORT = 5000
} = process.env;

const uri = `mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.0qeoous.mongodb.net/${DB_NAME}?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let movieCollection = null;

async function connectDB() {
  if (movieCollection) return movieCollection;

  if (!DB_USER || !DB_PASS) {
    throw new Error("DB credentials missing");
  }

  await client.connect();
  const db = client.db(DB_NAME);
  movieCollection = db.collection('movies');
  console.log('✅ MongoDB Connected');
  return movieCollection;
}

app.get('/', (req, res) => {
  res.send('✅ MovieMaster API is running!');
});

/* ========================
   GET ALL MOVIES
======================== */
app.get('/movies', async (req, res) => {
  try {
    const collection = await connectDB();
    const { genre, minRating, maxRating } = req.query;
    const filter = {};

    if (genre) filter.genre = { $in: genre.split(',') };
    if (minRating || maxRating) {
      filter.rating = {};
      if (minRating) filter.rating.$gte = Number(minRating);
      if (maxRating) filter.rating.$lte = Number(maxRating);
    }

    const movies = await collection.find(filter).sort({ createdAt: -1 }).toArray();
    res.json(movies);
  } catch {
    res.status(500).json({ error: "Failed to fetch movies" });
  }
});

/* ========================
   GET SINGLE MOVIE
======================== */
app.get('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }

    const movie = await collection.findOne({ _id: new ObjectId(id) });
    if (!movie) return res.status(404).json({ error: "Movie not found" });

    res.json(movie);
  } catch {
    res.status(500).json({ error: "Failed to fetch movie" });
  }
});

/* ========================
   GET MY MOVIES
======================== */
app.get('/my-movies/:email', async (req, res) => {
  try {
    const collection = await connectDB();
    const email = req.params.email;

    const movies = await collection
      .find({ addedBy: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(movies);
  } catch {
    res.status(500).json({ error: "Failed to fetch user movies" });
  }
});

/* ========================
   ADD MOVIE
======================== */
app.post('/movies', async (req, res) => {
  try {
    const collection = await connectDB();
    const movie = req.body;

    if (!movie.title || !movie.addedBy) {
      return res.status(400).json({ error: "Title & addedBy required" });
    }

    movie.createdAt = new Date();

    const result = await collection.insertOne(movie);
    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch {
    res.status(500).json({ error: "Failed to add movie" });
  }
});

/* ========================
   UPDATE MOVIE
======================== */
app.put('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const { userEmail, ...updateData } = req.body;

    const movie = await collection.findOne({ _id: new ObjectId(id) });
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    if (movie.addedBy !== userEmail) {
      return res.status(403).json({ error: 'Not allowed to update' });
    }

    delete updateData._id;
    delete updateData.addedBy;
    delete updateData.createdAt;

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    res.json({ success: true, message: "Movie updated" });
  } catch {
    res.status(500).json({ error: "Failed to update" });
  }
});

/* ========================
   ✅ FIXED DELETE MOVIE
======================== */
app.delete('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid movie ID" });
    }

    // ✅ Safe way to get userEmail from multiple places
    const userEmail =
      req.headers['user-email'] ||
      req.query.userEmail ||
      req.body?.userEmail;

    if (!userEmail) {
      return res.status(401).json({ error: "User email required to delete" });
    }

    const movie = await collection.findOne({ _id: new ObjectId(id) });

    if (!movie) {
      return res.status(404).json({ error: "Movie not found" });
    }

    if (movie.addedBy !== userEmail) {
      return res.status(403).json({ error: "Unauthorized delete attempt" });
    }

    await collection.deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: "Movie deleted successfully" });

  } catch (error) {
    console.error("❌ Delete Failed:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ========================
   TOP RATED MOVIES
======================== */
app.get('/top-rated', async (req, res) => {
  try {
    const collection = await connectDB();
    const movies = await collection.find().sort({ rating: -1 }).limit(5).toArray();
    res.json(movies);
  } catch {
    res.status(500).json({ error: "Failed to fetch top rated" });
  }
});

/* ========================
   RECENT MOVIES
======================== */
app.get('/recent', async (req, res) => {
  try {
    const collection = await connectDB();
    const movies = await collection.find().sort({ createdAt: -1 }).limit(6).toArray();
    res.json(movies);
  } catch {
    res.status(500).json({ error: "Failed to fetch recent" });
  }
});

/* ========================
   MOVIE COUNT
======================== */
app.get('/stats/count', async (req, res) => {
  try {
    const collection = await connectDB();
    const count = await collection.countDocuments();
    res.json({ totalMovies: count });
  } catch {
    res.status(500).json({ error: "Failed to fetch count" });
  }
});

/* ========================
   SERVER START
======================== */
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
