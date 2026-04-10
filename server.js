const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, 'data', 'flashcards.db');
const db = new Database(DB_PATH, { readonly: true });

// Prepared statements
const stmtChapters = db.prepare(`
  SELECT chapter AS slug, chapter_name AS name, COUNT(*) AS count
  FROM questions
  GROUP BY chapter
  ORDER BY MIN(id)
`);

const stmtAll = db.prepare('SELECT * FROM questions ORDER BY id');
const stmtByChapter = db.prepare('SELECT * FROM questions WHERE chapter = ? ORDER BY id');

function parseQuestion(row) {
  return { ...row, options: JSON.parse(row.options) };
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/chapters', (_req, res) => {
  res.json(stmtChapters.all());
});

app.get('/api/questions', (req, res) => {
  const { chapter } = req.query;
  const rows = chapter && chapter !== 'all'
    ? stmtByChapter.all(chapter)
    : stmtAll.all();
  res.json(rows.map(parseQuestion));
});

const totalCount = db.prepare('SELECT COUNT(*) AS n FROM questions').get().n;
app.listen(PORT, () => {
  console.log(`dk-flashcards running on port ${PORT} with ${totalCount} questions`);
});
