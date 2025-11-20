const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

let movieCollection;

async function run() {
  await client.connect();
  const db = client.db("movieMasterDB");
  movieCollection = db.collection("movies");
}
run();

// Routes

app.get('/movies', async (req, res) => {
  const result = await movieCollection.find().toArray();
  res.send(result);
});

app.get('/movies/:id', async (req, res) => {
  const id = req.params.id;
  const result = await movieCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.post('/movies', async (req, res) => {
  const movie = req.body;
  const result = await movieCollection.insertOne(movie);
  res.send(result);
});

app.get('/', (req, res) => {
  res.send('✅ Movie Master Server is Running!');
});

app.get('/test', (req, res) => {
  res.json({ message: '✅ Server is working perfectly!' });
});

module.exports = app;

