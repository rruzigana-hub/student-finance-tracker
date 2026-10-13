// app.js - connects the modules and handles all events
import * as state from './state.js';
import * as ui from './ui.js';
import { compileRegex, regexError, matchesRecord } from './search.js';
import {
  PATTERNS, validateDescription, validateAmount, validateDate, validateCategory,
  normalizeDescription, validateImport
} from './validators.js';

const $ = id => document.getElementById(id);

const VIEWS = ['about', 'dashboard', 'records', 'add', 'settings'];
const TITLES = { about: 'About', dashboard: 'Dashboard', records: 'Records', add: 'Add expense', settings: 'Settings' };
const SORT_LABELS = {
  date: ['Oldest first', 'Newest first'],
  description: ['A to Z', 'Z to A'],
  amount: ['Low to high', 'High to low']
};

const view = { sortKey: 'date', sortDir: 'desc', editingId: null };
let currentView = null;

/* ---------- Small helpers ---------- */

function announce(msg) {
  const toast = $('toast');
  toast.textContent = msg;
  clearTimeout(announce.timer);
  announce.timer = setTimeout(() => { toast.textContent = ''; }, 7000);
}

function setStatus(id, msg, bad = false) {
  const el = $(id);
  el.textContent = msg;
  el.classList.toggle('bad', bad);
}

function canonicalCategory(value) {
  const match = state.getSettings().categories.find(c => c.toLowerCase() === value.toLowerCase());
  return match || value;
}

/* ---------- Navigation (one section at a time) ---------- */

