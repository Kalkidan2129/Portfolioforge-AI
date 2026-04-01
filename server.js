require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const items = [];

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/api/test', (req, res) => {
  res.json(items);
});

app.post('/api/test', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0 || !req.body.name || req.body.name.trim() === '') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const newItem = {
    name: req.body.name,
    createdAt: new Date()
  };
  items.push(newItem);
  res.json(items);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
