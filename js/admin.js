import { db } from './firebase.js';
import {
  collection, doc, onSnapshot, query, orderBy, where, addDoc, updateDoc, writeBatch, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireRole, logout, friendly } from './auth.js';
import { $, $$, esc, fmtDate, catOf, CATS, BRANCHES, rules, setState, toast, initFX, hideLoader, reveal, countUp } from './ui.js';

initFX();
setTimeout(hideLoader, 5000);
const { profile } = await requireRole('admin');
$('#meName').textContent = profile.name || 'Admin';
$('#av').textContent = (profile.name || 'A')[0].toUpperCase();

let events = [], students = [], regs = [];
const PAL = ['#7c5cff', '#ff4fa3', '#ffb84d', '#2ee6c5', '#4da3ff', '#c77dff', '#ff7a59', '#9be564'];

// ---------- nav ----------
function show(s) {
  $$('.sec').forEach(x => x.classList.toggle('on', x.id === 'sec-' + s));
  $$('.side .nv[data-s]').forEach(x => x.classList.toggle('on', x.dataset.s === s));
  reveal();
}
$$('.side .nv[data-s]').forEach(a => a.addEventListener('click', () => { show(a.dataset.s); history.replaceState(null, '', '#' + a.dataset.s); }));
if (['overview', 'events', 'students', 'regs'].includes(location.hash.slice(1))) show(location.hash.slice(1));
$('#logout').addEventListener('click', logout);

// ---------- live data ----------
const onErr = e => { console.error(e); toast(friendly(e), 'error'); hideLoader(); };
onSnapshot(query(collection(db, 'events'), orderBy('startsAt')), s => { events = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); hideLoader(); }, onErr);
onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), s => { students = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); }, onErr);
onSnapshot(collection(db, 'registrations'), s => { regs = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); }, onErr);

const ts = r => r.createdAt && r.createdAt.toDate ? r.createdAt.toDate() : new Date();
function renderAll() { renderKPIs(); renderCharts(); renderRecent(); renderEvents(); renderStudents(); renderRegs(); fillFilters(); }

// ---------- overview ----------
function renderKPIs() {
  countUp($('#kStu'), students.length); countUp($('#kEv'), events.length); countUp($('#kReg'), regs.length);
  const cap = events.reduce((a, e) => a + (e.capacity || 0), 0), used = events.reduce((a, e) => a + (e.registeredCount || 0), 0);
  countUp($('#kFill'), cap ? Math.round(used / cap * 100) : 0);
}

let cEvents, cBranch, cDays;
function renderCharts() {
  if (!window.Chart) return;
  Chart.defaults.color = '#9d99c4'; Chart.defaults.borderColor = 'rgba(255,255,255,.08)'; Chart.defaults.font.family = 'Outfit';
  const top = [...events].sort((a, b) => (b.registeredCount || 0) - (a.registeredCount || 0)).slice(0, 8);
  const evData = { labels: top.map(e => e.title.length > 16 ? e.title.slice(0, 15) + '…' : e.title), datasets: [{ data: top.map(e => e.registeredCount || 0), backgroundColor: top.map((_, i) => PAL[i % PAL.length]), borderRadius: 8 }] };
  const br = {}; students.forEach(s => br[s.branch] = (br[s.branch] || 0) + 1);
  const brData = { labels: Object.keys(br), datasets: [{ data: Object.values(br), backgroundColor: PAL, borderWidth: 0 }] };
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const key = d => d.toLocaleDateString('en-CA');
  const dayCount = Object.fromEntries(days.map(d => [key(d), 0]));
  regs.forEach(r => { const k = key(ts(r)); if (k in dayCount) dayCount[k]++; });
  const dData = { labels: days.map(d => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })), datasets: [{ data: Object.values(dayCount), borderColor: '#ff4fa3', backgroundColor: 'rgba(255,79,163,.18)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#ff4fa3' }] };
  const noLegend = { plugins: { legend: { display: false } }, maintainAspectRatio: true };
  const intY = { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } };

  if (!cEvents) {
    cEvents = new Chart($('#cEvents'), { type: 'bar', data: evData, options: { ...noLegend, scales: intY } });
    cBranch = new Chart($('#cBranch'), { type: 'doughnut', data: brData, options: { cutout: '65%', plugins: { legend: { position: 'bottom' } } } });
    cDays = new Chart($('#cDays'), { type: 'line', data: dData, options: { ...noLegend, scales: intY } });
  } else {
    cEvents.data = evData; cBranch.data = brData; cDays.data = dData;
    [cEvents, cBranch, cDays].forEach(c => c.update());
  }
}

