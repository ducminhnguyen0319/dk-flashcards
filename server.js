const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const questions = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'questions.json'), 'utf8')
);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/chapters', (req, res) => {
  const chapters = {};
  for (const q of questions) {
    if (!chapters[q.chapter]) {
      chapters[q.chapter] = { slug: q.chapter, name: q.chapterName, count: 0 };
    }
    chapters[q.chapter].count++;
  }
  res.json(Object.values(chapters));
});

app.get('/api/questions', (req, res) => {
  const { chapter } = req.query;
  if (chapter && chapter !== 'all') {
    return res.json(questions.filter(q => q.chapter === chapter));
  }
  res.json(questions);
});

app.listen(PORT, () => {
  console.log(`dk-flashcards running on port ${PORT} with ${questions.length} questions`);
});
