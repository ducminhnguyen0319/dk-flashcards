#!/usr/bin/env node
// Migrates questions.json → SQLite database
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'flashcards.db');
const JSON_PATH = path.join(DATA_DIR, 'questions.json');

if (!fs.existsSync(JSON_PATH)) {
  console.error('questions.json not found at', JSON_PATH);
  process.exit(1);
}

const questions = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
console.log(`Loaded ${questions.length} questions from JSON`);

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Removed existing database');
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE questions (
    id          INTEGER PRIMARY KEY,
    question    TEXT    NOT NULL,
    options     TEXT    NOT NULL,
    correct     INTEGER NOT NULL,
    explanation TEXT,
    chapter     TEXT    NOT NULL,
    chapter_name TEXT   NOT NULL
  );

  CREATE INDEX idx_chapter ON questions(chapter);
`);

const insert = db.prepare(`
  INSERT INTO questions (id, question, options, correct, explanation, chapter, chapter_name)
  VALUES (@id, @question, @options, @correct, @explanation, @chapter, @chapter_name)
`);

const insertMany = db.transaction((rows) => {
  for (const q of rows) {
    insert.run({
      id: q.id,
      question: q.question,
      options: JSON.stringify(q.options),
      correct: q.correct,
      explanation: q.explanation ?? null,
      chapter: q.chapter,
      chapter_name: q.chapterName,
    });
  }
});

insertMany(questions);
db.close();

console.log(`Migration complete → ${DB_PATH}`);
console.log(`  ${questions.length} questions inserted`);
