import { db } from './firebase.js';
import {
  collection, doc, onSnapshot, query, orderBy, where, runTransaction, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { requireRole, logout, friendly } from './auth.js';
import { $, $$, esc, fmtDate, catOf, CATS, BRANCHES, rules, setState, toast, initFX, hideLoader, reveal, countUp } from './ui.js';

initFX();
setTimeout(hideLoader, 5000);
const { user, profile } = await requireRole('student');
const uid = user.uid;

let events = [], regs = new Map(), q = '', cat = 'All', profileData = profile;

// ---------- header / nav ----------
function paintMe() {
  const p = profileData, first = p.name.split(' ')[0];
  $('#hello').textContent = first;
  $('#meName').textContent = p.name; $('#meRoll').textContent = p.roll;
  $('#av').textContent = $('#av2').textContent = p.name[0].toUpperCase();
}
paintMe();
function show(s) {
  $$('.sec').forEach(x => x.classList.toggle('on', x.id === 'sec-' + s));
  $$('.side .nv[data-s]').forEach(x => x.classList.toggle('on', x.dataset.s === s));
  reveal();
}
$$('.side .nv[data-s]').forEach(a => a.addEventListener('click', () => { show(a.dataset.s); history.replaceState(null, '', '#' + a.dataset.s); }));
if (['events', 'mine', 'profile'].includes(location.hash.slice(1))) show(location.hash.slice(1));
$('#logout').addEventListener('click', logout);

// ---------- chips + search ----------
$('#chips').innerHTML = ['All', ...Object.keys(CATS)].map(c => `<span class="chip chip-btn ${c === 'All' ? 'on' : ''}" data-c="${c}">${c}</span>`).join('');
$('#chips').addEventListener('click', e => {
  const c = e.target.closest('[data-c]'); if (!c) return;
  cat = c.dataset.c; $$('#chips .chip').forEach(x => x.classList.toggle('on', x === c)); renderEvents();
});
$('#q').addEventListener('input', e => { q = e.target.value.toLowerCase(); renderEvents(); });

// ---------- live data ----------
const onErr = e => { console.error(e); toast(friendly(e), 'error'); hideLoader(); };
onSnapshot(query(collection(db, 'events'), orderBy('startsAt')), s => {
  events = s.docs.map(d => ({ id: d.id, ...d.data() })); renderAll(); hideLoader();
}, onErr);
onSnapshot(query(collection(db, 'registrations'), where('uid', '==', uid)), s => {
  regs = new Map(s.docs.map(d => [d.data().eventId, { id: d.id, ...d.data() }])); renderAll();
}, onErr);

const isPast = e => new Date(e.startsAt) < new Date();
function renderAll() { renderStats(); renderEvents(); renderTickets(); }

function renderStats() {
  const up = events.filter(e => !isPast(e));
  countUp($('#kReg'), regs.size);
  countUp($('#kUp'), up.filter(e => regs.has(e.id)).length);
  countUp($('#kOpen'), up.filter(e => (e.registeredCount || 0) < e.capacity && !regs.has(e.id)).length);
}

function renderEvents() {
  const list = events
    .filter(e => (cat === 'All' || e.category === cat) && (!q || (e.title + ' ' + e.venue + ' ' + e.description).toLowerCase().includes(q)))
    .sort((a, b) => (isPast(a) - isPast(b)) || a.startsAt.localeCompare(b.startsAt));
  $('#evGrid').innerHTML = list.length ? list.map((e, i) => {
    const c = catOf(e.category), count = e.registeredCount || 0, left = Math.max(0, e.capacity - count);
    const pct = Math.min(100, Math.round(count / e.capacity * 100)), mine = regs.has(e.id), past = isPast(e);
    let btn = `<button class="btn-fx w-100 mt-3" data-act="reg" data-id="${e.id}">Register now</button>`;
    if (mine) btn = `<button class="btn-ghost w-100 mt-3" disabled style="color:var(--tl);border-color:rgba(46,230,197,.5)"><i class="bi bi-check2-circle"></i> You're registered</button>`;
    else if (past) btn = `<button class="btn-ghost w-100 mt-3" disabled>Event closed</button>`;
    else if (left === 0) btn = `<button class="btn-ghost w-100 mt-3" disabled>Fully booked</button>`;
    return `<div class="col-md-6 col-xl-4 reveal d${i % 3 + 1}" style="${past && !mine ? 'opacity:.6' : ''}"><div class="ev-card" data-tilt style="--c:${c.c}">
      <div class="d-flex justify-content-between align-items-start"><div class="ev-ico"><i class="bi ${c.icon}"></i></div><span class="chip">${esc(e.category)}</span></div>
      <h5>${esc(e.title)}</h5><p class="muted clamp m-0">${esc(e.description)}</p>
      <ul class="meta"><li><i class="bi bi-calendar-event"></i>${fmtDate(e.startsAt)}</li><li><i class="bi bi-geo-alt"></i>${esc(e.venue)}</li></ul>
      <div class="push"><div class="bar mb-1"><span style="width:${pct}%"></span></div><small class="muted">${left} of ${e.capacity} seats left</small>${btn}</div>
    </div></div>`;
  }).join('') : `<div class="col-12"><div class="glass empty"><i class="bi bi-calendar2-x"></i>No events match your search.</div></div>`;
  reveal($('#evGrid'));
}

function renderTickets() {
  const list = [...regs.values()].sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''));
  $('#tickets').innerHTML = list.length ? list.map((r, i) => {
    const ev = events.find(e => e.id === r.eventId), c = catOf(ev && ev.category), past = new Date(r.eventDate) < new Date();
    return `<div class="col-lg-6 reveal d${i % 2 + 1}"><div class="ticket" style="--c:${c.c}">
      <div class="tl"><span class="chip mb-2"><i class="bi ${c.icon}"></i> ${esc(ev ? ev.category : 'Event')}</span>
        <h5 class="mb-1">${esc(r.eventTitle)}</h5>
        <div class="muted small"><i class="bi bi-calendar-event me-1"></i>${fmtDate(r.eventDate)}</div>
        ${ev ? `<div class="muted small"><i class="bi bi-geo-alt me-1"></i>${esc(ev.venue)}</div>` : ''}
        ${past ? '<span class="chip mt-2">Completed</span>' : `<button class="btn-danger-ghost mt-3" data-act="cancel" data-id="${r.eventId}">Cancel registration</button>`}</div>
      <div class="tr"><i class="bi bi-qr-code" style="font-size:2.6rem"></i><code class="mt-1">${esc(r.ticket || '')}</code><small class="muted">TICKET</small></div>
    </div></div>`;
  }).join('') : `<div class="col-12"><div class="glass empty"><i class="bi bi-ticket-perforated"></i>No tickets yet — register for an event from Discover.</div></div>`;
  reveal($('#tickets'));
}

