require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working' });
});

app.post('/api/test', (req, res) => {
  res.json({ message: 'POST request received' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