function showView(moveFocus) {
  let id = location.hash.slice(1);
  if (!VIEWS.includes(id)) {
    if (currentView) return; // e.g. the skip link (#main): keep the current page
    id = 'dashboard';
  }
  currentView = id;
  VIEWS.forEach(v => { $(v).hidden = v !== id; });
  document.querySelectorAll('.nav-list a').forEach(a => {
    if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `${TITLES[id]} - Student Finance Tracker`;
  if (moveFocus) $(id + '-h').focus();
}

/* ---------- Records table ---------- */

function sortRecords(list) {
  const dir = view.sortDir === 'asc' ? 1 : -1;
  return list.slice().sort((a, b) => {
    let c;
    if (view.sortKey === 'amount') c = a.amount - b.amount;
    else if (view.sortKey === 'description') c = a.description.localeCompare(b.description, undefined, { sensitivity: 'base' });
    else c = a.date.localeCompare(b.date);
    return c * dir || a.id.localeCompare(b.id);
  });
}

function renderSortButton() {
  const [asc, desc] = SORT_LABELS[view.sortKey];
  const btn = $('sort-dir');
  const label = view.sortDir === 'asc' ? asc : desc;
  btn.textContent = `${view.sortDir === 'asc' ? '\u2191' : '\u2193'} ${label}`;
  btn.setAttribute('aria-label', `Sort order: ${label}. Activate to reverse.`);
}

function renderTable() {
  const settings = state.getSettings();
  const all = state.getRecords();
  const query = $('search').value;
  const flags = $('search-ci').checked ? 'i' : '';
  const re = compileRegex(query, flags);
  const patternError = query && !re ? regexError(query, flags) : '';

  let list = all;
  if (re) list = all.filter(r => matchesRecord(r, re));
  list = sortRecords(list);

  $('records-body').innerHTML = ui.renderRows(list, { re, settings, editingId: view.editingId });
  renderSortButton();

  // search message
  if (patternError) {
    setStatus('search-msg', `That pattern is not valid yet: ${patternError}`, true);
  } else if (re) {
    setStatus('search-msg', `${list.length} of ${all.length} records match.`);
  } else {
    setStatus('search-msg', '');
  }

  // empty states
  const empty = $('empty');
  const table = $('records-table');
  if (list.length === 0) {
    table.hidden = true;
    empty.hidden = false;
    if (all.length === 0) {
      $('empty-text').textContent = 'No expenses yet. Add your first one, or load the sample data to explore.';
      $('empty-sample').hidden = false;
    } else {
      $('empty-text').textContent = 'No records match this pattern. Change the pattern or clear the search box.';
      $('empty-sample').hidden = true;
    }
  } else {
    table.hidden = false;
    empty.hidden = true;
  }
}

function render() {
  const settings = state.getSettings();
  const records = state.getRecords();
  ui.applyTheme(settings.theme);
  ui.renderCategories(records, settings);
  ui.renderCurrencyBits(settings);
  ui.renderStats(records, settings);
  renderTable();
  if (!state.lastSaveOk) announce('Could not save to this browser. Export your data to keep a copy.');
}

/* ---------- Inline edit and delete ---------- */

function saveRow(row) {
  const get = name => row.querySelector(`[name="${name}"]`);
  const values = {
    date: get('date').value,
    description: get('description').value,
    category: get('category').value,
    amount: get('amount').value
  };
  const errors = {
    date: validateDate(values.date),
    description: validateDescription(values.description),
    category: validateCategory(values.category),
    amount: validateAmount(values.amount)
  };
  Object.keys(errors).forEach(k => get(k).setAttribute('aria-invalid', errors[k] ? 'true' : 'false'));
  const firstBad = Object.keys(errors).find(k => errors[k]);
  if (firstBad) {
    row.querySelector('.row-error').textContent = errors[firstBad];
    get(firstBad).focus();
    return;
  }
  const id = row.dataset.id;
  view.editingId = null;
  state.updateRecord(id, {
    date: values.date,
    description: normalizeDescription(values.description),
    category: canonicalCategory(values.category),
    amount: Number(values.amount)
  });
  announce('Expense updated.');
  document.querySelector(`tr[data-id="${id}"] [data-action="edit"]`)?.focus();
}

function onTableClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('tr');
  const id = row.dataset.id;
  const action = btn.dataset.action;

  if (action === 'edit') {
    view.editingId = id;
    renderTable();
    document.querySelector(`tr[data-id="${id}"] input[name="description"]`)?.focus();
  } else if (action === 'cancel') {
    view.editingId = null;
    renderTable();
    document.querySelector(`tr[data-id="${id}"] [data-action="edit"]`)?.focus();
  } else if (action === 'save') {
    saveRow(row);
  } else if (action === 'delete') {
    const rec = state.getRecords().find(r => r.id === id);
    if (rec && window.confirm(`Delete "${rec.description}"? This cannot be undone.`)) {
      state.deleteRecord(id);
      announce('Expense deleted.');
      $('search').focus();
    }
  }
}

function onTableKeydown(e) {
  const row = e.target.closest('tr.editing');
  if (!row) return;
  if (e.key === 'Enter' && e.target.matches('input')) {
    e.preventDefault();
    saveRow(row);
  } else if (e.key === 'Escape') {
    const id = row.dataset.id;
    view.editingId = null;
    renderTable();
    document.querySelector(`tr[data-id="${id}"] [data-action="edit"]`)?.focus();
  }
}

/* ---------- Add form with live regex validation ---------- */

const form = $('record-form');
const fieldChecks = {
  description: validateDescription,
  amount: validateAmount,
  category: validateCategory,
  date: validateDate
};

function checkField(name) {
  const input = form.elements[name];
  const msg = fieldChecks[name](input.value);
  ui.setFieldError(input, msg);
  return msg;
}

function resetForm() {
  form.reset();
  Object.keys(fieldChecks).forEach(n => ui.setFieldError(form.elements[n], ''));
  form.elements.date.value = ui.toISODate(new Date());
}

function onFormSubmit(e) {
  e.preventDefault();
  const errors = Object.keys(fieldChecks).filter(n => checkField(n));
  if (errors.length) {
    setStatus('form-status', `Please fix ${errors.length} ${errors.length === 1 ? 'field' : 'fields'} and try again.`, true);
    form.elements[errors[0]].focus();
    return;
  }
  const description = normalizeDescription(form.elements.description.value);
  state.addRecord({
    description,
    amount: form.elements.amount.value,
    category: canonicalCategory(form.elements.category.value),
    date: form.elements.date.value
  });
  resetForm();
  setStatus('form-status', `Added "${description}".`);
  announce('Expense added.');
  form.elements.description.focus();
}

/* ---------- Settings ---------- */

const settingsChecks = {
  's-base': v => (PATTERNS.currencyCode.test(v.toUpperCase()) ? '' : 'Use a 3-letter code like USD.'),
  's-cur1': v => (PATTERNS.currencyCode.test(v.toUpperCase()) ? '' : 'Use a 3-letter code like EUR.'),
  's-rate1': v => (PATTERNS.rate.test(v) ? '' : 'Use a number above 0, like 0.92.'),
  's-cur2': v => (PATTERNS.currencyCode.test(v.toUpperCase()) ? '' : 'Use a 3-letter code like RWF.'),
  's-rate2': v => (PATTERNS.rate.test(v) ? '' : 'Use a number above 0, like 1450.'),
  's-cap': v => (PATTERNS.amount.test(v) ? '' : 'Use a number like 3000 or 250.50. Use 0 for no cap.'),
  's-categories': v => {
    const list = v.split(',').map(x => x.trim()).filter(Boolean);
    if (list.length === 0) return 'Add at least one category.';
    const bad = list.find(c => !PATTERNS.category.test(c));
    if (bad) return `"${bad}" is not valid. Use letters, spaces and hyphens only.`;
    const lower = list.map(c => c.toLowerCase());
    if (new Set(lower).size !== lower.length) return 'Each category must be different.';
    return '';
  }
};

function onSettingsSubmit(e) {
  e.preventDefault();
  const errors = {};
  Object.keys(settingsChecks).forEach(id => {
    errors[id] = settingsChecks[id]($(id).value.trim());
  });
  const codes = ['s-base', 's-cur1', 's-cur2'].map(id => $(id).value.trim().toUpperCase());
  if (!errors['s-cur1'] && codes[1] === codes[0]) errors['s-cur1'] = 'Use a different code from the base currency.';
  if (!errors['s-cur2'] && (codes[2] === codes[0] || codes[2] === codes[1])) errors['s-cur2'] = 'Use a code you have not used yet.';

  Object.keys(errors).forEach(id => ui.setFieldError($(id), errors[id]));
  const firstBad = Object.keys(errors).find(id => errors[id]);
  if (firstBad) {
    setStatus('settings-status', 'Settings not saved. Fix the marked fields.', true);
    $(firstBad).focus();
    return;
  }

  const current = state.getSettings();
  const next = {
    baseCurrency: codes[0],
    currencies: [
      { code: codes[1], rate: Number($('s-rate1').value) },
      { code: codes[2], rate: Number($('s-rate2').value) }
    ],
    cap: Number($('s-cap').value),
    categories: $('s-categories').value.split(',').map(x => x.trim()).filter(Boolean)
  };
  next.displayCurrency = [codes[0], codes[1], codes[2]].includes(current.displayCurrency) ? current.displayCurrency : codes[0];
  state.updateSettings(next);
  ui.fillSettingsForm(state.getSettings());
  setStatus('settings-status', 'Settings saved.');
  announce('Settings saved.');
}

/* ---------- Data: export, import, sample, clear ---------- */

function exportJson() {
  const blob = new Blob([JSON.stringify(state.getRecords(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finance-tracker-${ui.toISODate(new Date())}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus('data-status', `Exported ${state.getRecords().length} records.`);
}

function loadValidated(data, sourceName) {
  const result = validateImport(data);
  if (!result.ok) {
    const shown = result.errors.slice(0, 4).join(' ');
    const more = result.errors.length > 4 ? ` And ${result.errors.length - 4} more problems.` : '';
    setStatus('data-status', `Import failed (${sourceName}). Nothing was changed. ${shown}${more}`, true);
    return;
  }
  const have = state.getRecords().length;
  const ask = have
    ? `Replace your ${have} current records with ${result.records.length} records from ${sourceName}?`
    : `Load ${result.records.length} records from ${sourceName}?`;
  if (!window.confirm(ask)) {
    setStatus('data-status', 'Import cancelled.');
    return;
  }
  view.editingId = null;
  state.replaceRecords(result.records);
  setStatus('data-status', `Loaded ${result.records.length} records from ${sourceName}.`);
  announce('Records loaded.');
}

async function onImportFile(e) {
  const file = e.target.files[0];
  e.target.value = ''; // lets the same file be chosen again
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    setStatus('data-status', 'Import failed. That file is not valid JSON. Nothing was changed.', true);
    return;
  }
  loadValidated(data, file.name);
}

async function loadSample() {
  try {
    const res = await fetch('seed.json');
    if (!res.ok) throw new Error('bad response');
    loadValidated(await res.json(), 'seed.json');
  } catch {
    setStatus('data-status', 'Could not load seed.json. Run the app from a web server or GitHub Pages.', true);
    announce('Could not load the sample data.');
  }
}

function clearAll() {
  if (window.confirm('Delete all records? This cannot be undone. Export first if you want a copy.')) {
    state.replaceRecords([]);
    setStatus('data-status', 'All records deleted.');
  }
}

/* ---------- Wire everything up ---------- */

function init() {
  // navigation
  window.addEventListener('hashchange', () => showView(true));

  // search + sort
  $('search-form').addEventListener('submit', e => e.preventDefault());
  $('search').addEventListener('input', renderTable);
  $('search-ci').addEventListener('change', renderTable);
  $('sort-key').addEventListener('change', e => {
    view.sortKey = e.target.value;
    view.sortDir = view.sortKey === 'date' ? 'desc' : 'asc';
    renderTable();
  });
  $('sort-dir').addEventListener('click', () => {
    view.sortDir = view.sortDir === 'asc' ? 'desc' : 'asc';
    renderTable();
  });

  // table
  $('records-body').addEventListener('click', onTableClick);
  $('records-body').addEventListener('keydown', onTableKeydown);

  // add form
  Object.keys(fieldChecks).forEach(name => {
    form.elements[name].addEventListener('input', () => checkField(name));
    form.elements[name].addEventListener('blur', () => checkField(name));
  });
  form.addEventListener('submit', onFormSubmit);

  // settings
  $('settings-form').addEventListener('submit', onSettingsSubmit);
  $('display-currency').addEventListener('change', e => {
    state.updateSettings({ displayCurrency: e.target.value });
    announce(`Showing amounts in ${e.target.value}.`);
  });
  $('theme-toggle').addEventListener('click', () => {
    state.updateSettings({ theme: state.getSettings().theme === 'dark' ? 'light' : 'dark' });
  });

  // data
  $('export-btn').addEventListener('click', exportJson);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', onImportFile);
  $('sample-btn').addEventListener('click', loadSample);
  $('empty-sample').addEventListener('click', loadSample);
  $('clear-btn').addEventListener('click', clearAll);

  state.subscribe(render);
  ui.fillSettingsForm(state.getSettings());
  form.elements.date.value = ui.toISODate(new Date());
  render();
  showView(false);
}

init();