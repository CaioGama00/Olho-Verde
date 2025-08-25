require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = 3001;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// GET /api/reports - Get all reports
app.get('/api/reports', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT id, problem, lat, lng, upvotes, downvotes FROM reports');
    // Convert lat and lng to numbers
    const reports = rows.map(report => ({
        ...report,
        position: {
            lat: parseFloat(report.lat),
            lng: parseFloat(report.lng)
        }
    }));
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reports - Create a new report (protected)
app.post('/api/reports', authenticateToken, async (req, res) => {
    const { problem, position } = req.body;
    const { lat, lng } = position;
    const { id: user_id } = req.user;

    try {
        const { rows } = await db.query(
            'INSERT INTO reports (problem, lat, lng, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [problem, lat, lng, user_id]
        );
        const newReport = {
            ...rows[0],
            position: {
                lat: parseFloat(rows[0].lat),
                lng: parseFloat(rows[0].lng)
            }
        }
        res.status(201).json(newReport);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/reports/:id/vote - Vote on a report (protected)
app.post('/api/reports/:id/vote', authenticateToken, async (req, res) => {
    const reportId = parseInt(req.params.id, 10);
    const { vote } = req.body; // expecting { vote: 'up' } or { vote: 'down' }

    let query;
    if (vote === 'up') {
        query = 'UPDATE reports SET upvotes = upvotes + 1 WHERE id = $1 RETURNING *';
    } else if (vote === 'down') {
        query = 'UPDATE reports SET downvotes = downvotes + 1 WHERE id = $1 RETURNING *';
    } else {
        return res.status(400).json({ message: 'Invalid vote type' });
    }

    try {
        const { rows } = await db.query(query, [reportId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Report not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (rows.length > 0) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const { rows: newRows } = await db.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );

        res.status(201).json({ message: 'User created successfully', user: newRows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/login - Login a user
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Cannot find user' });
        }

        if (await bcrypt.compare(password, user.password)) {
            const accessToken = jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn: '1h' });
            res.json({ accessToken: accessToken });
        } else {
            res.status(401).json({ message: 'Not Allowed' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});