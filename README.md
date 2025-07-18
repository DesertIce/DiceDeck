# DiceDeck

[**▶️ Try DiceDeck Online**](https://desertice.github.io/DiceDeck)

DiceDeck is a customizable, grid-based control panel for Streamer.bot, built with pure vanilla JavaScript, HTML, and CSS. It allows users to create, edit, and manage a grid of action buttons that trigger Streamer.bot actions. The layout and button configuration are stored in a `data.json` file, making it easy to customize and share setups.

## Features
- Customizable grid layout (rows and columns, up to 20x20)
- Drag-and-drop button arrangement in edit mode
- Add, edit, or remove buttons with custom titles, icons, and actions
- Inline grid size editing in edit mode
- Save and download your grid configuration as `data.json`
- Import layouts (advanced/debug, supports multiple formats)
- Connects to Streamer.bot for real-time action triggering (local or remote)
- **Remote/Proxy mode** for connecting to Streamer.bot on a different machine (see below)
- Responsive and modern UI with animated SVG mesh background (adaptive complexity)
- Animated grid blur effect (can be disabled)
- Debug overlay for grid coordinates (toggle with F12)
- Warnings for empty first row/column
- No external libraries or frameworks required

## Getting Started

### Prerequisites
- A web browser (Chrome, Firefox, Edge, etc.)
- [Streamer.bot](https://streamer.bot/) running on your local network or machine

### Setup
1. Clone or download this repository.
2. Place your `data.json` configuration file in the project root (or use the default provided).
3. Open `index.html` in your web browser.
4. (Optional) Edit the grid and buttons in Edit Mode, then save your layout.

### Connecting to Streamer.bot
- By default, DiceDeck connects to `127.0.0.1:8080`.
- If connection fails, you will be prompted to check your port and try again. LAN scan/auto-discovery is no longer supported.

## Remote/Proxy Mode: Using DiceDeck with a Remote Streamer.bot

If DiceDeck is running on a different machine than your main Streamer.bot instance (for example, on a tablet or another PC), you can use **Proxy Mode** to control a remote Streamer.bot securely and reliably.

### How Proxy Mode Works
- DiceDeck connects to a *local* Streamer.bot instance, which acts as a proxy.
- The local instance relays RPC calls (actions, action list) to the remote Streamer.bot.
- This is achieved using special actions (`remoteGetActions`, `remoteDoAction`) and custom message events.
- Only one in-flight action list request is supported at a time.

> **Footnote:**
> The provided RPC actions and setup assume you have exactly two Streamer.bot instances bound to your user (the proxy and the main/target instance). If you have more than two instances, you will need to specify the correct target instance(s) for both the sender and receiver in Streamer.bot's UI when configuring the actions. This ensures that RPC calls are routed to the intended Streamer.bot instance.

### Requirements
- A local Streamer.bot instance running on the same machine as DiceDeck (the proxy)
- The remote Streamer.bot instance you want to control
- The proxy instance must have actions named `remoteGetActions` and `remoteDoAction` set up to relay requests to the remote instance (see Streamer.bot documentation for RPC setup)

### Enabling Proxy Mode
- Add the `?proxy` parameter to your DiceDeck URL:
  - Example: `index.html?proxy&port=8080`
- DiceDeck will use the proxy logic automatically.
- All button actions and action lists will be relayed via the proxy instance.

### When to Use Proxy Mode
- When DiceDeck is running on a device that cannot directly reach the main Streamer.bot instance
- When you want to isolate control or add an extra layer of security

### Proxy Streamerbot Actions to import

#### Proxy Instance
```
U0JBRR+LCAAAAAAABADdV9tu4zYQfS/Qfwj82pWhmy1rgX1InMSXtG5sJ3Kceh94GSlcU6KWkuwoQf69lGzHUeQE28VuUVSAL5oz5MzwzAzJx19/OTpqhJCixsejx+JFvUYoBPXamEAoUji6lOI+PzoFsmx82GqgLL0TstA5hQRkOiDwjK1AJkxEBWg09ab+DFBIiGRxugVfTiYmWXRMtkiUcb7DQhaxMAu95zkLsMCeSo0GRRXPUTlHoiR/bSRHO6iEGS0M+23dsUxX1/y2Y2k2aRENu4almS0TWr5tgGPgnXPlsK8ZZFB1rJRDhDCHYs5UZlBB7gnPKJxLEfZZkgqZv690CRFlUaCUfMSTitaODFmS0YP0eBvjS6VAiix+l7LN8vA1yhO11ocMSRRRET6zUMOJiEgmJUTpITSVLAgUS8XSf67YrFPyipZKmC/9fS9r9m6DD8opAjUTJdz9uFjMmIpsnSwWfzAiRSL8tDk6u1oszqUyuhZy2bYXi5WtktXSLcNdLMKECMkZblLOG9UpP7+2j/MUuoKWztObUYxDElxb/IH2vPTPtX6xk12FnkV7bkZMN6Td1oX6zQqc9D2Ge/zLoDdK5jejh8HZaDw945mSZbdj/QKUTvfmxJiH9/E8P2HYdJPBmWffzkYG7V2Li3GBJ6NusByi2VyMjZPB73ySwzXl9Ow8v324f6D9YeHDbxfd4dfC7oCtA2x5+qB/e0fYSSm7mHLndCyG3TE/vT4LMs/0mJJ/Qaanj6Phaj6bfFH+6dNotMIsKO0p3TKOsfrQ0MtVXFe3N8N4PruPIfQu52HM59ZYYBX7oJ9sxyyHtM/Xt9Njd9AdXinf+HxmcLIcruj5SY6tu9aksDkb6Wim1isfJBu/1NhZ/IBNO7icbnzeyf3pMi7WUvnjlrKbIad9L8fsRCeRx0vsRh91I/UJPn2qJVEsgYgwZhwO5PY2DTnKpymSh7K/1EjQCiaQZDy9Eh6SrOgN7+lWtOp5velVpO2Qjmn7GkYW1mxkORoyO66Gdex0HER838S1oWtgwV3hp+q+r7E0jwt7bvG8xp67SG3GNzvdxtWIwr3CzJfypw/vlTuLkhSpoh2UUerbRzvwtXvqPq1UKxpVtqrD3bHUzhI4lsGbhJBMdelQaRRd5PHpMBkt5Ls2QYqHttXWbNdQZIDaRwi4iJomJh3H+h4yTBWe8RYZrzadf0CH/q/SkbAgQvwtPrqqujikUBsm1HFhLVn6JjMpC0Fk6Ts1YjstjDoGaLbhI822sKLFtg1NRy0wfaPl6KRu9xtpsX48LUaFlv3LgV2zVxirb6lEcI7iBOgLfAfvea4ffACwoTs20Rxim5ptu23NdamhmdA2HBv7LTCM/+rB51RsTyb/r2PPz+mDhxar1N13wUMZ+k1NsE1Qq602Dw1bRFVbx9E17CCkUUqVBPuG5X53tf30JvjDq23zZ6e/KZjKFGp4GKoUqwrXgBNBlpBOQa5epc8e7HKmqK2CRTuUeye216D9ncvYrKGqsVjIFGhRZGVqNc1mZ8NL/VJVoraG1TWw2VYH3qe/AbVew9oXDgAA
```

#### Main Instance
```
U0JBRR+LCAAAAAAABADtWFtv2kgUfl9p/0OU162R79iV+hCccAshARIbvPRhbjYu48v6AjhV/vuOjU0gJtVq1WqrVa2Y4PnOzDlzvpnzDf76+28XF5c+ScHlx4uvxQN7DIBP2OPllPhhSi4e4nCXX9wBL7j8UFmALF2FcWFzTRISpwNEDtiGxIkXBgUotPgWfwAwSVDsRWkFHg8WTrPgClVIkFFaY74XeH7mm4cxC7DAXkqLSwxOIgflGAlr+XPfclFDJezhwnFbUAWiiSonIknnZKQoHGjzIgegzP4UCfCqVgdXdvsrIxk5DaxsJwGAlBRjpnFGTpAdohkm3Tj0+16ShnH+baMHEmAvcJmRA2hyYlWTEZdkXIdVmo5N3DjMogZh/TBJT8wA3YI8YZk+5yYGAQ79AwcNHIUByuKYBOk5NI0912UcHSf+TfL3BARJCgJEBiURfHVxZz7q63gG+6xtWAzjkxV6LilHfCuaBkWd6JxDMORkB0kcUASF0yVN03RCNBVoja5pHhUeRJ3npUYI7/H+SmtSL8PPx+jL68PnE2aay/Zc9uql0Aj2nZ11wGPiEEYdIg0XJWx8XC4tj/G/TZbLOw/FYRI6aWt887hcdmPmdBvGa1VeLjcy29ASLwn6cuknKIypB1uY0svTIT+/9Q/zlBghLoPH83EEfeQ+SfQZ98z0fsvfXk+iLbaGCbDu3IW4WyHpzp0IncHMUlibQhnevp6EQ9Q3PdijXwa94QaKW3c6X9GFZPL2zI0KnLCxjAmNbG91/XTjZmZ/qExFk5/Mh8HDDRaANfnj1hjmtiVsmO/OQppGUFSGtjFIBj1dwEZHXMwHLvLNFEpTOrHGPLD0bGZNottJMfZ6WMQ1okMBrrtfcI9u4HqoMDw80ycze/oj7g+L+Ya3s3U5B8MyEyQ+ucBahPuxpjl5whTfdHP7efdc2Z+L835hCXTgbV3I5jzo2yvkdc7aMF9jw10PjafxZGYoM2wpFS434nz0u6ldxzYfUtw3c+h1eBSYtODGmPNjI2C3++lTY2FFMUGhH3mUnKkK1dKkIJ+lID5XN0qLBGzIlCQZTR9DE8Resbe+ZXti1Vzr+z3vIEdWREHmHABVTlYVjQMAYE5vyxBJQCECxo2uW+K5qyJOplrv1AO9uN5idf19ow8l9u1awTYd2RUO/3mV6BXO9qXltD5TCqKE4CO8hl8Ohk0xVAUN8pLucEBTmRgqhQ5iRWTfZFGWHZ13VOlnFcMeSa+qyvlLDl8nfD4tR5xDXkagrWOOJ7zGmG47HFQg4aQ2lqCqAlESyS9B/C8F8W3baD3ewN6OVkX+ebTGFPpmzgSTFe5IQCLN7Lxzb88xX+BQtPnROmL/5fZ3FtdSIBeVeKD8Sh/0FIrzzh2Yj/kHY9XHFl0PerU40vXI6NSiduhXiQ4TuVoU7Q0TptVCdEPsd/NDf68TsbsU81LID37dSpDpvv+Erl5z013bhhvWvkb7GCpcrn1H9/v56GX/vVA+2vNpB/lYgJaZYcP1QMDy7rHDwU2RS+Wa3aI9H/IjOqbIpyuWL9V+0j3gm1+wsTrEcPu/E1RBAWpbYEWCxw5ggurIHHBkiZUQWREIUtk5Gv60gvrhBxfhxHMDQN+rwgYjlJK0WVKzhFzFLnlnKihjWukzg6JGfX05Twuv6CIQ25ADAmG0KGqb/ZYFbY7XNAIkTIgko39Di8imKX5/WoQfe87Zf6nt90eVkyFYd99n0n7auCUwCdGapDMSbyrZboIG9ZjUnoKp59f2Ry8lXt+ACMK+heyiME4JLo43JW0tsVX95my+4ihRmYMkBS2VKcnL3+ME+eClEQAA
```




## URL Query Parameters

DiceDeck supports several URL query parameters to customize its behavior. You can add these options to the end of the `index.html` URL in your browser. Multiple parameters can be combined using `&` (ampersand). For example: `index.html?port=8080&import`

| Parameter   | Example Value         | What it Does                                                                                 |
|-------------|----------------------|---------------------------------------------------------------------------------------------|
| `port`      | `8080`               | Sets the port for Streamer.bot connection.                                                   |
| `proxy`     | _(no value needed)_  | Enables Proxy Mode for remote Streamer.bot control (see above).                              |
| `import`    | _(no value needed)_  | Shows the Debug Import button for advanced layout import/export.                             |
| `noanim`    | _(no value needed)_  | Disables UI animations for a simpler, static experience.                                     |

#### Details & Examples

- **Connect to a specific port:**
  - `index.html?port=8080`
- **Enable Proxy Mode:**
  - `index.html?proxy&port=8080`
- **Show Debug Import button:**
  - `index.html?import`
- **Disable animations:**
  - `index.html?noanim`
- **Combine options:**
  - `index.html?proxy&import&noanim`

**Tip:**
- To reset to default, simply remove all parameters from the URL and reload the page.

## Data File Format (`data.json`)

DiceDeck uses a `data.json` file to store your grid layout and button configuration. This file defines:
- The number of rows and columns in your grid
- The position, title, icon, and `action_id` for each button
- (Optionally) Additional metadata for advanced layouts

**High-level structure:**
```json
{
  "rows": 3,
  "cols": 5,
  "buttons": [
    { "row": 0, "col": 0, "title": "My Action", "icon": "ic:outline-star", "action_id": "1234" },
    { "row": 1, "col": 2, "title": "Other", "action_id": "5678" }
    // ... more buttons ...
  ]
}
```
- Only the `action_id` is stored for each button; action names are mapped at runtime from Streamer.bot.
- The file may also support more complex layouts (e.g., with pages/items) for advanced users.
- You can edit this file manually or use DiceDeck's UI to export/import your layout.

## Import/Export & Debug Features
- **Export:** Use the Save button in edit mode to download your current layout as `data.json`.
- **Import:** Add `?import` to the URL to show the Debug Import button. You can paste JSON in various formats (including complex page/item layouts) and DiceDeck will auto-compact and validate the grid.
- **Validation:** All imported buttons must have an `action_id` and title. The grid will be compacted to remove empty trailing rows/columns.

## UI & Advanced Features
- **Edit Mode:** Toggle with the Edit button. Allows drag-and-drop, inline grid size editing, and button modals.
- **Grid Settings:** Floating button (outside edit mode) opens a modal to adjust rows/columns.
- **Animated Mesh Background:** SVG mesh animates in the background, adapting complexity to device performance. Disable with `?noanim`.
- **Grid Blur Animation:** The grid background animates with a blur effect (disable with `?noanim`).
- **Debug Overlay:** Press F12 to toggle a debug overlay showing grid coordinates.
- **Warnings:** If the first row or column is empty, a warning is shown.
- **Accessibility:** Keyboard, mouse, and touch support for grid interaction.
- **Sanitization:** All user-provided content is sanitized before being inserted into the DOM.

## File Structure
- `index.html` – Main HTML file
- `script.js` – Application logic (grid, modals, Streamer.bot integration, proxy logic, mesh animation)
- `style.css` – Styles for the UI and modals
- `data.json` – Grid and button configuration

## License
This project is licensed under the MIT License. See [LICENSE](LICENSE) for details. 