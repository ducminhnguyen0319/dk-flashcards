const STORAGE_KEY = 'dk-fc-progress';
const $ = id => document.getElementById(id);

const state = {
  allQuestions: [],
  deck: [],
  idx: 0,
  answered: false,
  chapter: 'all',
  progress: {},
  // exam
  examQuestions: [],
  examAnswers: {},
  examIdx: 0,
  examTimer: null,
  examTimeLeft: 45 * 60,
};

async function init() {
  state.progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  const [questions, chapters] = await Promise.all([
    fetch('/api/questions').then(r => r.json()),
    fetch('/api/chapters').then(r => r.json())
  ]);
  state.allQuestions = questions;
  const sel = $('chapterFilter');
  chapters.forEach(ch => {
    const o = document.createElement('option');
    o.value = ch.slug;
    o.textContent = `${ch.name} (${ch.count})`;
    sel.appendChild(o);
  });
  bindEvents();
}

// ─── PRACTICE MODE ───
function startPractice() {
  $('modeSelect').style.display = 'none';
  $('practiceMode').style.display = 'block';
  $('keyboardHints').style.display = 'flex';
  buildDeck();
}

function buildDeck() {
  let deck = state.chapter === 'all' ? [...state.allQuestions]
    : state.allQuestions.filter(q => q.chapter === state.chapter);
  shuffle(deck);
  state.deck = deck;
  state.idx = 0;
  state.answered = false;
  $('doneScreen').style.display = 'none';
  $('questionCard').style.display = 'block';
  $('cardCounter').style.display = 'block';
  showPracticeQ();
  updateScore();
}

function showPracticeQ() {
  if (state.idx >= state.deck.length) { showDone(); return; }
  const q = state.deck[state.idx];
  state.answered = false;
  $('cardChapter').className = `card-chapter ch-${q.chapter}`;
  $('cardChapter').textContent = q.chapterName;
  $('cardQuestion').textContent = q.question;
  $('explanation').style.display = 'none';
  $('nextBtn').style.display = 'none';
  renderOptions('optionsContainer', q, (i) => handlePracticeAnswer(q, i));
  $('cardCounter').textContent = `${state.idx + 1} / ${state.deck.length}`;
}

function handlePracticeAnswer(q, chosen) {
  if (state.answered) return;
  state.answered = true;
  const isCorrect = chosen === q.correct;
  state.progress[q.id] = isCorrect;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  highlightOptions('optionsContainer', q, chosen);
  $('explanation').textContent = q.explanation;
  $('explanation').style.display = 'block';
  $('nextBtn').style.display = 'block';
  updateScore();
}

function nextPractice() {
  state.idx++;
  showPracticeQ();
}

function updateScore() {
  const deck = state.deck;
  let c = 0, w = 0;
  deck.forEach(q => {
    if (state.progress[q.id] === true) c++;
    else if (state.progress[q.id] === false) w++;
  });
  document.querySelector('.correct-count').textContent = c;
  document.querySelector('.wrong-count').textContent = w;
  document.querySelector('.remaining-count').textContent = deck.length - c - w;
  $('progressFill').style.width = deck.length ? `${(c + w) / deck.length * 100}%` : '0%';
}

function showDone() {
  $('questionCard').style.display = 'none';
  $('cardCounter').style.display = 'none';
  $('doneScreen').style.display = 'block';
  let c = 0, w = 0;
  state.deck.forEach(q => {
    if (state.progress[q.id] === true) c++;
    else if (state.progress[q.id] === false) w++;
  });
  $('doneMessage').textContent = `Du svarede rigtigt på ${c} ud af ${state.deck.length} (${state.deck.length ? Math.round(c/state.deck.length*100) : 0}%).`;
  $('reviewWrongBtn').style.display = state.deck.some(q => state.progress[q.id] === false) ? 'inline-block' : 'none';
}

// ─── EXAM MODE ───
function startExam() {
  $('modeSelect').style.display = 'none';
  $('examMode').style.display = 'block';
  $('keyboardHints').style.display = 'none';
  const all = [...state.allQuestions];
  shuffle(all);
  state.examQuestions = all.slice(0, 40);
  state.examAnswers = {};
  state.examIdx = 0;
  state.examTimeLeft = 45 * 60;
  buildExamDots();
  showExamQ();
  startTimer();
}

