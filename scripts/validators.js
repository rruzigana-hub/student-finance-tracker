// validators.js - all regex rules live here

export const PATTERNS = {
  // 1 to 80 characters, no space at the start or end (lookahead checks the length)
  description: /^(?=.{1,80}$)\S(?:.*\S)?$/,
  // 0, 12, 12.5, 12.50 (no leading zeros, max 2 decimals)
  amount: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  // YYYY-MM-DD
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  // letters, with single spaces or hyphens between words
  category: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  // ADVANCED: back-reference finds a repeated word, like "coffee coffee"
  duplicateWord: /\b(\w+)\s+\1\b/i,
  // two or more spaces in a row (collapsed on save)
  doubleSpace: /\s{2,}/g,
  // currency code like USD
  currencyCode: /^[A-Z]{3}$/,
  // ADVANCED: negative lookahead blocks zero. Rates must be above 0.
  rate: /^(?!0+(\.0+)?$)\d+(\.\d{1,6})?$/
};

export function isRealDate(value) {
  if (!PATTERNS.date.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function validateDescription(value) {
  if (value === '') return 'Enter a description.';
  if (/^\s|\s$/.test(value)) return 'Remove the spaces at the start or end.';
  if (!PATTERNS.description.test(value)) return 'Use 80 characters or fewer.';
  const dup = value.match(PATTERNS.duplicateWord);
  if (dup) return `The word "${dup[1]}" is repeated. Remove the extra one.`;
  return '';
}

export function validateAmount(value) {
  if (value === '') return 'Enter an amount.';
  if (!PATTERNS.amount.test(value)) {
    return 'Use a number like 12 or 12.50. Max 2 decimals, no leading zeros.';
  }
  return '';
}

export function validateDate(value) {
  if (value === '') return 'Enter a date.';
  if (!PATTERNS.date.test(value)) return 'Use the format YYYY-MM-DD, like 2026-10-12.';
  if (!isRealDate(value)) return 'That date does not exist. Check the day and month.';
  return '';
}

export function validateCategory(value) {
  if (value === '') return 'Enter a category.';
  if (!PATTERNS.category.test(value)) {
    return 'Use letters only. Single spaces or hyphens between words are fine.';
  }
  return '';
}

export function normalizeDescription(value) {
  return value.replace(PATTERNS.doubleSpace, ' ');
}

// Checks one record from an imported file. Returns '' when OK.
export function validateRecordShape(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return 'is not an object';
  if (typeof r.id !== 'string' || !/^[\w-]+$/.test(r.id)) return 'has no valid id';
  if (typeof r.description !== 'string' || r.description.trim() === '') return 'has no description';
  if (typeof r.amount !== 'number' || !Number.isFinite(r.amount) || r.amount < 0) return 'has an invalid amount';
  if (typeof r.category !== 'string' || !PATTERNS.category.test(r.category)) return 'has an invalid category';
  if (typeof r.date !== 'string' || !isRealDate(r.date)) return 'has an invalid date';
  for (const key of ['createdAt', 'updatedAt']) {
    if (typeof r[key] !== 'string' || Number.isNaN(Date.parse(r[key]))) return `has an invalid ${key}`;
  }
  return '';
}

// Checks a whole imported file. Accepts a list, or an object with a "records" list.
export function validateImport(data) {
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.records) ? data.records : null);
  if (!list) return { ok: false, records: [], errors: ['The file must contain a list of records.'] };
  if (list.length === 0) return { ok: false, records: [], errors: ['The file has no records.'] };

  const errors = [];
  const seen = new Set();
  list.forEach((r, i) => {
    const problem = validateRecordShape(r);
    if (problem) errors.push(`Record ${i + 1} ${problem}.`);
    else if (seen.has(r.id)) errors.push(`Record ${i + 1} repeats the id "${r.id}".`);
    else seen.add(r.id);
  });

  if (errors.length) return { ok: false, records: [], errors };
  const records = list.map(({ id, description, amount, category, date, createdAt, updatedAt }) =>
    ({ id, description, amount, category, date, createdAt, updatedAt }));
  return { ok: true, records, errors: [] };
}