// ui.js - functions that build HTML and update the page
import { highlight, escapeHtml as esc } from './search.js';

const $ = id => document.getElementById(id);

export function toISODate(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function rateFor(code, s) {
  if (code === s.baseCurrency) return 1;
  const c = s.currencies.find(x => x.code === code);
  return c ? Number(c.rate) : 1;
}

export function formatMoney(amountBase, s, code = s.displayCurrency) {
  const value = amountBase * rateFor(code, s);
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

/* ---------- Table rows ---------- */

function viewRow(r, re, s) {
  const id = esc(r.id);
  const name = esc(r.description);
  return `<tr data-id="${id}">
    <td data-label="Date">${highlight(r.date, re)}</td>
    <td data-label="Description">${highlight(r.description, re)}</td>
    <td data-label="Category">${highlight(r.category, re)}</td>
    <td data-label="Amount" class="num">${esc(formatMoney(r.amount, s))}</td>
    <td class="actions">
      <button type="button" class="btn small" data-action="edit" aria-label="Edit ${name}">Edit</button>
      <button type="button" class="btn small danger" data-action="delete" aria-label="Delete ${name}">Delete</button>
    </td>
  </tr>`;
}

function editRow(r, s) {
  return `<tr data-id="${esc(r.id)}" class="editing">
    <td data-label="Date"><input type="text" name="date" value="${esc(r.date)}" aria-label="Date, YYYY-MM-DD" inputmode="numeric" autocomplete="off"></td>
    <td data-label="Description"><input type="text" name="description" value="${esc(r.description)}" aria-label="Description" autocomplete="off"></td>
    <td data-label="Category"><input type="text" name="category" value="${esc(r.category)}" list="category-list" aria-label="Category" autocomplete="off"></td>
    <td data-label="Amount" class="num"><input type="text" name="amount" value="${r.amount.toFixed(2)}" aria-label="Amount in ${esc(s.baseCurrency)}" inputmode="decimal" autocomplete="off"></td>
    <td class="actions">
      <button type="button" class="btn small primary" data-action="save">Save</button>
      <button type="button" class="btn small" data-action="cancel">Cancel</button>
      <span class="row-error" role="alert"></span>
    </td>
  </tr>`;
}

export function renderRows(list, { re, settings, editingId }) {
  return list.map(r => (r.id === editingId ? editRow(r, settings) : viewRow(r, re, settings))).join('');
}

/* ---------- Dashboard ---------- */

function setLive(el, msg) {
  if (el.textContent !== msg) el.textContent = msg;
}

export function renderStats(records, s) {
  const total = records.reduce((sum, r) => sum + r.amount, 0);

  $('stat-count').textContent = String(records.length);
  $('stat-sum').textContent = formatMoney(total, s);

  // top category by amount spent
  const byCat = new Map();
  records.forEach(r => byCat.set(r.category, (byCat.get(r.category) || 0) + r.amount));
  let top = null;
  byCat.forEach((amt, cat) => { if (!top || amt > top.amt) top = { cat, amt }; });
  $('stat-top').textContent = top ? `${top.cat} (${formatMoney(top.amt, s)})` : 'None yet';

  // last 7 days trend
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push({
      iso: toISODate(d),
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      full: d.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' }),
      sum: 0
    });
  }
  records.forEach(r => {
    const day = days.find(d => d.iso === r.date);
    if (day) day.sum += r.amount;
  });
  const max = Math.max(...days.map(d => d.sum), 0);
  const short = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
  const rate = rateFor(s.displayCurrency, s);
  $('trend').innerHTML = days.map(d => {
    const pct = max > 0 ? Math.round((d.sum / max) * 100) : 0;
    return `<li>
      <span class="sr-only">${esc(d.full)}: ${esc(formatMoney(d.sum, s))}</span>
      <span class="val" aria-hidden="true">${short.format(d.sum * rate)}</span>
      <span class="bar" style="--h:${pct}%" aria-hidden="true"></span>
      <span class="day" aria-hidden="true">${esc(d.label)}</span>
    </li>`;
  }).join('');
  const weekTotal = days.reduce((sum, d) => sum + d.sum, 0);
  $('trend-total').textContent = `Total for the last 7 days: ${formatMoney(weekTotal, s)}.`;

  // spending cap
  const polite = $('cap-polite');
  const assertive = $('cap-assertive');
  const progress = $('cap-progress');
  if (!s.cap) {
    progress.value = 0;
    progress.classList.remove('over');
    $('cap-text').textContent = 'No cap set. Add one in Settings.';
    setLive(polite, '');
    setLive(assertive, '');
    return;
  }
  const remaining = s.cap - total;
  progress.value = Math.min(100, Math.round((total / s.cap) * 100));
  progress.classList.toggle('over', remaining < 0);
  if (remaining >= 0) {
    const msg = `You have ${formatMoney(remaining, s)} left of your ${formatMoney(s.cap, s)} cap.`;
    $('cap-text').textContent = msg;
    setLive(assertive, '');
    setLive(polite, msg);
  } else {
    const msg = `You are over your ${formatMoney(s.cap, s)} cap by ${formatMoney(-remaining, s)}.`;
    $('cap-text').textContent = msg;
    setLive(polite, '');
    setLive(assertive, msg);
  }
}

/* ---------- Other bits of the page ---------- */

export function renderCategories(records, s) {
  const all = [...s.categories];
  records.forEach(r => {
    if (!all.some(c => c.toLowerCase() === r.category.toLowerCase())) all.push(r.category);
  });
  $('category-list').innerHTML = all.map(c => `<option value="${esc(c)}"></option>`).join('');
}

export function renderCurrencyBits(s) {
  const codes = [s.baseCurrency, s.currencies[0].code, s.currencies[1].code];
  $('display-currency').innerHTML = codes
    .map(c => `<option value="${esc(c)}"${c === s.displayCurrency ? ' selected' : ''}>${esc(c)}</option>`)
    .join('');
  $('currency-note').textContent =
    `Amounts are shown in ${s.displayCurrency}. When you add or edit an amount, use ${s.baseCurrency}.`;
  $('add-note').textContent = `Enter the amount in ${s.baseCurrency}.`;
}

export function fillSettingsForm(s) {
  $('s-base').value = s.baseCurrency;
  $('s-cur1').value = s.currencies[0].code;
  $('s-rate1').value = String(s.currencies[0].rate);
  $('s-cur2').value = s.currencies[1].code;
  $('s-rate2').value = String(s.currencies[1].rate);
  $('s-cap').value = String(s.cap);
  $('s-categories').value = s.categories.join(', ');
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = $('theme-toggle');
  btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
}

export function setFieldError(input, msg) {
  const err = $(`${input.id}-error`);
  if (err) err.textContent = msg;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}