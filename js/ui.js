// Shared UI helpers: toasts, reveal animations, tilt, counters, validation
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const CATS = {
  Technical: { icon: 'bi-cpu', c: '#7c5cff' },
  Cultural: { icon: 'bi-music-note-beamed', c: '#ff4fa3' },
  Sports: { icon: 'bi-trophy', c: '#2ee6c5' },
  Workshop: { icon: 'bi-tools', c: '#ffb84d' },
  Gaming: { icon: 'bi-controller', c: '#4da3ff' },
  Other: { icon: 'bi-stars', c: '#c77dff' }
};
export const BRANCHES = ['CSE', 'IT', 'AI & DS', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Other'];
export const catOf = c => CATS[c] || CATS.Other;
export const fmtDate = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export function toast(msg, type = 'info') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const icons = { success: 'bi-check-circle-fill', error: 'bi-x-octagon-fill', info: 'bi-info-circle-fill' };
  const t = document.createElement('div');
  t.className = 'toast-fx ' + type;
  t.innerHTML = `<i class="bi ${icons[type] || icons.info}"></i><span>${esc(msg)}</span>`;
  box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 350); }, 3600);
}

export function hideLoader() {
  const l = $('#loader');
  if (l) { l.classList.add('hide'); setTimeout(() => l.remove(), 700); }
}

let io;
export function reveal(root = document) {
  io = io || new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .1 });
  $$('.reveal:not(.in)', root).forEach(el => io.observe(el));
}

export function countUp(el, to, dur = 1100) {
  if (!el) return;
  const from = Number(el.dataset.v || 0);
  el.dataset.v = to;
  const t0 = performance.now();
  const step = t => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function initFX() {
  reveal();
  const glow = $('.cursor-glow');
  if (glow) addEventListener('pointermove', e => { glow.style.left = e.clientX + 'px'; glow.style.top = e.clientY + 'px'; });
  const nav = $('.nav-fx');
  if (nav) addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 20), { passive: true });
  // 3D tilt on any [data-tilt] element (works for cards rendered later too)
  document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('[data-tilt]');
    if (!c || e.pointerType === 'touch') return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.style.transform = `perspective(900px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-4px)`;
  });
  document.addEventListener('pointerout', e => {
    const c = e.target.closest && e.target.closest('[data-tilt]');
    if (c && !c.contains(e.relatedTarget)) c.style.transform = '';
  });
  // password eye toggles
  $$('.eye').forEach(b => b.addEventListener('click', () => {
    const i = document.getElementById(b.dataset.target);
    i.type = i.type === 'password' ? 'text' : 'password';
    b.innerHTML = `<i class="bi ${i.type === 'password' ? 'bi-eye' : 'bi-eye-slash'}"></i>`;
  }));
}

// ---------- validation ----------
export const rules = {
  name: v => /^[A-Za-z][A-Za-z .'-]{2,49}$/.test(v.trim()) ? '' : 'Enter your full name (letters only, at least 3 characters)',
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address',
  roll: v => /^[A-Za-z0-9]{5,15}$/.test(v.trim()) ? '' : 'Roll number: 5–15 letters/digits, no spaces or symbols',
  phone: v => /^[6-9]\d{9}$/.test(v.trim()) ? '' : 'Enter a valid 10-digit mobile number',
  branch: v => v ? '' : 'Select your branch',
  year: v => v ? '' : 'Select your year',
  password: v => v.length < 8 ? 'At least 8 characters' : !/[a-z]/.test(v) || !/[A-Z]/.test(v) ? 'Use both upper and lower case letters' : !/\d/.test(v) ? 'Add at least one number' : '',
  required: v => v.trim() ? '' : 'This field is required'
};

export function setState(input, msg) {
  input.classList.toggle('is-invalid', !!msg);
  input.classList.toggle('is-valid', !msg);
  const fb = input.closest('.field') && input.closest('.field').querySelector('.fb');
  if (fb) { fb.textContent = msg || ''; fb.style.display = msg ? 'block' : 'none'; }
}

export const strength = v => [v.length >= 8, /[a-z]/.test(v) && /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
