// state.js - the single source of truth. Every change is auto-saved.
import * as storage from './storage.js';

let records = storage.loadRecords();
let settings = storage.loadSettings();
const listeners = new Set();

export let lastSaveOk = true;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  lastSaveOk = storage.saveRecords(records) && storage.saveSettings(settings);
  listeners.forEach(fn => fn());
}

export const getRecords = () => records.slice();
export const getSettings = () => settings;

function nextId() {
  const max = records.reduce((highest, r) => {
    const m = /^rec_(\d+)$/.exec(r.id);
    return m ? Math.max(highest, Number(m[1])) : highest;
  }, 0);
  return 'rec_' + String(max + 1).padStart(4, '0');
}

export function addRecord({ description, amount, category, date }) {
  const now = new Date().toISOString();
  const rec = { id: nextId(), description, amount: Number(amount), category, date, createdAt: now, updatedAt: now };
  records.push(rec);
  commit();
  return rec;
}

export function updateRecord(id, changes) {
  const rec = records.find(r => r.id === id);
  if (!rec) return false;
  Object.assign(rec, changes, { updatedAt: new Date().toISOString() });
  commit();
  return true;
}

export function deleteRecord(id) {
  records = records.filter(r => r.id !== id);
  commit();
}

export function replaceRecords(list) {
  records = list;
  commit();
}

export function updateSettings(patch) {
  settings = { ...settings, ...patch };
  commit();
}