function showExamQ() {
  const q = state.examQuestions[state.examIdx];
  $('examChapter').className = `card-chapter ch-${q.chapter}`;
  $('examChapter').textContent = q.chapterName;
  $('examQuestion').textContent = q.question;
  $('examCurrent').textContent = state.examIdx + 1;
  renderOptions('examOptions', q, (i) => {
    state.examAnswers[state.examIdx] = i;
    highlightSelected('examOptions', i);
    updateExamDots();
  }, state.examAnswers[state.examIdx]);

  $('examPrev').disabled = state.examIdx === 0;
  $('examNext').style.display = state.examIdx < 39 ? 'block' : 'none';
  $('examSubmit').style.display = state.examIdx === 39 ? 'block' : 'none';
  updateExamDots();
}

function buildExamDots() {
  const c = $('examDots');
  c.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const d = document.createElement('div');
    d.className = 'exam-dot';
    d.textContent = i + 1;
    d.addEventListener('click', () => { state.examIdx = i; showExamQ(); });
    c.appendChild(d);
  }
}

function updateExamDots() {
  const dots = $('examDots').children;
  for (let i = 0; i < 40; i++) {
    dots[i].className = 'exam-dot';
    if (i === state.examIdx) dots[i].classList.add('current');
    if (state.examAnswers[i] !== undefined) dots[i].classList.add('answered');
  }
}

function startTimer() {
  clearInterval(state.examTimer);
  state.examTimer = setInterval(() => {
    state.examTimeLeft--;
    if (state.examTimeLeft <= 0) { clearInterval(state.examTimer); submitExam(); return; }
    const m = Math.floor(state.examTimeLeft / 60);
    const s = state.examTimeLeft % 60;
    $('examTimer').textContent = `${m}:${s.toString().padStart(2, '0')}`;
    $('examTimer').className = state.examTimeLeft <= 300 ? 'exam-timer warning' : 'exam-timer';
  }, 1000);
}

function submitExam() {
  clearInterval(state.examTimer);
  let correct = 0, wrong = 0, unanswered = 0;
  const results = [];
  state.examQuestions.forEach((q, i) => {
    const ans = state.examAnswers[i];
    if (ans === undefined) { unanswered++; results.push({ q, chosen: -1, correct: false }); }
    else if (ans === q.correct) { correct++; results.push({ q, chosen: ans, correct: true }); }
    else { wrong++; results.push({ q, chosen: ans, correct: false }); }
  });
  state.examResults = results;
  const pass = correct >= 32;

  $('examMode').style.display = 'none';
  $('examResult').style.display = 'block';
  $('resultIcon').textContent = pass ? '🎉' : '😔';
  $('resultTitle').textContent = pass ? 'Tillykke! Du bestod!' : 'Desværre, ikke bestået';
  $('resultScore').textContent = `${correct} / 40`;
  $('resultScore').className = `result-score ${pass ? 'pass' : 'fail'}`;
  $('resultMessage').textContent = pass
    ? `Du svarede rigtigt på ${correct} ud af 40 spørgsmål. Du skal bruge mindst 32.`
    : `Du svarede rigtigt på ${correct} ud af 40. Du skal bruge mindst 32 for at bestå.`;
  $('resultBreakdown').innerHTML = `
    <div class="stat"><span class="stat-num" style="color:var(--correct)">${correct}</span>Rigtige</div>
    <div class="stat"><span class="stat-num" style="color:var(--wrong)">${wrong}</span>Forkerte</div>
    <div class="stat"><span class="stat-num" style="color:var(--muted)">${unanswered}</span>Ubesvarede</div>
  `;
}

function showExamReview() {
  $('examResult').style.display = 'none';
  $('examReview').style.display = 'block';
  const list = $('reviewList');
  list.innerHTML = '';
  state.examResults.forEach((r, i) => {
    const labels = ['A', 'B', 'C', 'D'];
    const div = document.createElement('div');
    div.className = `review-item ${r.correct ? 'review-correct' : 'review-wrong'}`;
    const yourAns = r.chosen >= 0 ? `${labels[r.chosen]}. ${r.q.options[r.chosen]}` : 'Ikke besvaret';
    div.innerHTML = `
      <div class="review-q">${i + 1}. ${r.q.question}</div>
      <div class="review-your" style="color:${r.correct ? 'var(--correct)' : 'var(--wrong)'}">Dit svar: ${yourAns}</div>
      ${!r.correct ? `<div class="review-right">Rigtigt svar: ${labels[r.q.correct]}. ${r.q.options[r.q.correct]}</div>` : ''}
      <div class="review-expl">${r.q.explanation}</div>
    `;
    list.appendChild(div);
  });
}

