// Kingdom of Agents — slim DOM HUD.
//
// Responsibilities (deliberately tiny):
//   - Theme toggle (sun/moon) that flips body.theme-light and persists
//     the choice in `koa_theme` localStorage. The Phaser scene listens
//     via `window.__koaSetTheme(mode)` and re-renders with light/dark
//     color tokens.
//   - Ops status surface in the top bar (chip + recommendation +
//     alerts badge). The scene calls `window.__koaUpdateOps(summary,
//     alerts)` each time it recomputes opsSummary.
//
// No score/lives/level/pause/game-switcher/settings — this is an
// observability tool, not an arcade. All operational status (active
// sessions, attention alerts, replay state) lives in the canvas.

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function safeGet(key) {
    try { return localStorage.getItem(key); }
    catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); }
    catch (e) { /* quota or private mode — non-fatal */ }
  }

  // -------------------------------------------------------------------
  // Theme toggle (light/dark).
  // -------------------------------------------------------------------

  var themeBtn = $('theme-btn');
  var currentTheme = safeGet('koa_theme') === 'light' ? 'light' : 'dark';

  function applyTheme() {
    var isLight = currentTheme === 'light';
    document.body.classList.toggle('theme-light', isLight);
    if (themeBtn) {
      // Show the icon for the mode you'll switch INTO.
      themeBtn.textContent = isLight ? '🌙' : '☀️';
      themeBtn.title = isLight ? 'Switch to dark theme' : 'Switch to light theme';
    }
    if (typeof window.__koaSetTheme === 'function') {
      window.__koaSetTheme(currentTheme);
    }
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    safeSet('koa_theme', currentTheme);
    applyTheme();
  }

  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Apply immediately so the topbar is correct before Phaser mounts,
  // then re-apply once the scene installs __koaSetTheme so the canvas
  // picks up the same mode.
  applyTheme();
  var attempts = 0;
  var poll = setInterval(function () {
    attempts++;
    if (typeof window.__koaSetTheme === 'function' || attempts > 40) {
      clearInterval(poll);
      applyTheme();
    }
  }, 100);

  // -------------------------------------------------------------------
  // Ops status surface (top-bar chip + recommendation + alert badge).
  // -------------------------------------------------------------------

  var chipEl  = $('ops-chip');
  var recEl   = $('ops-rec');
  var alertEl = $('ops-alert');

  // Map the scene's attention levels to chip CSS classes. Anything
  // unknown falls back to 'calm' so we never render an unstyled chip.
  var ATTENTION_CLASSES = { calm: 'calm', watch: 'watch', review: 'review' };

  function setChip(label, attention) {
    if (!chipEl) return;
    var cls = ATTENTION_CLASSES[attention] || 'calm';
    chipEl.className = cls;
    chipEl.textContent = (label || 'idle').toUpperCase();
  }

  function setRecommendation(text, isPlaceholder) {
    if (!recEl) return;
    var value = text || 'Waiting for Copilot CLI activity…';
    recEl.textContent = value;
    recEl.title = value;
    recEl.classList.toggle('muted', !!isPlaceholder);
  }

  function setAlerts(alerts) {
    if (!alertEl) return;
    var list = Array.isArray(alerts) ? alerts.filter(Boolean) : [];
    if (list.length === 0) {
      alertEl.classList.remove('visible');
      alertEl.textContent = '';
      alertEl.title = '';
      return;
    }
    alertEl.classList.add('visible');
    alertEl.textContent = '! ' + list.length + (list.length === 1 ? ' alert' : ' alerts');
    alertEl.title = list.join('\n');
  }

  // Public API the scene calls after each opsSummary recompute.
  window.__koaUpdateOps = function (summary, alerts) {
    if (!summary) {
      setChip('idle', 'calm');
      setRecommendation('', true);
      setAlerts([]);
      return;
    }
    setChip(summary.mode, summary.attention);
    var rec = summary.recommendation || '';
    var isPlaceholder = !rec || /^run github copilot cli/i.test(rec);
    setRecommendation(rec, isPlaceholder);
    setAlerts(alerts || []);
  };

  // -------------------------------------------------------------------
  // Active model chip in the topbar. The scene calls this whenever the
  // selected session changes OR when its `last_model` value changes
  // between scans (so mid-session model switches surface immediately).
  // Pass an empty string to hide the chip — used on scene shutdown and
  // when no session has emitted a model-bearing event yet.
  // -------------------------------------------------------------------

  var modelEl = $('model-chip');
  var lastModel = '';

  window.__koaUpdateModel = function (model) {
    if (!modelEl) return;
    var next = (model == null ? '' : String(model)).trim();
    if (next === lastModel) return;
    lastModel = next;
    if (next === '') {
      modelEl.classList.add('empty');
      modelEl.textContent = '';
      modelEl.title = 'Active model for the selected session';
    } else {
      modelEl.classList.remove('empty');
      modelEl.textContent = next;
      modelEl.title = 'Active model: ' + next;
    }
  };
})();