// ---------- register / cancel (transactions keep seat counts correct) ----------
async function register(id, btn) {
  btn.disabled = true; btn.innerHTML = '<span class="spinner-border spin-sm"></span>';
  try {
    await runTransaction(db, async tx => {
      const er = doc(db, 'events', id), es = await tx.get(er);
      if (!es.exists()) throw new Error('This event no longer exists.');
      const e = es.data(), rr = doc(db, 'registrations', `${id}_${uid}`);
      if ((await tx.get(rr)).exists()) throw new Error('You are already registered for this event.');
      if (new Date(e.startsAt) < new Date()) throw new Error('This event has already started.');
      const n = e.registeredCount || 0;
      if (n >= e.capacity) throw new Error('Sorry, this event is fully booked.');
      tx.set(rr, {
        eventId: id, uid, studentName: profileData.name, roll: profileData.roll, email: profileData.email,
        branch: profileData.branch, year: profileData.year, eventTitle: e.title, eventDate: e.startsAt,
        ticket: ('FV' + id.slice(0, 4) + uid.slice(0, 4)).toUpperCase(), createdAt: serverTimestamp()
      });
      tx.update(er, { registeredCount: n + 1 });
    });
    toast('You\'re in! Ticket added to My tickets 🎟️', 'success');
  } catch (e) { console.error(e); toast(friendly(e), 'error'); renderEvents(); }
}

async function cancel(id, btn) {
  if (!confirm('Cancel your registration for this event?')) return;
  btn.disabled = true;
  try {
    await runTransaction(db, async tx => {
      const er = doc(db, 'events', id), rr = doc(db, 'registrations', `${id}_${uid}`);
      const [es, rs] = [await tx.get(er), await tx.get(rr)];
      if (!rs.exists()) return;
      tx.delete(rr);
      if (es.exists()) tx.update(er, { registeredCount: Math.max(0, (es.data().registeredCount || 0) - 1) });
    });
    toast('Registration cancelled.', 'info');
  } catch (e) { console.error(e); toast(friendly(e), 'error'); btn.disabled = false; }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'reg') register(b.dataset.id, b);
  if (b.dataset.act === 'cancel') cancel(b.dataset.id, b);
});

// ---------- profile ----------
$('#pBranch').innerHTML = BRANCHES.map(b => `<option>${b}</option>`).join('');
function fillProfile() {
  $('#pEmail').value = profileData.email; $('#pRoll').value = profileData.roll;
  $('#pName').value = profileData.name; $('#pPhone').value = profileData.phone;
  $('#pBranch').value = profileData.branch; $('#pYear').value = profileData.year;
}
fillProfile();
$('#pPhone').addEventListener('input', e => e.target.value = e.target.value.replace(/\D/g, ''));
$('#pf').addEventListener('submit', async ev => {
  ev.preventDefault();
  const n = $('#pName'), p = $('#pPhone'), e1 = rules.name(n.value), e2 = rules.phone(p.value);
  setState(n, e1); setState(p, e2); if (e1 || e2) return;
  const btn = $('#pSave'); btn.disabled = true;
  try {
    const patch = { name: n.value.trim(), phone: p.value.trim(), branch: $('#pBranch').value, year: $('#pYear').value };
    await updateDoc(doc(db, 'users', uid), patch);
    profileData = { ...profileData, ...patch }; paintMe();
    toast('Profile updated', 'success');
  } catch (e) { console.error(e); toast(friendly(e), 'error'); }
  btn.disabled = false;
});
