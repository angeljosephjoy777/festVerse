import { signUpStudent, rollTaken, friendly, normRoll } from './auth.js';
import { $, rules, setState, strength, toast, initFX, hideLoader, BRANCHES } from './ui.js';

initFX();
hideLoader();
$('#branch').insertAdjacentHTML('beforeend', BRANCHES.map(b => `<option>${b}</option>`).join(''));

const F = {
  name: $('#name'), email: $('#email'), roll: $('#roll'), phone: $('#phone'),
  branch: $('#branch'), year: $('#year'), pw: $('#pw'), pw2: $('#pw2')
};
const check = {
  name: () => rules.name(F.name.value),
  email: () => rules.email(F.email.value),
  roll: () => rules.roll(F.roll.value),
  phone: () => rules.phone(F.phone.value),
  branch: () => rules.branch(F.branch.value),
  year: () => rules.year(F.year.value),
  pw: () => rules.password(F.pw.value),
  pw2: () => !F.pw2.value ? 'Confirm your password' : F.pw2.value !== F.pw.value ? 'Passwords do not match' : ''
};
const showMsg = (t, type = 'err') => { const m = $('#msg'); m.className = 'alert-fx' + (t ? ' ' + type : ''); m.textContent = t; };

Object.keys(F).forEach(k => {
  const ev = F[k].tagName === 'SELECT' ? 'change' : 'input';
  F[k].addEventListener('blur', () => setState(F[k], check[k]()));
  F[k].addEventListener(ev, () => { if (F[k].classList.contains('is-invalid') || F[k].classList.contains('is-valid')) setState(F[k], check[k]()); });
});
F.phone.addEventListener('input', () => { F.phone.value = F.phone.value.replace(/\D/g, ''); });
F.roll.addEventListener('input', () => { F.roll.value = F.roll.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); });

// password strength meter
F.pw.addEventListener('input', () => {
  const s = strength(F.pw.value), colors = ['#ff6b86', '#ffb84d', '#4da3ff', '#2ee6c5'];
  document.querySelectorAll('.pw-meter i').forEach((b, i) => b.style.background = i < s ? colors[s - 1] : '');
  if (F.pw2.value) setState(F.pw2, check.pw2());
});

// live roll-number availability check (debounced)
let t;
F.roll.addEventListener('input', () => {
  clearTimeout(t);
  if (check.roll()) return;
  t = setTimeout(async () => {
    try { if (await rollTaken(F.roll.value)) setState(F.roll, 'This roll number is already registered'); } catch (e) { /* rules not published yet */ }
  }, 500);
});

$('#f').addEventListener('submit', async ev => {
  ev.preventDefault();
  showMsg('');
  let bad = null;
  Object.keys(F).forEach(k => { const m = check[k](); setState(F[k], m); if (m && !bad) bad = F[k]; });
  if (bad) { bad.focus(); return; }

  const btn = $('#go'); btn.disabled = true; btn.innerHTML = '<span class="spinner-border spin-sm me-2"></span>Creating account…';
  try {
    await signUpStudent({
      name: F.name.value, email: F.email.value, roll: normRoll(F.roll.value), phone: F.phone.value,
      branch: F.branch.value, year: F.year.value, password: F.pw.value
    });
    toast('Account created! Redirecting…', 'success');
    setTimeout(() => location.href = 'student.html', 700);
  } catch (err) {
    console.error(err);
    if (err.code === 'auth/email-already-in-use') setState(F.email, 'This email is already registered');
    if (err.code === 'app/roll-taken') setState(F.roll, 'This roll number is already registered');
    showMsg(friendly(err));
    btn.disabled = false; btn.textContent = 'Create account';
  }
});
