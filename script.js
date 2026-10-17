/* =========================================================
   My Personal Morning Paper
   Plain JS. RSS via CORS proxies, localStorage for state.
   ========================================================= */

/* ---------- Config ---------- */
const TOPICS = [
  { id: 'world',    label: 'World',          feeds: ['https://feeds.bbci.co.uk/news/world/rss.xml'] },
  { id: 'pakistan', label: 'Pakistan',       feeds: ['https://www.dawn.com/feeds/home'] },
  { id: 'tech',     label: 'Technology',     feeds: ['https://feeds.bbci.co.uk/news/technology/rss.xml'] },
  { id: 'ai',       label: 'AI',             feeds: ['https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'] },
  { id: 'business', label: 'Business',       feeds: ['https://feeds.bbci.co.uk/news/business/rss.xml'] },
  { id: 'science',  label: 'Science',        feeds: ['https://feeds.bbci.co.uk/news/science_and_environment/rss.xml'] },
  { id: 'space',    label: 'Space',          feeds: ['https://www.space.com/feeds/all'] },
  { id: 'health',   label: 'Health',         feeds: ['https://feeds.bbci.co.uk/news/health/rss.xml'] },
  { id: 'sports',   label: 'Sports',         feeds: ['https://feeds.bbci.co.uk/sport/rss.xml'] },
  { id: 'culture',  label: 'Entertainment',  feeds: ['https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml'] },
  { id: 'politics', label: 'Politics',       feeds: ['https://feeds.bbci.co.uk/news/politics/rss.xml'] },
  { id: 'dev',      label: 'Programming',    feeds: ['https://hnrss.org/frontpage'] },
];

const DEPTH = { brief: 10, standard: 18, deep: 28 };

const PROXIES = [
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

const STOPWORDS = new Set(('about after again against also because been before being between both could does doing down during each from have having here into just like more most much only other over said says same should some such than that their them then there these they this those through under until very what when where which while will with would your says say new news year years first last one two over amid').split(' '));

const MAX_ARCHIVE = 30;

/* ---------- Storage helpers ---------- */
const store = {
  get(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v === null || v === undefined ? fallback : v;
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full or blocked */ }
  },
};

/* ---------- State ---------- */
let profile  = store.get('mp_profile', null);                       // { name, topics[], depth, created }
let learning = store.get('mp_learning', { topics: {}, words: {} }); // learned weights
let editions = store.get('mp_editions', {});                        // { 'YYYY-MM-DD': edition }
let current  = null;                                                // edition currently on screen
let onb      = { step: 1, topics: new Set() };

/* ---------- Tiny DOM helpers ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(str = '') {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function topicLabel(id) {
  const t = TOPICS.find((t) => t.id === id);
  return t ? t.label : id;
}

function greetingFor(name) {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${name}. Here is what matters to you today.`;
}

/* ---------- View routing ---------- */
function showView(name) {
  ['onboarding', 'edition', 'archive'].forEach((v) => {
    $('#view-' + v).hidden = v !== name;
  });
  $('#topbar').hidden = name === 'onboarding';
  $$('.nav-btn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo({ top: 0 });
}

/* =========================================================
   ONBOARDING
   ========================================================= */
function renderChips(container, selectedSet, onChange) {
  container.innerHTML = '';
  TOPICS.forEach((t) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (selectedSet.has(t.id) ? ' selected' : '');
    chip.textContent = t.label;
    chip.addEventListener('click', () => {
      if (selectedSet.has(t.id)) selectedSet.delete(t.id);
      else selectedSet.add(t.id);
      chip.classList.toggle('selected');
      onChange();
    });
    container.appendChild(chip);
  });
}

function goStep(n) {
  onb.step = n;
  $$('.onb-step').forEach((s) => (s.hidden = Number(s.dataset.step) !== n));
  $$('#onb-progress .dot').forEach((d, i) => d.classList.toggle('active', i < n));
}

function updateTopicHint() {
  const n = onb.topics.size;
  $('#onb-next-2').disabled = n < 3;
  $('#topic-hint').textContent = n < 3 ? `Pick ${3 - n} more` : `${n} topics selected`;
}

