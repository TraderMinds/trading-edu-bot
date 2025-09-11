const express = require('express');
const app = express();
app.use(express.json());

app.get('/test', (req, res) => {
  res.json({ status: 'working', time: new Date().toISOString() });
});

app.listen(3001, () => {
  console.log('Simple test server running on port 3001');
  console.log('Visit: http://localhost:3001/test');
});