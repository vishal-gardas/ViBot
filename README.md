# ViBot — Voice-Enabled Chatbot

ViBot is a premium dark-interface voice chatbot. It uses browser speech recognition for voice input and a Gemini-backed Netlify Function for general answers. The API key is kept server-side and is never sent to the browser.

## Run locally

```bash
npm run train
npm run serve
```

Open `http://localhost:4173`. Use a Chromium-based browser for microphone speech recognition. Microphone access requires HTTPS in production (or localhost during development).

## Configure general AI answers

In Netlify, go to **Project configuration → Environment variables** and add `GEMINI_API_KEY` with your Gemini API key as its value. Redeploy after saving the variable. Never paste the key into `app.js`, `index.html`, or any other frontend file.

## Project structure

- `data/intents.json` — 15 intents and 75 labelled training phrases.
- `scripts/train-model.js` — deterministic from-scratch neural-network training script (no ML package).
- `model/vibot-model.json` — exported trained weights loaded by the app.
- `app.js` — local inference, speech-recognition control, and chat UI.
- `REPORT.md` — concise technical report.

## Deployment

This is a static web application. Deploy the repository root to Netlify, Vercel, GitHub Pages, or Cloudflare Pages with no build command and `index.html` as the publish entry point. The included `netlify.toml` configures an SPA-safe deployment.
