// search.js - safe regex search and highlighting

export function compileRegex(input, flags = 'i') {
  try {
    return input ? new RegExp(input, flags) : null;
  } catch {
    return null;
  }
}

// Returns the browser's error message for a bad pattern, or '' if it is fine.
export function regexError(input, flags = 'i') {
  if (!input) return '';
  try {
    new RegExp(input, flags);
    return '';
  } catch (err) {
    return err.message;
  }
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Wraps matches in <mark>. Every piece of text is escaped first, so it is safe.
export function highlight(text, re) {
  const str = String(text);
  if (!re) return escapeHtml(str);
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let out = '';
  let last = 0;
  let m;
  while ((m = g.exec(str)) !== null) {
    if (m[0] === '') { g.lastIndex++; continue; } // skip empty matches
    out += escapeHtml(str.slice(last, m.index)) + '<mark>' + escapeHtml(m[0]) + '</mark>';
    last = m.index + m[0].length;
  }
  return out + escapeHtml(str.slice(last));
}

// A record matches if the pattern is found in any visible field.
export function matchesRecord(rec, re) {
  if (!re) return true;
  const fields = [rec.description, rec.category, rec.date, rec.amount.toFixed(2)];
  return fields.some(f => re.test(f));
}