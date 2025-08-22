const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'db.json');

// Helper function to read data from db.json
const readReports = () => {
  const dbRaw = fs.readFileSync(dbPath);
  return JSON.parse(dbRaw).reports;
};

// Helper function to write data to db.json
const writeReports = (reports) => {
  fs.writeFileSync(dbPath, JSON.stringify({ reports }, null, 2));
};

// GET /api/reports - Get all reports
app.get('/api/reports', (req, res) => {
  const reports = readReports();
  res.json(reports);
});

// POST /api/reports - Create a new report
app.post('/api/reports', (req, res) => {
  const reports = readReports();
  const newReport = {
    id: Date.now(),
    upvotes: 0, // Initialize votes
    downvotes: 0, // Initialize votes
    ...req.body
  };
  reports.push(newReport);
  writeReports(reports);
  res.status(201).json(newReport);
});

// POST /api/reports/:id/vote - Vote on a report
app.post('/api/reports/:id/vote', (req, res) => {
  const reports = readReports();
  const reportId = parseInt(req.params.id, 10);
  const { vote } = req.body; // expecting { vote: 'up' } or { vote: 'down' }

  const reportIndex = reports.findIndex(r => r.id === reportId);

  if (reportIndex === -1) {
    return res.status(404).json({ message: 'Report not found' });
  }

  if (vote === 'up') {
    reports[reportIndex].upvotes += 1;
  } else if (vote === 'down') {
    reports[reportIndex].downvotes += 1;
  } else {
    return res.status(400).json({ message: 'Invalid vote type' });
  }

  writeReports(reports);
  res.json(reports[reportIndex]);
});


app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});