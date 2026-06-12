# ChessCoach AI — Setup Guide

## What You're Getting
A full personal chess app with:
- ♟ **Trainer** — Play vs Stockfish at any ELO (400–2800), live commentary on every move
- 📋 **Analyzer** — Load chess.com games or paste PGN, full position analysis with arrows
- 🧩 **Puzzles** — Tactical training with streak tracking and AI feedback
- 📚 **Library** — Save and review all your games (requires login)
- 🔐 **Login** — Google sign-in restricted to mikanmnrng@gmail.com only

---

## Step 1: Install Prerequisites

Make sure you have:
- **Node.js v18+** → https://nodejs.org (download LTS)
- **Git** (optional) → https://git-scm.com

Check by running in terminal/cmd:
```
node --version
npm --version
```

---

## Step 2: Firebase Setup (for login + game saves)

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → name it `chess-coach` → Continue
3. Disable Google Analytics (optional) → Create project

### Enable Authentication:
4. Left sidebar → **Authentication** → Get Started
5. **Sign-in method** tab → Enable **Google** → Save
6. Under **Authorized domains**, add `localhost` (already there by default)

### Enable Firestore:
7. Left sidebar → **Firestore Database** → Create database
8. Choose **Start in test mode** → Next → Select your region → Enable

### Get your config:
9. Left sidebar → ⚙️ **Project Settings** → **General** tab
10. Scroll down to **"Your apps"** → Click **`</>`** (Web) icon
11. Name it `chess-coach-web` → Register app
12. Copy the `firebaseConfig` object — it looks like:
```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "chess-coach-xxxxx.firebaseapp.com",
  projectId: "chess-coach-xxxxx",
  storageBucket: "chess-coach-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Add to the app:
13. Open `src/lib/firebase.js` in the chess-coach folder
14. Replace the placeholder `firebaseConfig` object with yours (lines 6–13)

### Firestore Security Rules:
15. Firestore → **Rules** tab → Replace with:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
16. Click **Publish**

---

## Step 3: Get a Claude API Key (for AI coaching)

1. Go to https://console.anthropic.com
2. Sign up / log in → **API Keys** → Create key
3. Copy the key (starts with `sk-ant-api03-…`)
4. You'll paste this into the app's settings (top-right badge says "ADD API KEY")

> The key is stored only in your browser's localStorage — never sent anywhere except Anthropic's API.

---

## Step 4: Run the App

Open a terminal, navigate to the `chess-coach` folder:

```bash
# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

Open your browser at: **http://localhost:5173**

---

## Step 5: First Launch Checklist

- [ ] App loads at localhost:5173
- [ ] Click **"Sign In with Google"** (top right) → choose mikanmnrng@gmail.com
- [ ] Click the **"ADD API KEY"** badge → paste your Claude key → Save
- [ ] Go to **▶ Play** → hit **New Game** → choose your color + ELO → Start
- [ ] Make a move — Coach Magnus should comment!
- [ ] Try **🧩 Puzzles** — no API key needed for basic puzzles
- [ ] Load a chess.com game in **📋 Analyze** tab

---

## Step 6: Deploy (Optional — to access from any device)

### Option A: Vercel (easiest, free)
```bash
npm install -g vercel
vercel
```
Follow prompts → get a live URL.

### Option B: Netlify
```bash
npm run build
# Drag the `dist/` folder to netlify.com/drop
```

### Option C: GitHub Pages
Push to GitHub → enable Pages from `dist/` branch.

> After deploying, add your domain to Firebase Auth's Authorized Domains:
> Firebase Console → Authentication → Settings → Authorized domains → Add domain

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "User not found" on chess.com load | Check username spelling, try lowercase |
| Coach says nothing | Make sure API key is saved (green badge says CLAUDE ✓) |
| Can't sign in | Check Firebase config in `firebase.js` is correct |
| Board not showing | Try a hard refresh (Ctrl+Shift+R) |
| Stockfish not thinking | Browser needs to support Web Workers (all modern browsers do) |
| CORS error on API | Make sure you're on localhost:5173, not opening the HTML file directly |

---

## Keyboard Shortcuts (Board)

| Key | Action |
|---|---|
| ← / → | Previous / Next move |
| Home / End | Go to start / end |
| F | Flip board |

---

## File Structure

```
chess-coach/
├── src/
│   ├── components/
│   │   ├── ChessBoard.jsx    ← The board (SVG pieces, arrows, highlights)
│   │   ├── EvalBar.jsx       ← Evaluation bar
│   │   ├── MoveList.jsx      ← Move history strip
│   │   ├── CommentaryBox.jsx ← Coach commentary feed
│   │   ├── Navbar.jsx        ← Top navigation + auth
│   │   └── Notifications.jsx ← Toast notifications
│   ├── pages/
│   │   ├── PlayPage.jsx      ← Trainer vs Stockfish
│   │   ├── AnalyzePage.jsx   ← Game analysis + chess.com import
│   │   ├── PuzzlePage.jsx    ← Tactical puzzles
│   │   └── LibraryPage.jsx   ← Saved games
│   ├── lib/
│   │   ├── firebase.js       ← Auth + Firestore (EDIT THIS with your config)
│   │   ├── stockfish.js      ← Stockfish engine wrapper
│   │   └── chess-utils.js    ← Chess helpers, puzzles, openings
│   └── store/
│       └── useStore.js       ← Global state (Zustand)
├── SETUP.md                  ← This file
└── package.json
```
