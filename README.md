# NXVoid

NXVoid is a browser-based space combat game with a retro desktop interface. Pilot a ship through wrapped sectors, clear enemy waves, watch the radar, manage hull and energy, and taunt a boss into the fight when you want extra trouble.

The app is a dependency-free static site built with plain HTML, CSS, and JavaScript.

## Features

- Canvas-based space combat with thrust, braking, lasers, collisions, particles, and wave progression.
- Responsive retro window layout with HUD readouts, radar, meters, performance stats, and communicator log.
- Boss encounters every third sector, plus a manual boss taunt control.
- Optional Web Audio sound effects.
- Runs locally without a build step.

## Controls

| Action | Input |
| --- | --- |
| Focus game | Click the viewport |
| Turn | `ArrowLeft` / `ArrowRight` or `A` / `D` |
| Thrust | `ArrowUp` or `W` |
| Brake | `ArrowDown` or `S` |
| Fire | `Space` |
| Pause | Left titlebar button |
| Toggle sound | Right titlebar button |
| Spawn boss | `Taunt Boss` |

## Run Locally

Because this is a static app, you can open `index.html` directly in a browser.

For a local server, run one of these from the project directory:

```sh
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Project Structure

```text
.
├── index.html   # App shell and UI panels
├── styles.css   # Retro desktop styling and responsive layout
├── app.js       # Game state, rendering, input, audio, and UI sync
└── README.md
```

## Development Notes

- No package manager or build tooling is required.
- Game rendering uses the 2D canvas API.
- Audio uses the Web Audio API and starts only after the sound control is enabled.
- The world wraps at its edges, so enemies and the player can cross boundaries continuously.