function renderRecent() {
  const r = [...regs].sort((a, b) => ts(b) - ts(a)).slice(0, 6);
  $('#recent').innerHTML = r.length ? r.map(x => `<div class="d-flex align-items-center gap-3 py-2 border-bottom" style="border-color:var(--card-b)!important">
    <div class="avatar" style="width:36px;height:36px;font-size:.9rem">${esc((x.studentName || '?')[0])}</div>
    <div class="overflow-hidden"><div class="text-truncate fw-medium">${esc(x.studentName)}</div><small class="muted text-truncate d-block">${esc(x.eventTitle)}</small></div></div>`).join('')
    : '<div class="empty py-4"><i class="bi bi-inbox"></i>No registrations yet</div>';
}

// ---------- events ----------
function renderEvents() {
  $('#evBody').innerHTML = events.length ? events.map(e => {
    const c = catOf(e.category), n = e.registeredCount || 0;
    return `<tr><td><div class="d-flex align-items-center gap-2"><div class="ev-ico" style="--c:${c.c};width:38px;height:38px;font-size:1.05rem;border-radius:12px"><i class="bi ${c.icon}"></i></div><b>${esc(e.title)}</b></div></td>
      <td><span class="chip">${esc(e.category)}</span></td><td>${fmtDate(e.startsAt)}</td><td>${esc(e.venue)}</td>
      <td style="min-width:120px"><div class="bar mb-1"><span style="width:${Math.min(100, n / e.capacity * 100)}%"></span></div><small class="muted">${n} / ${e.capacity}</small></td>
      <td class="text-end text-nowrap"><button class="btn-ghost btn-sm-ghost" data-edit="${e.id}"><i class="bi bi-pencil"></i></button> <button class="btn-danger-ghost" data-del-ev="${e.id}"><i class="bi bi-trash"></i></button></td></tr>`;
  }).join('') : `<tr><td colspan="6"><div class="empty"><i class="bi bi-calendar2-plus"></i>No events yet. Create one or add sample events.</div></td></tr>`;
}

$('#eCat').innerHTML = Object.keys(CATS).map(c => `<option>${c}</option>`).join('');
const evModal = () => bootstrap.Modal.getOrCreateInstance('#evModal');
let editId = null;
const EF = { title: $('#eTitle'), cat: $('#eCat'), desc: $('#eDesc'), date: $('#eDate'), venue: $('#eVenue'), cap: $('#eCap') };
const evCheck = {
  title: () => EF.title.value.trim().length >= 3 ? '' : 'Title must be at least 3 characters',
  cat: () => '',
  desc: () => EF.desc.value.trim().length >= 10 ? '' : 'Description must be at least 10 characters',
  date: () => !EF.date.value ? 'Pick a date and time' : '',
  venue: () => rules.required(EF.venue.value),
  cap: () => { const n = Number(EF.cap.value); if (!Number.isInteger(n) || n < 1 || n > 5000) return 'Capacity must be 1–5000'; const ev = events.find(e => e.id === editId); return ev && n < (ev.registeredCount || 0) ? `Already ${ev.registeredCount} registered` : ''; }
};
Object.keys(EF).forEach(k => EF[k].addEventListener('input', () => setState(EF[k], evCheck[k]())));

function openEvent(id) {
  editId = id || null;
  const e = events.find(x => x.id === id);
  $('#evModalTitle').textContent = e ? 'Edit event' : 'New event';
  EF.title.value = e ? e.title : ''; EF.cat.value = e ? e.category : 'Technical'; EF.desc.value = e ? e.description : '';
  EF.date.value = e ? e.startsAt : ''; EF.venue.value = e ? e.venue : ''; EF.cap.value = e ? e.capacity : '';
  Object.values(EF).forEach(i => { i.classList.remove('is-valid', 'is-invalid'); const fb = i.closest('.field').querySelector('.fb'); fb.style.display = 'none'; });
  evModal().show();
}
$('#addEv').addEventListener('click', () => openEvent());

