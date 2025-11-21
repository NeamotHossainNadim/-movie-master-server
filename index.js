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
  credentials: true
}));

app.use(express.json());

const {
  DB_USER,
  DB_PASS,
  DB_NAME = 'movieMasterDB',
  PORT = 5000,
  NODE_ENV
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

  try {
    if (!DB_USER || !DB_PASS) {
      throw new Error('Database credentials not found. Please set DB_USER and DB_PASS environment variables.');
    }

    await client.connect();
    const db = client.db(DB_NAME);
    movieCollection = db.collection('movies');
    console.log('MongoDB Connected');
    return movieCollection;
  } catch (error) {
    console.error('MongoDB Connection Failed:', error.message);
    throw error;
  }
}

app.get('/', (req, res) => {
  res.send('MovieMaster API is running successfully!');
});

app.get('/health', async (req, res) => {
  try {
    console.log('Health check - Environment variables status:');
    console.log('DB_USER:', DB_USER ? '✓ Set' : '✗ Missing');
    console.log('DB_PASS:', DB_PASS ? '✓ Set' : '✗ Missing');
    console.log('DB_NAME:', DB_NAME);
    
    await connectDB();

    res.json({ 
      status: 'healthy',
      database: 'connected',
      environment: NODE_ENV || 'development',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      details: NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

app.get('/movies', async (req, res) => {
  try {
    console.log('Fetching movies...');
    console.log('Environment check - DB_USER:', DB_USER ? '✓' : '✗');
    console.log('Environment check - DB_PASS:', DB_PASS ? '✓' : '✗');
    
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

    console.log('Query filter:', JSON.stringify(filter));
    
    const movies = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`Found ${movies.length} movies`);
    res.json(movies);
  } catch (error) {
    console.error('Error in /movies:', error);
    res.status(500).json({ 
      error: 'Failed to fetch movies', 
      details: error.message,
      stack: NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});


app.get('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid movie ID format' });
    }

    const movie = await collection.findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }

    res.json(movie);
  } catch (error) {
    console.error('Error in /movies/:id:', error);
    res.status(500).json({ 
      error: 'Failed to fetch movie', 
      details: error.message 
    });
  }
});

app.get('/my-movies/:email', async (req, res) => {
  try {
    const collection = await connectDB();

    const movies = await collection
      .find({ addedBy: req.params.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(movies);
  } catch (error) {
    console.error('Error in /my-movies:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user movies', 
      details: error.message 
    });
  }
});

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
    console.error('Error in POST /movies:', error);
    res.status(500).json({ 
      error: 'Failed to add movie', 
      details: error.message 
    });
  }
});

app.put('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid movie ID format' });
    }

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
    console.error('Error in PUT /movies/:id:', error);
    res.status(500).json({ 
      error: 'Failed to update movie', 
      details: error.message 
    });
  }
});

app.delete('/movies/:id', async (req, res) => {
  try {
    const collection = await connectDB();
    const id = req.params.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid movie ID format' });
    }

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
    console.error('Error in DELETE /movies/:id:', error);
    res.status(500).json({ 
      error: 'Failed to delete movie', 
      details: error.message 
    });
  }
});


app.get('/top-rated', async (req, res) =>{
  try {
    const collection = await connectDB();

    const movies = await collection
      .find()
      .sort({ rating: -1 })
      .limit(5)
      .toArray();

    res.json(movies);
  } catch (error) {
    console.error('Error in /top-rated:', error);
    res.status(500).json({ 
      error: 'Failed to fetch top rated movies', 
      details: error.message 
    });
  }
});

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
    console.error('Error in /recent:', error);
    res.status(500).json({ 
      error: 'Failed to fetch recent movies', 
      details: error.message 
    });
  }
});

app.get('/stats/count', async (req, res) => {
  try {
    const collection = await connectDB();

    const count = await collection.countDocuments();

    res.json({ totalMovies: count });
  } catch (error) {
    console.error('Error in /stats/count:', error);
    res.status(500).json({ 
      error: 'Failed to fetch movie count', 
      details: error.message 
    });
  }
});

if (NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;