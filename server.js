const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'feedback.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readFeedback() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeFeedback(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Submit new feedback
app.post('/api/feedback', (req, res) => {
  const { tutorName, tutorialName, sessionDate, successes, failures, suggestions, notes } = req.body;

  if (!tutorialName || !sessionDate) {
    return res.status(400).json({ error: 'Tutorial name and session date are required.' });
  }

  const entry = {
    id: Date.now(),
    submittedAt: new Date().toISOString(),
    tutorName: tutorName || 'Anonymous',
    tutorialName,
    sessionDate,
    successes: successes || [],
    failures: failures || [],
    suggestions: suggestions || '',
    notes: notes || ''
  };

  const all = readFeedback();
  all.push(entry);
  writeFeedback(all);

  res.status(201).json({ message: 'Feedback submitted.', id: entry.id });
});

// Retrieve all feedback
app.get('/api/feedback', (req, res) => {
  res.json(readFeedback());
});

// Export as CSV
app.get('/api/feedback/export', (req, res) => {
  const all = readFeedback();
  const headers = [
    'ID', 'Submitted At', 'Tutor Name', 'Tutorial', 'Session Date',
    'Successes', 'Failures', 'Suggestions', 'Notes'
  ];
  const rows = all.map(e => [
    e.id,
    e.submittedAt,
    `"${e.tutorName}"`,
    `"${e.tutorialName}"`,
    e.sessionDate,
    `"${e.successes.join('; ')}"`,
    `"${e.failures.join('; ')}"`,
    `"${(e.suggestions || '').replace(/"/g, '""')}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="tutor-feedback.csv"');
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`Tutor Feedback Tool running at http://localhost:${PORT}`);
});
