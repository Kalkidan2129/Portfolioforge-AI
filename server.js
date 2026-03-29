require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const items = [];

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/api/test', (req, res) => {
  res.json(items);
});

app.post('/api/test', (req, res) => {
  items.push({ message: 'New item added' });
  res.json(items);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
