// index.js
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const { DB_USER, DB_PASS, DB_NAME, PORT = 5000 } = process.env;

// MongoDB URI - Fix your cluster URL
const uri = `mongodb+srv://${DB_USER}:${DB_PASS}@cluster0.0qeoous.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create MongoDB client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let movieCollection;

// Connect to MongoDB
async function connectDB() {
  try {
    await client.connect();
    const db = client.db(DB_NAME || 'movieMasterDB');
    movieCollection = db.collection('movies');
    console.log('✅ MongoDB connected successfully!');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

connectDB();

// Root route
app.get('/', (req, res) => {
  res.send('✅ MovieMaster Pro Server is Running!');
});

// Get all movies (with optional filters)
app.get('/movies', async (req, res) => {
  try {
    const { genre, minRating, maxRating } = req.query;
    const filter = {};

    // Filter by genre(s)
    if (genre) {
      filter.genre = { $in: genre.split(',') };
    }

    // Filter by rating range
    if (minRating || maxRating) {
      filter.rating = {};
      if (minRating) filter.rating.$gte = parseFloat(minRating);
      if (maxRating) filter.rating.$lte = parseFloat(maxRating);
    }

    const movies = await movieCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single movie by ID
app.get('/movies/:id', async (req, res) => {
  try {
    const movie = await movieCollection.findOne({ 
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

// Get movies by user email (My Collection)
app.get('/my-movies/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const movies = await movieCollection
      .find({ addedBy: email })
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new movie
app.post('/movies', async (req, res) => {
  try {
    const movie = req.body;

    // Validation
    if (!movie.title || !movie.addedBy) {
      return res.status(400).json({ 
        error: 'Title and addedBy (email) are required' 
      });
    }

    // Add timestamp
    movie.createdAt = new Date();

    const result = await movieCollection.insertOne(movie);
    res.status(201).json({ 
      success: true,
      insertedId: result.insertedId 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update movie (owner only)
app.put('/movies/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { userEmail, ...updateData } = req.body;

    // Check if movie exists
    const movie = await movieCollection.findOne({ 
      _id: new ObjectId(id) 
    });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    // Check ownership
    if (movie.addedBy !== userEmail) {
      return res.status(403).json({ 
        error: 'Only the owner can edit this movie' 
      });
    }

    // Remove fields that shouldn't be updated
    delete updateData.addedBy;
    delete updateData.createdAt;
    delete updateData._id;

    // Update movie
    await movieCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    res.json({ success: true, message: 'Movie updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete movie (owner only)
app.delete('/movies/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { userEmail } = req.body;

    // Check if movie exists
    const movie = await movieCollection.findOne({ 
      _id: new ObjectId(id) 
    });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    // Check ownership
    if (movie.addedBy !== userEmail) {
      return res.status(403).json({ 
        error: 'Only the owner can delete this movie' 
      });
    }

    // Delete movie
    await movieCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: 'Movie deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get top rated movies (for homepage)
app.get('/top-rated', async (req, res) => {
  try {
    const movies = await movieCollection
      .find()
      .sort({ rating: -1 })
      .limit(5)
      .toArray();
    
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recently added movies (for homepage)
app.get('/recent', async (req, res) => {
  try {
    const movies = await movieCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get total movie count (for statistics)
app.get('/stats/count', async (req, res) => {
  try {
    const count = await movieCollection.countDocuments();
    res.json({ totalMovies: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Export for Vercel
module.exports = app;