# DiceDeck

DiceDeck is a customizable grid-based control panel for Streamer.bot, built with pure vanilla JavaScript, HTML, and CSS. It allows users to create, edit, and manage a grid of action buttons that trigger Streamer.bot actions. The layout and button configuration are stored in a `data.json` file, making it easy to customize and share setups.

## Features
- Customizable grid layout (rows and columns)
- Drag-and-drop button arrangement in edit mode
- Add, edit, or remove buttons with custom titles and actions
- Save and download your grid configuration as `data.json`
- Connects to Streamer.bot for real-time action triggering
- Responsive and modern UI with animated SVG background
- No external libraries or frameworks required

## Getting Started

### Prerequisites
- A web browser (Chrome, Firefox, Edge, etc.)
- [Streamer.bot](https://streamer.bot/) running on your local network

### Setup
1. Clone or download this repository.
2. Place your `data.json` configuration file in the project root (or use the default provided).
3. Open `index.html` in your web browser.
4. (Optional) Edit the grid and buttons in Edit Mode, then save your layout.

### Connecting to Streamer.bot
- By default, DiceDeck connects to `127.0.0.1:8080`.
- To use a different address or port, add URL parameters:
  - `?address=YOUR_IP&port=YOUR_PORT`
  - Example: `index.html?address=192.168.1.100&port=8080`

## File Structure
- `index.html` – Main HTML file
- `script.js` – Application logic (grid, modals, Streamer.bot integration)
- `style.css` – Styles for the UI and modals
- `data.json` – Grid and button configuration

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details. 