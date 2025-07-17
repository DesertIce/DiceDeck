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
- You can also use the `host` parameter to specify a hostname, mDNS name, or DNS name (e.g., `?host=streamerbot.local`). If both `host` and `address` are provided, `host` takes priority.
- If neither `address` nor `host` is provided, DiceDeck will attempt to auto-discover Streamer.bot on your local network.  
  _Note: This discovery process is extremely slow. If you are not running DiceDeck on the same machine as Streamer.bot, it is strongly recommended to specify a `host` or `address` parameter for a much faster connection._

## URL Query Parameters

DiceDeck supports several URL query parameters to customize its behavior. You can add these options to the end of the `index.html` URL in your browser. Multiple parameters can be combined using `&` (ampersand). For example: `index.html?address=192.168.1.100&port=8080&import`

**How to use:**
- To add a parameter: Add `?parameter=value` after `index.html` (or `&parameter=value` if adding more).
- To update a parameter: Change its value in the URL and reload the page.
- To remove a parameter: Delete it from the URL and reload the page.

### Supported Parameters

| Parameter   | Example Value         | What it Does                                                                                 |
|-------------|----------------------|---------------------------------------------------------------------------------------------|
| `address`   | `192.168.1.100`      | Connects to a specific Streamer.bot server IP address.                                       |
| `port`      | `8080`               | Sets the port for Streamer.bot connection (used with `address`).                             |
| `host`      | `streamerbot.local`  | Connects using a hostname (IP, mDNS, or DNS name). Overrides `address` if both are present. |
| `import`    | _(no value needed)_  | Shows the Debug Import button for advanced layout import/export.                             |
| `noanim`    | _(no value needed)_  | Disables UI animations for a simpler, static experience.                                     |

#### Details & Examples

- **Connect to a specific server:**
  - `index.html?address=192.168.1.100&port=8080`
  - `index.html?host=streamerbot.local`
- **Show Debug Import button:**
  - `index.html?import`
- **Combine options:**
  - `index.html?host=streamerbot.local&import`

**Tip:**
- If neither `address` nor `host` is provided, DiceDeck will try to auto-discover Streamer.bot on your local network.
- You can use IP addresses, hostnames, or mDNS names (like `streamerbot.local`) as long as they resolve on your network.
- To reset to default, simply remove all parameters from the URL and reload the page.

## Data File Format (`data.json`)

DiceDeck uses a `data.json` file to store your grid layout and button configuration. This file defines:
- The number of rows and columns in your grid
- The position and `action_id` for each button
- (Optionally) Additional metadata for advanced layouts

**High-level structure:**
```json
{
  "rows": 3,
  "cols": 5,
  "buttons": [
    { "row": 0, "col": 0, "action_id": "1234" },
    { "row": 1, "col": 2, "action_id": "5678" }
    // ... more buttons ...
  ]
}
```
- Only the `action_id` is stored for each button; action names are mapped at runtime from Streamer.bot.
- The file may also support more complex layouts (e.g., with pages/items) for advanced users.
- You can edit this file manually or use DiceDeck's UI to export/import your layout.

## File Structure
- `index.html` – Main HTML file
- `script.js` – Application logic (grid, modals, Streamer.bot integration)
- `style.css` – Styles for the UI and modals
- `data.json` – Grid and button configuration

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details. 