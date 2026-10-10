# FestVerse 2026 — Event Management

Bootstrap 5 + vanilla JS (ES modules) + Firebase Auth & Firestore. No build step.

## Pages
| File | Who | What |
|---|---|---|
| `index.html` | everyone | Animated landing page + live upcoming events |
| `signup.html` | students | Registration with validation, unique email + roll number |
| `login.html` | students & admins | Role-aware login (Student / Admin tabs), password reset |
| `student.html` | students | Discover & register for events, tickets, profile |
| `admin.html` | admins | Analytics, event CRUD, student management, registrations + CSV export |

## 1. Firebase setup (one time)
1. **Authentication → Sign-in method →** enable **Email/Password**.
2. **Firestore Database →** create a database (production mode).
3. **Firestore → Rules →** paste the contents of `firestore.rules` and **Publish**.
   (Or: `firebase deploy --only firestore:rules`.)

## 2. Create an admin (manual — there is no admin signup)
1. **Authentication → Users → Add user** — enter the admin's email and password. Copy the **User UID**.
2. **Firestore → Start collection** `users` → Document ID = **that UID**, with fields:
   - `name` (string) — e.g. `Fest Admin`
   - `email` (string) — same email
   - `role` (string) — `admin`
3. Log in on `login.html` using the **Admin** tab.

## 3. Run it
ES modules don't work from `file://`, so serve the folder:
```
python3 -m http.server 5500      # then open http://localhost:5500
```
(or VS Code "Live Server"). `localhost` is already an authorised domain in Firebase.
To deploy: `firebase deploy` (hosting + rules; `firebase.json` is included).
If you host elsewhere, add the domain under **Authentication → Settings → Authorized domains**.

Tip: Admin → Events → **Add sample events** fills the app with demo data.

## How the rules are enforced
- **Unique email** — Firebase Auth rejects a second account with the same email.
- **Unique roll number** — `rollNumbers/{ROLL}` is create-only; the sign-up transaction fails if it exists (and the half-created auth account is rolled back).
- **One registration per event** — registration doc id is `eventId_uid`.
- **Seat limits** — registering/cancelling runs in a transaction that updates `registeredCount`; rules only let students change it by exactly ±1.
- **Roles** — students can only create a `student` profile; `admin` can only be set from the Firebase Console.

## Notes
- Removing a student in the admin panel deletes their Firestore data and registrations. Delete their login in **Authentication → Users** too (the browser SDK can't delete other users).
- The Firebase web `apiKey` in `js/firebase.js` is a public identifier, not a secret — security comes from the Firestore rules above.
