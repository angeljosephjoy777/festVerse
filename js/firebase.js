// Firebase initialisation (modular SDK via CDN, no build step needed)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1Ynn958fsLl5i7o60vjoclSjPj9rbZVU",
  authDomain: "fest2026-e489e.firebaseapp.com",
  projectId: "fest2026-e489e",
  storageBucket: "fest2026-e489e.firebasestorage.app",
  messagingSenderId: "961186158413",
  appId: "1:961186158413:web:b3b648b89ca9e54b114904",
  measurementId: "G-1386WGYBR8"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