$('#evForm').addEventListener('submit', async ev => {
  ev.preventDefault();
  let bad = false; Object.keys(EF).forEach(k => { const m = evCheck[k](); setState(EF[k], m); if (m) bad = true; });
  if (bad) return;
  const data = { title: EF.title.value.trim(), category: EF.cat.value, description: EF.desc.value.trim(), startsAt: EF.date.value, venue: EF.venue.value.trim(), capacity: Number(EF.cap.value) };
  const btn = $('#eSave'); btn.disabled = true;
  try {
    if (editId) await updateDoc(doc(db, 'events', editId), data);
    else await addDoc(collection(db, 'events'), { ...data, registeredCount: 0, createdAt: serverTimestamp() });
    toast(editId ? 'Event updated' : 'Event created', 'success'); evModal().hide();
  } catch (e) { console.error(e); toast(friendly(e), 'error'); }
  btn.disabled = false;
});

$('#seed').addEventListener('click', async () => {
  const day = n => { const d = new Date(Date.now() + n * 864e5); d.setHours(10, 0, 0, 0); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`; };
  const S = [
    ['CodeStorm 24h Hackathon', 'Technical', 'Build something wild in 24 hours with your squad. Mentors, snacks and prizes included.', 7, 'CS Lab Block', 120],
    ['Battle of Bands', 'Cultural', 'Bring your band and own the main stage. Original tracks get bonus points.', 8, 'Open Air Theatre', 300],
    ['Inter-Dept Football Cup', 'Sports', '5-a-side knockout tournament. Register your team of 7 players.', 9, 'College Ground', 140],
    ['Intro to Cloud & Firebase', 'Workshop', 'Hands-on workshop: deploy your first full-stack app in 2 hours.', 10, 'Seminar Hall 2', 80],
    ['Valorant Arena', 'Gaming', 'Squad-based 5v5 esports tournament with live casting.', 11, 'Gaming Zone', 64],
    ['Campus Photo Walk', 'Other', 'Explore, shoot and share. Best frame wins a mirrorless camera voucher.', 12, 'Main Gate', 50]
  ];
  try {
    const b = writeBatch(db);
    S.forEach(([title, category, description, d, venue, capacity]) => b.set(doc(collection(db, 'events')), { title, category, description, startsAt: day(d), venue, capacity, registeredCount: 0, createdAt: serverTimestamp() }));
    await b.commit(); toast('6 sample events added', 'success');
  } catch (e) { console.error(e); toast(friendly(e), 'error'); }
});

// ---------- confirm helper ----------
function confirmBox(title, text, ok = 'Delete') {
  return new Promise(res => {
    $('#cfTitle').textContent = title; $('#cfText').textContent = text; $('#cfOk').textContent = ok;
    const m = bootstrap.Modal.getOrCreateInstance('#cfModal'); let done = false;
    $('#cfOk').onclick = () => { done = true; m.hide(); };
    $('#cfModal').addEventListener('hidden.bs.modal', () => res(done), { once: true });
    m.show();
  });
}

async function deleteEvent(id) {
  const e = events.find(x => x.id === id); if (!e) return;
  if (!await confirmBox('Delete this event?', `"${e.title}" and its ${regs.filter(r => r.eventId === id).length} registration(s) will be removed.`)) return;
  try {
    const b = writeBatch(db);
    regs.filter(r => r.eventId === id).forEach(r => b.delete(doc(db, 'registrations', r.id)));
    b.delete(doc(db, 'events', id)); await b.commit(); toast('Event deleted', 'info');
  } catch (err) { console.error(err); toast(friendly(err), 'error'); }
}

// ---------- students ----------
$('#sb').innerHTML += BRANCHES.map(b => `<option>${b}</option>`).join('');
$('#sq').addEventListener('input', renderStudents); $('#sb').addEventListener('change', renderStudents);
function renderStudents() {
  const q = $('#sq').value.toLowerCase(), b = $('#sb').value;
  const list = students.filter(s => (!b || s.branch === b) && (!q || (s.name + s.roll + s.email).toLowerCase().includes(q)))
    .sort((a, c) => a.name.localeCompare(c.name));
  $('#stBody').innerHTML = list.length ? list.map(s => `<tr>
    <td><div class="d-flex align-items-center gap-2"><div class="avatar" style="width:36px;height:36px;font-size:.9rem">${esc(s.name[0])}</div><div><b>${esc(s.name)}</b><br><small class="muted">${esc(s.email)}</small></div></div></td>
    <td><code>${esc(s.roll)}</code></td><td>${esc(s.branch)}</td><td>${esc(s.year)}</td><td>${esc(s.phone)}</td>
    <td><span class="chip">${regs.filter(r => r.uid === s.id).length}</span></td>
    <td class="text-end"><button class="btn-danger-ghost" data-del-st="${s.id}"><i class="bi bi-person-x"></i></button></td></tr>`).join('')
    : `<tr><td colspan="7"><div class="empty"><i class="bi bi-people"></i>No students found.</div></td></tr>`;
}
async function deleteStudent(id) {
  const s = students.find(x => x.id === id); if (!s) return;
  const mine = regs.filter(r => r.uid === id);
  if (!await confirmBox('Remove this student?', `${s.name} (${s.roll}) and ${mine.length} registration(s) will be removed. Their login should also be deleted in Firebase Console → Authentication.`, 'Remove')) return;
  try {
    const b = writeBatch(db);
    mine.forEach(r => { b.delete(doc(db, 'registrations', r.id)); if (events.some(e => e.id === r.eventId)) b.update(doc(db, 'events', r.eventId), { registeredCount: increment(-1) }); });
    b.delete(doc(db, 'rollNumbers', s.roll)); b.delete(doc(db, 'users', id));
    await b.commit(); toast('Student removed', 'info');
  } catch (err) { console.error(err); toast(friendly(err), 'error'); }
}

// ---------- registrations ----------
function fillFilters() {
  const sel = $('#rf'), cur = sel.value;
  sel.innerHTML = '<option value="">All events</option>' + events.map(e => `<option value="${e.id}">${esc(e.title)}</option>`).join('');
  sel.value = events.some(e => e.id === cur) ? cur : '';
}
$('#rq').addEventListener('input', renderRegs); $('#rf').addEventListener('change', renderRegs);
const filteredRegs = () => {
  const q = $('#rq').value.toLowerCase(), f = $('#rf').value;
  return regs.filter(r => (!f || r.eventId === f) && (!q || ((r.studentName || '') + (r.roll || '')).toLowerCase().includes(q))).sort((a, b) => ts(b) - ts(a));
};
function renderRegs() {
  const list = filteredRegs();
  $('#rgBody').innerHTML = list.length ? list.map(r => `<tr><td><code>${esc(r.ticket)}</code></td><td><b>${esc(r.studentName)}</b><br><small class="muted">${esc(r.email)}</small></td>
    <td><code>${esc(r.roll)}</code></td><td>${esc(r.branch)}</td><td>${esc(r.eventTitle)}</td><td>${ts(r).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
    <td class="text-end"><button class="btn-danger-ghost" data-del-rg="${r.id}"><i class="bi bi-x-lg"></i></button></td></tr>`).join('')
    : `<tr><td colspan="7"><div class="empty"><i class="bi bi-inbox"></i>No registrations to show.</div></td></tr>`;
}
async function removeReg(id) {
  const r = regs.find(x => x.id === id); if (!r) return;
  if (!await confirmBox('Remove registration?', `${r.studentName} will lose their spot in "${r.eventTitle}".`, 'Remove')) return;
  try {
    const b = writeBatch(db); b.delete(doc(db, 'registrations', id));
    if (events.some(e => e.id === r.eventId)) b.update(doc(db, 'events', r.eventId), { registeredCount: increment(-1) });
    await b.commit(); toast('Registration removed', 'info');
  } catch (err) { console.error(err); toast(friendly(err), 'error'); }
}
$('#csv').addEventListener('click', () => {
  const list = filteredRegs(); if (!list.length) return toast('Nothing to export', 'info');
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Ticket', 'Name', 'Roll', 'Email', 'Branch', 'Year', 'Event', 'Event date', 'Registered at']]
    .concat(list.map(r => [r.ticket, r.studentName, r.roll, r.email, r.branch, r.year, r.eventTitle, r.eventDate, ts(r).toISOString()]));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
  a.download = 'registrations.csv'; a.click(); URL.revokeObjectURL(a.href);
});

// ---------- delegated row actions ----------
document.addEventListener('click', e => {
  const t = e.target.closest('[data-edit],[data-del-ev],[data-del-st],[data-del-rg]'); if (!t) return;
  if (t.dataset.edit) openEvent(t.dataset.edit);
  if (t.dataset.delEv) deleteEvent(t.dataset.delEv);
  if (t.dataset.delSt) deleteStudent(t.dataset.delSt);
  if (t.dataset.delRg) removeReg(t.dataset.delRg);
});
