// storage.js - save and load from localStorage, with error handling
import { validateRecordShape } from './validators.js';

const RECORDS_KEY = 'sft:records';
const SETTINGS_KEY = 'sft:settings';

export const DEFAULT_SETTINGS = {
  baseCurrency: 'USD',
  currencies: [
    { code: 'EUR', rate: 0.92 },
    { code: 'RWF', rate: 1450 }
  ],
  displayCurrency: 'USD',
  cap: 3000,
  categories: ['Food', 'Books', 'Transport', 'Entertainment', 'Fees', 'Other'],
  theme: 'light'
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback; // broken JSON or storage blocked
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // storage full or blocked
  }
}

export function loadRecords() {
  const data = read(RECORDS_KEY, []);
  if (!Array.isArray(data)) return [];
  return data.filter(r => validateRecordShape(r) === ''); // drop malformed records
}

export function saveRecords(records) {
  return write(RECORDS_KEY, records);
}

export function loadSettings() {
  const saved = read(SETTINGS_KEY, {});
  const s = { ...DEFAULT_SETTINGS, ...(saved && typeof saved === 'object' ? saved : {}) };
  const goodCurrencies = Array.isArray(s.currencies) && s.currencies.length === 2 &&
    s.currencies.every(c => c && typeof c.code === 'string' && Number(c.rate) > 0);
  if (!goodCurrencies) s.currencies = DEFAULT_SETTINGS.currencies;
  if (!Array.isArray(s.categories) || s.categories.length === 0) s.categories = DEFAULT_SETTINGS.categories;
  if (typeof s.cap !== 'number' || s.cap < 0) s.cap = DEFAULT_SETTINGS.cap;
  const codes = [s.baseCurrency, s.currencies[0].code, s.currencies[1].code];
  if (!codes.includes(s.displayCurrency)) s.displayCurrency = s.baseCurrency;
  if (s.theme !== 'dark') s.theme = 'light';
  return s;
}

export function saveSettings(settings) {
  return write(SETTINGS_KEY, settings);
}