// ─── SHARED HELPERS ───
function renderOptions(containerId, q, onClick, preselected) {
  const c = $(containerId);
  c.innerHTML = '';
  const labels = ['A', 'B', 'C', 'D'];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn' + (preselected === i ? ' selected' : '');
    btn.innerHTML = `<span class="option-label">${labels[i]}</span><span>${opt}</span>`;
    btn.addEventListener('click', () => onClick(i));
    c.appendChild(btn);
  });
}

function highlightOptions(containerId, q, chosen) {
  const btns = $(containerId).querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.classList.add('disabled');
    if (i === q.correct) btn.classList.add('correct');
    if (i === chosen && chosen !== q.correct) btn.classList.add('wrong');
  });
}

function highlightSelected(containerId, chosen) {
  const btns = $(containerId).querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.classList.toggle('selected', i === chosen);
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function goToMenu() {
  clearInterval(state.examTimer);
  ['practiceMode', 'examMode', 'examResult', 'examReview'].forEach(id => $(id).style.display = 'none');
  $('modeSelect').style.display = 'flex';
  $('keyboardHints').style.display = 'none';
}

// ─── EVENTS ───
function bindEvents() {
  $('startPractice').addEventListener('click', startPractice);
  $('startExam').addEventListener('click', startExam);
  $('backToMenu').addEventListener('click', goToMenu);
  $('backToMenuFromExam').addEventListener('click', goToMenu);

  $('nextBtn').addEventListener('click', nextPractice);
  $('chapterFilter').addEventListener('change', e => { state.chapter = e.target.value; buildDeck(); });
  $('shuffleBtn').addEventListener('click', () => {
    state.deck.forEach(q => delete state.progress[q.id]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    buildDeck();
  });
  $('restartBtn').addEventListener('click', buildDeck);
  $('reviewWrongBtn').addEventListener('click', () => {
    const wrong = state.deck.filter(q => state.progress[q.id] === false);
    wrong.forEach(q => delete state.progress[q.id]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    shuffle(wrong);
    state.deck = wrong; state.idx = 0;
    $('doneScreen').style.display = 'none';
    $('questionCard').style.display = 'block';
    $('cardCounter').style.display = 'block';
    showPracticeQ(); updateScore();
  });

  $('examPrev').addEventListener('click', () => { if (state.examIdx > 0) { state.examIdx--; showExamQ(); } });
  $('examNext').addEventListener('click', () => { if (state.examIdx < 39) { state.examIdx++; showExamQ(); } });
  $('examSubmit').addEventListener('click', () => {
    const unanswered = 40 - Object.keys(state.examAnswers).length;
    if (unanswered > 0 && !confirm(`Du har ${unanswered} ubesvarede spørgsmål. Vil du alligevel aflevere?`)) return;
    submitExam();
  });
  $('endExam').addEventListener('click', () => {
    if (!confirm('Er du sikker på, at du vil aflevere prøven?')) return;
    submitExam();
  });
  $('reviewExam').addEventListener('click', showExamReview);
  $('newExam').addEventListener('click', () => { $('examResult').style.display = 'none'; startExam(); });
  $('backToResult').addEventListener('click', () => { $('examReview').style.display = 'none'; $('examResult').style.display = 'block'; });

  document.addEventListener('keydown', e => {
    // Practice mode shortcuts
    if ($('practiceMode').style.display !== 'none') {
      if (e.key >= '1' && e.key <= '4' && !state.answered) {
        const q = state.deck[state.idx];
        if (q) handlePracticeAnswer(q, parseInt(e.key) - 1);
      }
      if ((e.key === 'Enter' || e.key === 'ArrowRight') && state.answered) nextPractice();
    }
    // Exam mode shortcuts
    if ($('examMode').style.display !== 'none') {
      if (e.key >= '1' && e.key <= '4') {
        state.examAnswers[state.examIdx] = parseInt(e.key) - 1;
        highlightSelected('examOptions', state.examAnswers[state.examIdx]);
        updateExamDots();
      }
      if (e.key === 'ArrowRight' && state.examIdx < 39) { state.examIdx++; showExamQ(); }
      if (e.key === 'ArrowLeft' && state.examIdx > 0) { state.examIdx--; showExamQ(); }
    }
  });
}

init();
