# DIMORA — Floor Plan → 3D Home, with an AI Tour Guide

> **🏆 SMRU HACK DAY · HYDERABAD / Synqron — Track 2 Submission**  
> *"Don't just see your home. Understand what it could become."*

---

## 📋 Hackathon Submission Details

| Requirement | Details |
|---|---|
| **Track** | **Track 2** (Google Gemma 4 Track) |
| **Open-Source Model** | **Google Gemma 4** (`gemma-4-31b-it`, `gemma-4-26b-a4b-it`) via Google AI Studio / Groq |
| **Model License** | [Gemma Terms of Use / Open Model License](https://ai.google.dev/gemma/terms) |
| **Project License** | [Apache License 2.0](LICENSE) |
| **Team Name** | **New-Tons** *(Tushti Rayak, Siddharth Singh, Vivek Dalmia, Naina Jain)* |
| **Repository** | [https://github.com/rayaktushti-tech/Hacktoberfest_Synqron_Track_2](https://github.com/rayaktushti-tech/Hacktoberfest_Synqron_Track_2) |

---

## 🌟 What is DIMORA?

DIMORA turns any JPG, PNG or PDF floor plan into an interactive, furnished, priced 3D home you can walk through.

- **Computer Vision & Gemma 4 Detection:** Detects walls, room boundaries, doors, and windows using a hybrid CV + multimodal AI pipeline.
- **Explorable 3D Model:** Renders a walk-through 3D scene using a custom, zero-dependency WebGL2 engine.
- **Aria (AI Tour Guide powered by Gemma 4):** Gives an animated, voice-narrated walk-through and edits the 3D model in real time as you chat.
- **Indian Market Pricing (₹):** Itemized bills of quantities for paint, 14 flooring types (Italian marble, Kota stone, vitrified tiles), modular furniture, and false ceilings.
- **Architectural & Daylight Simulation:** Real-time solar azimuth lighting through windows, door swing collision detection, and circulation checks.

Pure static site: vanilla JS + custom WebGL2 engine. **No build step, no framework, no server required.**

---

## 🚀 Run it

### Option 1 — just open it
Double-click **`dist/dimora.html`**, the whole app in one file. (Google sign-in via Firebase needs http, so use Option 2 for that.)

### Option 2 — localhost
```bash
npm install
npm run dev          # → http://localhost:3000
```
No Node? Any static server works:
```bash
python3 -m http.server 3000      # → http://localhost:3000
```

### Option 3 — deploy to Vercel
1. Push this folder to a GitHub repo (see below).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.
3. Keep the defaults (Framework preset **Other**; `vercel.json` already sets the output to the repo root) and click **Deploy**.

Or from the terminal:
```bash
npm i -g vercel
vercel           # preview
vercel --prod    # production
```

### Option 4 — Netlify / GitHub Pages
- **Netlify:** "Add new site → Import from Git". `netlify.toml` publishes the root, with no build command.
- **GitHub Pages:** repo **Settings → Pages → Deploy from branch → `main` / root**. `.nojekyll` is included.

### Push to GitHub
```bash
git init
git add .
git commit -m "DIMORA: AI floor plan to 3D home designer"
git branch -M main
git remote add origin https://github.com/<your-username>/dimora.git
git push -u origin main
```

---

## 🤖 Connect the AI (Gemma 4)

Open the app → **⚙ Settings** → paste a key → **Test connection** → **Save**.

| Key | Where to get it | What DIMORA uses |
|---|---|---|
| `AIza…` (Google AI Studio) | https://aistudio.google.com/apikey | **Gemma 4**: `gemma-4-31b-it` (default) or `gemma-4-26b-a4b-it` via the Gemini API |
| `gsk_…` (Groq) | https://console.groq.com/keys | Gemma if your Groq account offers it, otherwise the best available model, plus a vision model for plans |

Keys are stored only in the user's browser (localStorage) and sent only to the provider.

> ⚠️ **Never put an API key in the source code or commit it to GitHub.** Anything in a static site is public. Each user pastes their own key in Settings.

Without a key, DIMORA still works fully with its on-device engine: computer-vision room detection, the command parser and narration templates.

---

## 🔐 Login

- Visitors sign in with their **Gmail address** (name optional).
- After the first login they answer 3 intro questions, which personalise their workspace and Aria's greeting:
  1. What are you looking to do with DIMORA?
  2. What are you by passion?
  3. Where are you in your home journey?
- **Optional verified Google sign-in:**
  1. Create a Firebase project and enable **Authentication → Google**.
  2. Add your domains (e.g. `localhost`, `your-app.vercel.app`) under **Authorized domains**.
  3. Paste the web config into `AUTH_CONFIG` in `src/09a_auth.js`.
  4. Run `npm run build:src`.

  The form then becomes a "Continue with Google" button. It must be served over http(s).

---

## ✨ Features

- **Upload & detect:**
  - Hybrid detection: computer vision for the geometry, Gemma 4 vision for labels, scale, doors and windows.
  - You can review the detected rooms before generating.
- **3D:** orbit, presets, cutaway, room labels, eye-level walk mode, real sun simulation through windows, night lighting, multiple floors with stairs.
- **2D editor:**
  - Draw rooms and drag walls with snapping.
  - Add doors and windows.
  - Overlays for daylight, airflow, unused space and connectivity.
- **Aria:**
  - An assistant that edits the 3D model: paint, flooring, furniture, themes, room transformations, budgets, ceilings, lighting.
  - An animated, narrated home tour where you can change the room you're in mid-tour.
- **Interior designer:** 8 themes, AI paint suggestions, 14 floor materials, false ceilings, lighting, decor, inspiration-photo matching.
- **Space analyzer:** clearances, door swings, unused-corner conversion, fit checker, storage, alternative layouts.
- **Budget (₹):** room-wise costs that explain themselves, cheaper alternatives, a budget optimiser.
- **Light & ventilation, architectural checks, design comparison, Home Decision Report.**

Cost figures are illustrative estimates, not market quotations.

---

## 🗂 Project structure

```
dimora/
├── index.html          # app shell + marketing page (served at /)
├── css/style.css       # "Obsidian Neon" design system + components
├── js/app.js           # the app (generated from src/)
├── js/main.js          # landing interactions: reveal, navbar, mobile nav, slider, particles
├── assets/logo.svg
├── dist/dimora.html    # single-file build (works offline by double-click)
├── src/                # editable source modules
│   ├── 00_template.html   01_engine.js   02_model.js   03_logic.js   04_detect.js
│   ├── 05_ai.js   06_view3d.js   07_editor2d.js   08_tour.js   09_ui.js
│   ├── 09a_auth.js   09y_landing.js   09z_start.js   main.js   style.css
├── tools/build.py      # src/ → index.html, css/, js/, dist/
├── package.json        # npm run dev | npm run build:src
├── vercel.json · netlify.toml · .nojekyll · .gitignore
```

**Editing:** change files in `src/`, then run `npm run build:src` (`python3 tools/build.py`) and commit the generated files too. Hosts serve the root as-is, with no build on deploy.

**Before launch:** set `SITE_CONFIG.contactEmail` in `src/09y_landing.js`.

## 👥 Team New-Tons
- **Tushti Rayak**
- **Siddharth Singh**
- **Vivek Dalmia**
- **Naina Jain**

## Requirements
A modern browser with WebGL2 (Chrome, Edge, Firefox or Safari 15+). Python 3 is needed only if you rebuild from `src/`.
