const STORAGE_KEY = 'dk-flashcards-progress';

const state = {
  allQuestions: [],
  currentDeck: [],
  currentIndex: 0,
  isFlipped: false,
  selectedChapter: 'all',
  progress: {}
};

const $ = id => document.getElementById(id);

async function init() {
  state.progress = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  const [questions, chapters] = await Promise.all([
    fetch('/api/questions').then(r => r.json()),
    fetch('/api/chapters').then(r => r.json())
  ]);

  state.allQuestions = questions;

  const select = $('chapterFilter');
  chapters.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch.slug;
    opt.textContent = `${ch.name} (${ch.count})`;
    select.appendChild(opt);
  });

  buildDeck();
  bindEvents();
}

function buildDeck() {
  let deck = state.selectedChapter === 'all'
    ? [...state.allQuestions]
    : state.allQuestions.filter(q => q.chapter === state.selectedChapter);

  shuffle(deck);
  state.currentDeck = deck;
  state.currentIndex = 0;
  state.isFlipped = false;
  showCard();
  updateScore();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function showCard() {
  const { currentDeck, currentIndex } = state;

  if (currentIndex >= currentDeck.length) {
    showDoneScreen();
    return;
  }

  $('doneScreen').style.display = 'none';
  $('cardContainer').style.display = 'block';
  $('cardCounter').style.display = 'block';

  const q = currentDeck[currentIndex];
  const chClass = `ch-${q.chapter}`;

  $('cardChapter').className = `card-chapter ${chClass}`;
  $('cardChapter').textContent = q.chapterName;
  $('cardChapterBack').className = `card-chapter ${chClass}`;
  $('cardChapterBack').textContent = q.chapterName;
  $('cardQuestion').textContent = q.question;
  $('cardAnswer').textContent = q.answer;

  state.isFlipped = false;
  $('flashcard').classList.remove('flipped');

  $('cardCounter').textContent = `${currentIndex + 1} / ${currentDeck.length}`;
}

function revealAnswer() {
  if (state.isFlipped || state.currentIndex >= state.currentDeck.length) return;
  state.isFlipped = true;
  $('flashcard').classList.add('flipped');
}

function markAnswer(correct) {
  if (!state.isFlipped) return;
  const q = state.currentDeck[state.currentIndex];
  state.progress[q.id] = correct;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  state.currentIndex++;
  state.isFlipped = false;
  showCard();
  updateScore();
}

function updateScore() {
  const deck = state.currentDeck;
  let correct = 0, wrong = 0;
  deck.forEach(q => {
    if (state.progress[q.id] === true) correct++;
    else if (state.progress[q.id] === false) wrong++;
  });
  const remaining = deck.length - correct - wrong;
  const pct = deck.length > 0 ? ((correct + wrong) / deck.length * 100) : 0;

  document.querySelector('.correct-count').textContent = correct;
  document.querySelector('.wrong-count').textContent = wrong;
  document.querySelector('.remaining-count').textContent = remaining;
  $('progressFill').style.width = `${pct}%`;
}

function showDoneScreen() {
  $('cardContainer').style.display = 'none';
  $('cardCounter').style.display = 'none';
  $('doneScreen').style.display = 'block';

  const deck = state.currentDeck;
  let correct = 0, wrong = 0;
  deck.forEach(q => {
    if (state.progress[q.id] === true) correct++;
    else if (state.progress[q.id] === false) wrong++;
  });

  const pct = deck.length > 0 ? Math.round(correct / deck.length * 100) : 0;
  $('doneMessage').textContent = `Du svarede rigtigt på ${correct} ud af ${deck.length} spørgsmål (${pct}%).`;

  const hasWrong = deck.some(q => state.progress[q.id] === false);
  $('reviewWrongBtn').style.display = hasWrong ? 'inline-block' : 'none';
}

function reviewWrong() {
  const wrongCards = state.currentDeck.filter(q => state.progress[q.id] === false);
  wrongCards.forEach(q => delete state.progress[q.id]);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  shuffle(wrongCards);
  state.currentDeck = wrongCards;
  state.currentIndex = 0;
  state.isFlipped = false;
  $('doneScreen').style.display = 'none';
  $('cardContainer').style.display = 'block';
  $('cardCounter').style.display = 'block';
  showCard();
  updateScore();
}

function bindEvents() {
  $('revealBtn').addEventListener('click', revealAnswer);
  $('correctBtn').addEventListener('click', () => markAnswer(true));
  $('wrongBtn').addEventListener('click', () => markAnswer(false));

  $('chapterFilter').addEventListener('change', e => {
    state.selectedChapter = e.target.value;
    buildDeck();
  });

  $('shuffleBtn').addEventListener('click', () => {
    state.currentDeck.forEach(q => delete state.progress[q.id]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    buildDeck();
  });

  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Nulstil alle fremskridt?')) return;
    state.progress = {};
    localStorage.removeItem(STORAGE_KEY);
    buildDeck();
  });

  $('restartBtn').addEventListener('click', buildDeck);
  $('reviewWrongBtn').addEventListener('click', reviewWrong);

  document.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!state.isFlipped) revealAnswer();
    }
    if (e.key === 'ArrowRight' && state.isFlipped) markAnswer(true);
    if (e.key === 'ArrowLeft' && state.isFlipped) markAnswer(false);
  });

  // Swipe support
  let touchStartX = 0;
  $('cardContainer').addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
  });
  $('cardContainer').addEventListener('touchend', e => {
    const diff = e.changedTouches[0].screenX - touchStartX;
    if (!state.isFlipped && Math.abs(diff) < 30) {
      revealAnswer();
    } else if (state.isFlipped) {
      if (diff > 50) markAnswer(true);
      else if (diff < -50) markAnswer(false);
    }
  });
}

init();