function initOnboarding() {
  showView('onboarding');
  goStep(1);
  renderChips($('#topic-chips'), onb.topics, updateTopicHint);
  updateTopicHint();

  $('#onb-next-1').onclick = () => {
    const name = $('#onb-name').value.trim();
    if (!name) { $('#onb-name').focus(); return; }
    goStep(2);
  };
  $('#onb-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#onb-next-1').click(); });
  $('#onb-back-2').onclick = () => goStep(1);
  $('#onb-next-2').onclick = () => goStep(3);
  $('#onb-back-3').onclick = () => goStep(2);
  $('#onb-finish').onclick = () => {
    const depth = ($('input[name="depth"]:checked') || {}).value || 'standard';
    profile = {
      name: $('#onb-name').value.trim(),
      topics: Array.from(onb.topics),
      depth,
      created: dateKey(),
    };
    store.set('mp_profile', profile);
    // Seed the learning model with the chosen topics
    profile.topics.forEach((t) => { learning.topics[t] = learning.topics[t] || 1; });
    store.set('mp_learning', learning);
    openToday(true);
  };
}

/* =========================================================
   FETCHING
   ========================================================= */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

async function fetchText(url) {
  let lastErr;
  for (const makeUrl of PROXIES) {
    try {
      const res = await withTimeout(fetch(makeUrl(url)), 9000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (text && text.includes('<')) return text;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('all proxies failed');
}

function stripHtml(html = '') {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

function firstSentences(text, maxChars = 220) {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return (lastStop > 80 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, '') + '\u2026');
}

function parseFeed(xmlText, topic, feedUrl) {
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  if (doc.querySelector('parsererror')) return [];
  const source = (doc.querySelector('channel > title, feed > title') || {}).textContent || new URL(feedUrl).hostname;
  const nodes = Array.from(doc.querySelectorAll('item, entry')).slice(0, 14);

  return nodes.map((n) => {
    const get = (tag) => { const el = n.getElementsByTagName(tag)[0]; return el ? el.textContent.trim() : ''; };
    const linkEl = n.getElementsByTagName('link')[0];
    const link = linkEl ? (linkEl.getAttribute('href') || linkEl.textContent.trim()) : '';
    const title = stripHtml(get('title'));
    const summary = firstSentences(stripHtml(get('description') || get('summary') || get('content')));
    const pub = get('pubDate') || get('published') || get('updated');

    let image = '';
    const thumb = n.getElementsByTagName('media:thumbnail')[0] || n.getElementsByTagName('media:content')[0];
    if (thumb) image = thumb.getAttribute('url') || '';
    if (!image) {
      const enc = n.getElementsByTagName('enclosure')[0];
      if (enc && (enc.getAttribute('type') || '').startsWith('image')) image = enc.getAttribute('url') || '';
    }

    return {
      id: hash(link || title),
      title, link, summary, image,
      source: source.replace(/^BBC News - /, 'BBC News · ').trim(),
      topic,
      published: pub ? new Date(pub).getTime() || Date.now() : Date.now(),
    };
  }).filter((a) => a.title && a.link);
}

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return 'a' + (h >>> 0).toString(36);
}

/* =========================================================
   PERSONALISATION: scoring and selection
   ========================================================= */
function tokens(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function scoreArticle(a) {
  const topicWeight = learning.topics[a.topic] ?? 1;
  const kw = tokens(a.title).reduce((sum, w) => sum + (learning.words[w] || 0), 0);
  const hoursOld = Math.max(0, (Date.now() - a.published) / 36e5);
  const recency = Math.max(0, 1.2 - hoursOld / 30);       // fresh stories get up to +1.2
  const image = a.image ? 0.15 : 0;                       // slight lean to stories with pictures
  const jitter = Math.random() * 0.25;                    // keeps the paper from being identical on refresh
  return topicWeight + Math.max(-2, Math.min(3, kw)) + recency + image + jitter;
}

function buildSelection(all, total) {
  const seen = new Set();
  const unique = all.filter((a) => {
    const key = a.link || a.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  unique.forEach((a) => { a.score = scoreArticle(a); });
  unique.sort((a, b) => b.score - a.score);

  const picked = [];
  const counts = {};
  const cap = Math.max(4, Math.ceil(total / 2.5));

  // Pass 1: guarantee each chosen topic gets at least two stories
  profile.topics.forEach((t) => {
    unique.filter((a) => a.topic === t).slice(0, 2).forEach((a) => {
      picked.push(a);
      counts[t] = (counts[t] || 0) + 1;
    });
  });
  // Pass 2: fill the rest by score, respecting per-topic cap
  for (const a of unique) {
    if (picked.length >= total) break;
    if (picked.includes(a)) continue;
    if ((counts[a.topic] || 0) >= cap) continue;
    picked.push(a);
    counts[a.topic] = (counts[a.topic] || 0) + 1;
  }
  return picked.sort((a, b) => b.score - a.score).slice(0, total);
}

function makeTakeaways(articles) {
  // Top three stories from three different topics, one sentence each
  const out = [];
  const usedTopics = new Set();
  for (const a of articles) {
    if (usedTopics.has(a.topic)) continue;
    usedTopics.add(a.topic);
    out.push({ title: a.title, topic: a.topic, id: a.id });
    if (out.length === 3) break;
  }
  return out;
}

async function buildEdition(onProgress) {
  const all = [];
  let done = 0;
  const jobs = [];

  profile.topics.forEach((tid) => {
    const topic = TOPICS.find((t) => t.id === tid);
    if (!topic) return;
    topic.feeds.forEach((feedUrl) => {
      jobs.push(
        fetchText(feedUrl)
          .then((xml) => parseFeed(xml, tid, feedUrl))
          .catch(() => [])
          .then((items) => {
            done++;
            onProgress && onProgress(done, jobs.length, topic.label);
            all.push(...items);
          })
      );
    });
  });
  await Promise.all(jobs);

  if (!all.length) throw new Error('no articles');

  const articles = buildSelection(all, DEPTH[profile.depth] || 18);
  const key = dateKey();
  return {
    key,
    built: Date.now(),
    name: profile.name,
    articles,
    takeaways: makeTakeaways(articles),
    feedback: {},   // id -> 'like' | 'skip'
  };
}

/* =========================================================
   RENDERING THE PAPER
   ========================================================= */
function storyHTML(a, size, ed) {
  const fb = ed.feedback[a.id];
  const showImg = a.image && (size === 'xl' || size === 'lg');
  let host = '';
  try { host = new URL(a.link).hostname.replace(/^www\./, ''); } catch (e) { /* ignore */ }
  return `
    <div class="story ${size}" data-id="${a.id}">
      <span class="tag">${esc(topicLabel(a.topic))}</span>
      ${showImg ? `<img src="${esc(a.image)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <h3>${esc(a.title)}</h3>
      <div class="meta">${esc(a.source)}</div>
      ${a.summary ? `<p>${esc(a.summary)}</p>` : ''}
      <div class="src-url">${esc(host)} \u2014 ${esc(a.link)}</div>
      <div class="actions">
        <a href="${esc(a.link)}" target="_blank" rel="noopener" data-act="read">Read original \u2197</a>
        <button type="button" data-act="like" class="${fb === 'like' ? 'liked' : ''}">${fb === 'like' ? '\u2713 Liked' : '\uD83D\uDC4D More like this'}</button>
        <button type="button" data-act="skip">\u2715 Skip</button>
      </div>
    </div>`;
}

function renderEdition(ed, readOnly = false) {
  current = ed;
  const visible = ed.articles.filter((a) => ed.feedback[a.id] !== 'skip');
  const words = visible.reduce((n, a) => n + (a.title + ' ' + a.summary).split(/\s+/).length, 0);
  const readMins = Math.max(1, Math.round(words / 90)); // generous: includes click-through skim time

  const lead = visible[0];
  const side = visible.slice(1, 3);
  const rest = visible.slice(3);
  const issueNo = Object.keys(editions).sort().indexOf(ed.key) + 1 || 1;
  const takeaways = ed.takeaways.filter((t) => ed.feedback[t.id] !== 'skip');

  $('#paper').innerHTML = `
    <header class="masthead">
      <div class="kicker"><span>Issue No. ${issueNo}</span><span>Printed for ${esc(ed.name)}</span><span>${visible.length} stories</span></div>
      <h1>The ${esc(ed.name)} Morning Paper</h1>
      <div class="dateline"><span>${esc(prettyDate(ed.key))}</span><span>About ${readMins} min to read</span><span>${esc(profile.topics.map(topicLabel).slice(0, 4).join(' \u00B7 '))}</span></div>
    </header>

    <p class="greeting">${esc(greetingFor(ed.name))}</p>

    ${takeaways.length ? `
    <section class="takeaways">
      <h2>Three things to know today</h2>
      <ol>${takeaways.map((t) => `<li><b>${esc(topicLabel(t.topic))}:</b> ${esc(t.title)}</li>`).join('')}</ol>
    </section>` : ''}

    ${lead ? `
    <div class="section-label">Front Page</div>
    <section class="front">
      <div class="lead">${storyHTML(lead, 'xl', ed)}</div>
      <div class="side">${side.map((a) => storyHTML(a, 'lg', ed)).join('')}</div>
    </section>` : ''}

    ${rest.length ? `
    <div class="section-label">More for You</div>
    <section class="columns">${rest.map((a) => storyHTML(a, 'md', ed)).join('')}</section>` : ''}

    <footer class="paper-footer">Compiled from ${new Set(visible.map((a) => a.source)).size} sources for ${esc(ed.name)} \u00B7 Every headline links to the original article</footer>
  `;

  $('#paper').hidden = false;
  $('#loading').hidden = true;
  $('#error').hidden = true;
  $('#learn-panel').hidden = false;
  $('#btn-refresh').hidden = readOnly || ed.key !== dateKey();
  $('#status').textContent = readOnly ? 'Viewing a past edition' : '';
  renderLearning();
}

function renderLearning() {
  const entries = profile.topics.map((t) => [t, learning.topics[t] ?? 1]);
  const max = Math.max(2, ...entries.map((e) => e[1]));
  $('#learn-bars').innerHTML = entries
    .sort((a, b) => b[1] - a[1])
    .map(([t, w]) => `
      <div class="bar-row">
        <div class="bar-label"><span>${esc(topicLabel(t))}</span><span>${w.toFixed(1)}</span></div>
        <div class="bar"><i style="width:${Math.max(4, Math.min(100, (w / max) * 100))}%"></i></div>
      </div>`).join('');

  const words = Object.entries(learning.words).filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1]).slice(0, 12);
  $('#learn-words').innerHTML = words.length
    ? words.map(([w]) => `<span>${esc(w)}</span>`).join('')
    : '<em>Nothing yet. Like a few stories.</em>';
}

/* =========================================================
   LEARNING FROM FEEDBACK
   ========================================================= */
function learnFrom(article, signal) {
  const delta = { like: { topic: 0.8, word: 0.5 }, skip: { topic: -0.5, word: -0.35 }, read: { topic: 0.25, word: 0.15 } }[signal];
  if (!delta) return;
  learning.topics[article.topic] = Math.max(0.1, (learning.topics[article.topic] ?? 1) + delta.topic);
  tokens(article.title).forEach((w) => {
    learning.words[w] = Math.max(-3, Math.min(4, (learning.words[w] || 0) + delta.word));
  });
  // Keep the word table small
  const keys = Object.keys(learning.words);
  if (keys.length > 400) {
    keys.sort((a, b) => Math.abs(learning.words[a]) - Math.abs(learning.words[b]))
      .slice(0, keys.length - 300).forEach((k) => delete learning.words[k]);
  }
  store.set('mp_learning', learning);
}

function saveCurrentEdition() {
  if (!current) return;
  editions[current.key] = current;
  store.set('mp_editions', editions);
}

function handlePaperClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el || !current) return;
  const card = el.closest('.story');
  const article = current.articles.find((a) => a.id === card.dataset.id);
  if (!article) return;
  const act = el.dataset.act;

  if (act === 'read') {
    learnFrom(article, 'read');
    saveCurrentEdition();
    renderLearning();
    return; // let the link open normally
  }

  if (act === 'like') {
    if (current.feedback[article.id] === 'like') return;
    current.feedback[article.id] = 'like';
    learnFrom(article, 'like');
    el.classList.add('liked');
    el.textContent = '\u2713 Liked';
    toast('Noted. More ' + topicLabel(article.topic) + ' stories coming.');
  }

  if (act === 'skip') {
    current.feedback[article.id] = 'skip';
    learnFrom(article, 'skip');
    card.classList.add('removing');
    setTimeout(() => renderEdition(current, current.key !== dateKey()), 300);
    toast('Skipped. We will show fewer stories like this.');
  }

  saveCurrentEdition();
  renderLearning();
}

let toastTimer;
function toast(msg) {
  const s = $('#status');
  s.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { s.textContent = ''; }, 3200);
}

/* =========================================================
   OPENING EDITIONS
   ========================================================= */
async function openToday(forceBuild = false) {
  showView('edition');
  const key = dateKey();

  if (!forceBuild && editions[key]) {
    renderEdition(editions[key], false);
    return;
  }

  $('#paper').hidden = true;
  $('#error').hidden = true;
  $('#learn-panel').hidden = true;
  $('#loading').hidden = false;
  $('#loading-text').textContent = 'Gathering your stories\u2026';
  $('#btn-refresh').hidden = true;

  try {
    const ed = await buildEdition((done, total, label) => {
      $('#loading-text').textContent = `Reading ${label}\u2026 (${done}/${total})`;
    });
    editions[ed.key] = ed;
    pruneArchive();
    store.set('mp_editions', editions);
    renderEdition(ed, false);
  } catch (err) {
    $('#loading').hidden = true;
    $('#error').hidden = false;
    $('#error').innerHTML = `
      <h3>We couldn't reach the news feeds</h3>
      <p>Check your connection and try again. The free proxy services we use can be busy.</p>
      <button class="btn primary" id="btn-retry">Try again</button>`;
    $('#btn-retry').onclick = () => openToday(true);
  }
}

function pruneArchive() {
  const keys = Object.keys(editions).sort();
  while (keys.length > MAX_ARCHIVE) delete editions[keys.shift()];
}

function renderArchive() {
  showView('archive');
  const keys = Object.keys(editions).sort().reverse();
  const list = $('#archive-list');
  if (!keys.length) {
    list.innerHTML = '<p class="empty-note">No papers yet. Your first edition will appear here.</p>';
    return;
  }
  list.innerHTML = keys.map((k) => {
    const ed = editions[k];
    const head = ed.articles[0] ? ed.articles[0].title : '';
    return `
      <div class="archive-item" data-key="${k}">
        <div>
          <div class="a-date">${esc(prettyDate(k))}${k === dateKey() ? ' \u00B7 Today' : ''}</div>
          <div class="a-head">${esc(head)}</div>
        </div>
        <div class="a-count">${ed.articles.length} stories</div>
      </div>`;
  }).join('');

  $$('.archive-item', list).forEach((item) => {
    item.onclick = () => {
      showView('edition');
      renderEdition(editions[item.dataset.key], item.dataset.key !== dateKey());
    };
  });
}

/* =========================================================
   PDF EXPORT
   ========================================================= */
async function downloadPDF() {
  if (!current) return;
  const paper = $('#paper');
  const btn = $('#btn-pdf');
  btn.disabled = true;
  btn.textContent = 'Preparing PDF\u2026';

  paper.classList.add('pdf-mode');
  const opt = {
    margin: [8, 10, 8, 10],
    filename: `morning-paper-${current.key}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 820 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['.story', '.takeaways', '.masthead'] },
  };

  try {
    await html2pdf().set(opt).from(paper).save();
  } catch (e) {
    toast('PDF export failed. Please try again.');
  } finally {
    paper.classList.remove('pdf-mode');
    btn.disabled = false;
    btn.innerHTML = '\u21E9 Download PDF';
  }
}

/* =========================================================
   INTERESTS MODAL
   ========================================================= */
let prefsSet = new Set();
function openPrefs() {
  prefsSet = new Set(profile.topics);
  renderChips($('#prefs-chips'), prefsSet, () => {
    $('#prefs-save').disabled = prefsSet.size < 3;
  });
  $('#prefs-save').disabled = prefsSet.size < 3;
  $('#prefs-modal').hidden = false;
}

/* =========================================================
   INIT
   ========================================================= */
function init() {
  $('#paper').addEventListener('click', handlePaperClick);
  $('#btn-pdf').onclick = downloadPDF;
  $('#btn-refresh').onclick = () => openToday(true);

  $$('.nav-btn[data-view]').forEach((b) => {
    b.onclick = () => {
      if (!profile) return;
      if (b.dataset.view === 'archive') renderArchive();
      else openToday(false);
    };
  });

  $('#btn-prefs').onclick = openPrefs;
  $('#prefs-cancel').onclick = () => { $('#prefs-modal').hidden = true; };
  $('#prefs-save').onclick = () => {
    profile.topics = Array.from(prefsSet);
    profile.topics.forEach((t) => { learning.topics[t] = learning.topics[t] ?? 1; });
    store.set('mp_profile', profile);
    store.set('mp_learning', learning);
    $('#prefs-modal').hidden = true;
    openToday(true);
  };

  $('#btn-reset-learning').onclick = () => {
    if (!confirm('Reset everything the paper has learned about you?')) return;
    learning = { topics: {}, words: {} };
    profile.topics.forEach((t) => { learning.topics[t] = 1; });
    store.set('mp_learning', learning);
    renderLearning();
    toast('Learning reset.');
  };

  if (!profile) initOnboarding();
  else openToday(false);
}

document.addEventListener('DOMContentLoaded', init);
