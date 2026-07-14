# FanPit 🏟️

**Tether Developers Cup Hackathon Submission**

FanPit is a decentralized fan community app built using the official Tether/Holepunch SDKs:
- **Pears (PearRuntime)**: Decentralized desktop app runtime and P2P communication.
- **Hyperswarm & Hypercore**: P2P team rooms and distributed event logs without a central server.
- **QVAC (On-device AI)**: Local AI models to translate posts and summarize conversations, completely offline.
- **WDK (Wallet Development Kit)**: Embedded self-custodial wallet to tip other fans directly on-chain.

## Features
- **P2P Team Rooms**: Join a team's room (e.g. "Real Madrid") and immediately connect with other fans via Hyperswarm. No central chat server.
- **Decentralized Feed**: Messages are appended to local Hypercores and replicated across peers.
- **Local AI Translations**: See a post in a language you don't speak? Click "Translate / Summarize" to run an on-device LLM via QVAC.
- **Fan Tipping**: Send a tip to insightful fans directly using the embedded WDK self-custodial wallet.

## How to Run
1. Install dependencies: `npm install`
2. Start the app: `npm start`
3. Enter a Team Name to join the P2P swarm.
4. Open a second instance of the app (or run on another machine) to see the P2P feed sync!

## Architecture
- `electron/main.js`: Spawns the Pear worker, exposes QVAC and WDK via IPC.
- `workers/main.js`: Bare runtime script using `pear-runtime` to manage `Hyperswarm` and `Corestore`.
- `renderer/`: Web UI interacting with the main process and worker via `window.bridge`.

## Future Roadmap
- Implement Autobase for a true multi-writer ordered log.
- Integrate real WDK mainnet capabilities for live token tipping.
- Fine-tune QVAC models for football-specific slang translation.

## License
MIT
