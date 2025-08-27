# TARS — Interstellar‑inspired AI Copilot

TARS is a fun, mission‑focused demo: a Next.js app that pairs an adjustable‑tone conversational AI with a realtime 3D cockpit scene (React Three Fiber). Use it as a starting point for building an interactive space‑navigation assistant with voice controls and adjustable humor/honesty.

## Features
- Conversational agent powered by Julep SDK (configurable model)
- Adjustable humor and honesty via voice commands (e.g. "set humor to 75")
- 3D animated scene (stars, galaxies, wormhole, black hole) built with react-three-fiber and drei
- TTS (text‑to‑speech) and single‑utterance speech recognition integration
- Session persistence (stored in sessionStorage)

## Tech stack
- Next.js (API routes + React)
- React, Hooks
- @react-three/fiber + drei + three.js
- Julep SDK for agent & sessions
- Web Speech API (SR/TTS) for voice control

## Quick start (development)
1. Install deps:
   npm install
2. Run dev server:
   npm run dev
3. Open http://localhost:3000

## Environment
Create a .env.local with:
- JULEP_API_KEY=your_julep_api_key
- (optional) JULEP_AGENT_ID=precreated_agent_id

The API route will create an agent on first run if JULEP_AGENT_ID is not set.

## Voice commands
- Adjust humor: "set humor to 75" (0–100). >60 = playful, 30–60 = light quips, <30 = minimal humor.
- Adjust honesty: "set honesty to 85" (0–100). Higher values make replies more direct; lower values make replies more cautious.
- Commands are recognized by the client and forwarded to the agent as context.

## Notes & troubleshooting
- Browsers often block audio autoplay. Interact (click/tap) to enable sound playback.
- If stage audio doesn’t play when changing stages, ensure user gesture occurred and check console for autoplay/security errors.
- If chat times out, check JULEP_API_KEY and network connectivity.

## Deploy
Recommended: Vercel. Push repo to GitHub and import into Vercel, or:
   npm run build
   npm start

## Contributing
PRs welcome. Keep changes small and focused. If adding features that change prompts/agent behavior, update tests and README.

## License & acknowledgements
This project is a fan project/demo. Replace with your preferred license (e.g., MIT) before publishing.
