import { db, auth } from './firebase.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getProfile, home } from './auth.js';
import { $, esc, fmtDate, catOf, CATS, initFX, hideLoader, reveal, countUp } from './ui.js';

initFX();
setTimeout(hideLoader, 4000); // safety net

// marquee of categories
const names = Object.keys(CATS);
$('#marq').innerHTML = [...names, ...names, ...names, ...names].map(n => `<span>${n}</span>`).join('');
countUp($('#sCats'), names.length);

// swap nav buttons if already signed in
onAuthStateChanged(auth, async u => {
  if (!u) return;
  try {
    const p = await getProfile(u.uid);
    if (p) $('#navAuth').innerHTML = `<a class="btn-fx" style="padding:.45rem 1rem" href="${home(p.role)}">Dashboard</a>`;
  } catch (e) { /* ignore */ }
});

try {
  const snap = await getDocs(query(collection(db, 'events'), orderBy('startsAt')));
  const now = new Date();
  const evs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => new Date(e.startsAt) >= now);
  countUp($('#sEvents'), evs.length);
  countUp($('#sSeats'), evs.reduce((a, e) => a + Math.max(0, (e.capacity || 0) - (e.registeredCount || 0)), 0));
  $('#evGrid').innerHTML = evs.length ? evs.slice(0, 6).map((e, i) => {
    const c = catOf(e.category), left = Math.max(0, e.capacity - (e.registeredCount || 0));
    const pct = Math.min(100, Math.round(((e.registeredCount || 0) / e.capacity) * 100));
    return `<div class="col-md-6 col-lg-4 reveal d${i % 3 + 1}"><div class="ev-card" data-tilt style="--c:${c.c}">
      <div class="d-flex justify-content-between align-items-start"><div class="ev-ico"><i class="bi ${c.icon}"></i></div><span class="chip">${esc(e.category)}</span></div>
      <h5>${esc(e.title)}</h5><p class="muted clamp m-0">${esc(e.description)}</p>
      <ul class="meta"><li><i class="bi bi-calendar-event"></i>${fmtDate(e.startsAt)}</li><li><i class="bi bi-geo-alt"></i>${esc(e.venue)}</li></ul>
      <div class="push"><div class="bar mb-1"><span style="width:${pct}%"></span></div><small class="muted">${left} of ${e.capacity} seats left</small>
      <a href="login.html" class="btn-ghost w-100 text-center mt-3 d-block">Login to register</a></div></div></div>`;
  }).join('') : `<div class="col-12"><div class="glass empty"><i class="bi bi-calendar2-x"></i>No upcoming events yet — check back soon!</div></div>`;
} catch (e) {
  console.error(e);
  $('#evGrid').innerHTML = `<div class="col-12"><div class="glass empty"><i class="bi bi-exclamation-triangle"></i>Couldn't load events. Make sure Firestore rules are published (see README).</div></div>`;
}
reveal();
hideLoader();
