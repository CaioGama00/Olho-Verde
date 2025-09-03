require('dotenv').config();
const express = require('express');
const cors = require('cors');
const supabase = require('./db');
const multer = require('multer');
const axios = require('axios');

const app = express();
const PORT = 3001;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY; // Make sure to add this to your .env file
if (!HUGGINGFACE_API_KEY) {
    console.error('HUGGINGFACE_API_KEY is not set. Please add it to your .env file.');
    process.exit(1);
}

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Middleware to verify Supabase JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error) {
    return res.status(401).json({ error: error.message });
  }

  req.user = user;
  next();
};

// GET /api/reports - Get all reports
app.get('/api/reports', async (req, res) => {
  try {
    const { data, error } = await supabase.from('reports').select('*');
    if (error) throw error;
    const reports = data.map(report => ({
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
        const { data, error } = await supabase
            .from('reports')
            .insert([{ problem, lat, lng, user_id }])
            .select();

        if (error) throw error;

        const newReport = {
            ...data[0],
            position: {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lng)
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
    const { id: user_id } = req.user;

    let newVoteValue;
    if (vote === 'up') {
        newVoteValue = 1;
    } else if (vote === 'down') {
        newVoteValue = -1;
    } else {
        return res.status(400).json({ message: 'Invalid vote type' });
    }

    try {
        const { data, error } = await supabase.rpc('handle_vote', {
            report_id_param: reportId,
            user_id_param: user_id,
            new_vote_value_param: newVoteValue,
        });

        if (error) throw error;

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                },
            },
        });

        if (error) throw error;

        res.status(201).json({ message: 'User created successfully', user: data.user });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
});

// POST /api/auth/login - Login a user
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        res.json({ accessToken: data.session.access_token });
    } catch (err) {
        console.error(err);
        res.status(400).json({ message: err.message });
    }
});

app.post('/api/classify-image', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
    }

    try {
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/microsoft/resnet-50',
            req.file.buffer,
            {
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': req.file.mimetype,
                },
            }
        );

        const trashKeywords = ['trash', 'garbage', 'waste', 'recycling', 'litter', 'plastic bag', 'bottle', 'can'];
        const isTrash = response.data.some(item => trashKeywords.some(keyword => item.label.toLowerCase().includes(keyword)));

        res.json({ isTrash });

    } catch (error) {
        console.error('Error classifying image:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to classify image' });
    }
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});


app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});