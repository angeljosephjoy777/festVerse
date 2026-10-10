import { auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { login, getProfile, home, friendly, resetPassword } from './auth.js';
import { $, $$, rules, setState, toast, initFX, hideLoader } from './ui.js';

initFX();
let role = 'student', busy = false;
const params = new URLSearchParams(location.search);

function setRole(r) {
  role = r;
  $('#seg').classList.toggle('admin', r === 'admin');
  $$('#seg button').forEach(b => b.classList.toggle('on', b.dataset.r === r));
  $('#ttl').textContent = r === 'admin' ? 'Admin login' : 'Student login';
  $('#sub').textContent = r === 'admin' ? 'Manage events, students and analytics.' : 'Sign in to browse and register for events.';
  $('#alt').style.display = r === 'admin' ? 'none' : '';
  showMsg('');
}
function showMsg(t, type = 'err') {
  const m = $('#msg'); m.className = 'alert-fx' + (t ? ' ' + type : ''); m.textContent = t;
}
$$('#seg button').forEach(b => b.addEventListener('click', () => setRole(b.dataset.r)));
if (params.get('role') === 'admin') setRole('admin');
if (params.get('e') === 'noprofile') showMsg('No profile found for this account. Contact the fest admin.');

// already signed in? go straight to the dashboard
onAuthStateChanged(auth, async u => {
  if (busy) return;
  if (u) {
    try { const p = await getProfile(u.uid); if (p) { location.replace(home(p.role)); return; } } catch (e) { /* fall through */ }
  }
  hideLoader();
});
setTimeout(hideLoader, 3000);

$('#email').addEventListener('blur', e => e.target.value && setState(e.target, rules.email(e.target.value)));

$('#f').addEventListener('submit', async ev => {
  ev.preventDefault();
  const email = $('#email'), pw = $('#pw');
  const e1 = rules.email(email.value), e2 = pw.value ? '' : 'Enter your password';
  setState(email, e1); setState(pw, e2);
  if (e1 || e2) return;
  const btn = $('#go'); btn.disabled = true; btn.innerHTML = '<span class="spinner-border spin-sm me-2"></span>Signing in…';
  busy = true; showMsg('');
  try {
    const p = await login(email.value, pw.value, role);
    toast('Welcome back, ' + p.name.split(' ')[0] + '!', 'success');
    location.href = home(p.role);
  } catch (err) {
    console.error(err);
    showMsg(friendly(err));
    busy = false; btn.disabled = false; btn.textContent = 'Login';
  }
});

$('#forgot').addEventListener('click', async e => {
  e.preventDefault();
  const email = $('#email'), msg = rules.email(email.value);
  setState(email, msg);
  if (msg) return showMsg('Enter your email above, then tap "Forgot password?"');
  try { await resetPassword(email.value); showMsg('Password reset link sent — check your inbox.', 'ok'); }
  catch (err) { showMsg(friendly(err)); }
});
