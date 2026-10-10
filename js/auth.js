// Auth + profile helpers
import { auth, db } from './firebase.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const normRoll = r => r.trim().toUpperCase();
export const home = role => role === 'admin' ? 'admin.html' : 'student.html';

export async function rollTaken(roll) {
  const s = await getDoc(doc(db, 'rollNumbers', normRoll(roll)));
  return s.exists();
}

export async function getProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

// Student sign-up. Email uniqueness is enforced by Firebase Auth,
// roll-number uniqueness by a rollNumbers/{ROLL} doc created in the same transaction.
export async function signUpStudent(d) {
  const roll = normRoll(d.roll);
  if (await rollTaken(roll)) throw { code: 'app/roll-taken' };
  const cred = await createUserWithEmailAndPassword(auth, d.email.trim().toLowerCase(), d.password);
  const u = cred.user;
  try {
    await runTransaction(db, async tx => {
      const rr = doc(db, 'rollNumbers', roll);
      if ((await tx.get(rr)).exists()) throw { code: 'app/roll-taken' };
      tx.set(rr, { uid: u.uid, createdAt: serverTimestamp() });
      tx.set(doc(db, 'users', u.uid), {
        name: d.name.trim(), email: d.email.trim().toLowerCase(), roll,
        phone: d.phone.trim(), branch: d.branch, year: d.year,
        role: 'student', createdAt: serverTimestamp()
      });
    });
  } catch (e) {
    await u.delete().catch(() => {}); // roll back the auth account
    throw e;
  }
  await updateProfile(u, { displayName: d.name.trim() }).catch(() => {});
  return u;
}

export async function login(email, password, expectRole) {
  const c = await signInWithEmailAndPassword(auth, email.trim(), password);
  const p = await getProfile(c.user.uid);
  if (!p) { await signOut(auth); throw { code: 'app/no-profile' }; }
  if (expectRole && p.role !== expectRole) { await signOut(auth); throw { code: 'app/wrong-role', role: p.role }; }
  return p;
}

export const logout = async () => { await signOut(auth); location.replace('login.html'); };
export const resetPassword = email => sendPasswordResetEmail(auth, email.trim());

// Page guard: resolves {user, profile} or redirects.
export function requireRole(role) {
  return new Promise(resolve => {
    const off = onAuthStateChanged(auth, async u => {
      off();
      if (!u) { location.replace('login.html'); return; }
      let p = null;
      try { p = await getProfile(u.uid); } catch (e) { console.error(e); }
      if (!p) { await signOut(auth); location.replace('login.html?e=noprofile'); return; }
      if (p.role !== role) { location.replace(home(p.role)); return; }
      resolve({ user: u, profile: p });
    });
  });
}

export function friendly(e) {
  const m = {
    'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/invalid-login-credentials': 'Incorrect email or password.',
    'auth/user-not-found': 'Incorrect email or password.',
    'auth/wrong-password': 'Incorrect email or password.',
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/weak-password': 'Password is too weak.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/operation-not-allowed': 'Email/Password sign-in is not enabled in Firebase Console.',
    'app/roll-taken': 'This roll number is already registered.',
    'app/no-profile': 'No profile found for this account. Contact the fest admin.',
    'app/wrong-role': e && e.role === 'admin' ? 'This is an admin account — switch to the Admin tab.' : 'This is a student account — switch to the Student tab.',
    'permission-denied': 'Permission denied by Firestore rules — publish firestore.rules (see README).'
  };
  return m[e && e.code] || (e && e.message) || 'Something went wrong. Please try again.';
}
