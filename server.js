require('dotenv').config();

const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id          BIGSERIAL PRIMARY KEY,
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      tutor_name   TEXT,
      tutorial_name TEXT NOT NULL,
      session_date  DATE NOT NULL,
      successes     TEXT[],
      failures      TEXT[],
      suggestions   TEXT,
      notes         TEXT
    )
  `);
}

// Run once at startup; errors are logged but don't crash Vercel cold-starts
initDb().catch(err => console.error('DB init error:', err));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Submit feedback
app.post('/api/feedback', async (req, res) => {
  const { tutorName, tutorialName, sessionDate, successes, failures, suggestions, notes } = req.body;

  if (!tutorialName || !sessionDate) {
    return res.status(400).json({ error: 'Tutorial name and session date are required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO feedback (tutor_name, tutorial_name, session_date, successes, failures, suggestions, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        tutorName || 'Anonymous',
        tutorialName,
        sessionDate,
        successes || [],
        failures  || [],
        suggestions || '',
        notes || ''
      ]
    );
    res.status(201).json({ message: 'Feedback submitted.', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save feedback.' });
  }
});

// Retrieve all feedback
app.get('/api/feedback', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM feedback ORDER BY submitted_at DESC');
    const rows = result.rows.map(r => ({
      id:           r.id,
      submittedAt:  r.submitted_at,
      tutorName:    r.tutor_name,
      tutorialName: r.tutorial_name,
      sessionDate:  r.session_date.toISOString().split('T')[0],
      successes:    r.successes || [],
      failures:     r.failures  || [],
      suggestions:  r.suggestions,
      notes:        r.notes
    }));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve feedback.' });
  }
});

// Export as CSV
app.get('/api/feedback/export', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM feedback ORDER BY submitted_at DESC');
    const headers = ['ID', 'Submitted At', 'Tutor Name', 'Tutorial', 'Session Date', 'Successes', 'Failures', 'Suggestions', 'Notes'];
    const rows = result.rows.map(r => [
      r.id,
      r.submitted_at.toISOString(),
      `"${(r.tutor_name || '').replace(/"/g, '""')}"`,
      `"${r.tutorial_name.replace(/"/g, '""')}"`,
      r.session_date.toISOString().split('T')[0],
      `"${(r.successes || []).join('; ')}"`,
      `"${(r.failures  || []).join('; ')}"`,
      `"${(r.suggestions || '').replace(/"/g, '""')}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="tutor-feedback.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export feedback.' });
  }
});

// Export app for Vercel serverless; also listen for local dev
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Tutor Feedback Tool running at http://localhost:${PORT}`));
}
