// Utility to fetch JSON data
/**
 * Loads grid configuration from `data.json`, converting legacy button action names to action IDs if needed.
 * @returns {Promise<Object>} Resolves to the parsed grid data object with patched button actions.
 */
async function fetchGridData() {
    try {
        const res = await fetch('data.json');
        const data = await res.json();
        // Patch: convert legacy action name to action_id if possible
        if (Array.isArray(data.buttons)) {
            data.buttons.forEach(btn => {
                if (!btn.action_id && btn.action) {
                    btn.action_id = getActionIdByName(btn.action);
                }
            });
        }
        return data;
    } catch (e) {
        console.error('Error fetching grid data:', e);
        throw e;
    }
}

// Status bar update
/**
 * Sets the UI status bar to indicate whether the app is connected to Streamer.bot.
 * Updates the status text and visual indicator based on the connection state.
 */
function SetConnectionStatus(connected) {
    const bar = document.getElementById('status-text');
    const indicator = document.getElementById('status-indicator');
    if (connected) {
        bar.textContent = 'Connected to Streamer.bot';
        indicator.classList.add('connected');
        indicator.classList.remove('disconnected');
    } else {
        bar.textContent = 'Disconnected from Streamer.bot';
        indicator.classList.add('disconnected');
        indicator.classList.remove('connected');
    }
}

// Refactored: Encapsulate app state in a single object
const appState = {
    gridData: null,
    editMode: false,
    availableActions: [],
    dragSrcIdx: null,
    gridBlurMin: 4,
    gridBlurMax: 12,
    unsavedChanges: false,
};
window.appState = appState;

// Utility to map action_id to action name
/**
 * Returns the action name corresponding to a given action ID from the available actions list.
 * If the action ID is not found, returns an empty string.
 * @param {string} action_id - The unique identifier of the action.
 * @returns {string} The name of the action, or an empty string if not found.
 */
function getActionNameById(action_id) {
    if (!appState.availableActions || !Array.isArray(appState.availableActions)) return '';
    const found = appState.availableActions.find(a => a.id === action_id);
    if (!found) {
        console.warn(`getActionNameById: Action name not found for id: ${action_id}`);
    }
    return found ? found.name : '';
}
// Utility to map action name to action_id
/**
 * Returns the action ID corresponding to a given action name from the available actions.
 * If the action name is not found, returns an empty string and logs a warning.
 * @param {string} action_name - The name of the action to look up.
 * @returns {string} The action ID if found; otherwise, an empty string.
 */
function getActionIdByName(action_name) {
    if (!appState.availableActions || !Array.isArray(appState.availableActions)) return '';
    const found = appState.availableActions.find(a => a.name === action_name);
    if (!found) {
        console.warn(`getActionIdByName: Action id not found for name: ${action_name}`);
    }
    return found ? found.id : '';
}

/**
 * Renders the interactive grid of buttons and empty cells in the UI based on the provided layout and settings.
 *
 * Updates the grid container with button elements or empty cells for each position, applying edit mode features, drag-and-drop handlers, and unified action triggers. Also updates grid styling, blur parameters, and invokes icon rendering. Displays debug overlays if enabled.
 * 
 * @param {Object} params - Grid configuration.
 * @param {number} params.rows - Number of grid rows.
 * @param {number} params.cols - Number of grid columns.
 * @param {Array} params.buttons - Array of button objects with position and metadata.
 * @param {number} [params.gap] - Gap size between grid cells in pixels.
 * @param {number} [params.blurMin] - Minimum blur value for grid animation.
 * @param {number} [params.blurMax] - Maximum blur value for grid animation.
 */
function renderGrid({ rows, cols, buttons, gap, blurMin, blurMax }) {
    const grid = document.getElementById('grid-container');
    if (!grid) {
        console.error('renderGrid: Grid container not found in DOM');
        return;
    }
    if (!Array.isArray(buttons)) {
        console.warn('renderGrid: buttons is not an array', buttons);
        return;
    }
    grid.innerHTML = '';
    // Set CSS variables for grid sizing
    grid.style.setProperty('--grid-rows', rows);
    grid.style.setProperty('--grid-cols', cols);
    grid.style.gap = (gap !== undefined ? gap : 16) + 'px';
    appState.gridBlurMin = (blurMin !== undefined ? blurMin : 4);
    appState.gridBlurMax = (blurMax !== undefined ? blurMax : 12);

    // Create a map for quick lookup
    const btnMap = {};
    buttons.forEach((btn, idx) => {
        // Log and skip out-of-bounds buttons
        if (btn.row < 0 || btn.row >= rows || btn.col < 0 || btn.col >= cols) {
            console.warn(`renderGrid: Button at idx ${idx} has out-of-bounds row/col:`, btn);
            return;
        }
        btnMap[`${btn.row},${btn.col}`] = { ...btn, idx };
    });

    /**
     * Handles user interaction with a grid button, triggering the associated Streamer.bot action.
     * Prevents duplicate action triggers on touch devices and displays an alert if the action fails to execute.
     */
    function handleGridButtonAction(e) {
        // Prevent double-firing on touch devices
        if (e.type === 'touchend') {
            e.preventDefault();
            e.target.__handledTouch = true;
        }
        if (e.type === 'click' && e.target.__handledTouch) {
            e.target.__handledTouch = false;
            return;
        }

        const btn = e.currentTarget.__btnData;
        if (
            window.sbClient &&
            window.sbClient.client &&
            window.sbClient.client.doAction &&
            window.sbClient.client.socket &&
            window.sbClient.client.socket.readyState === 1 
        ) {
            window.sbClient.doAction(btn.action_id).catch(err => {
                console.error('Failed to trigger action:', btn.action_id, err);
                alert('Failed to trigger action: ' + btn.action_id);
            });
        }
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const btn = btnMap[`${r},${c}`];
            if (btn) {
                const el = document.createElement('button');
                el.className = 'grid-button';
                el.dataset.row = r;
                el.dataset.col = c;
                el.dataset.idx = btn.idx;
                // In renderGrid, sanitize all user-provided content before inserting into innerHTML
                el.innerHTML = '';
                if (btn.icon) {
                    el.innerHTML += `<span class="button-icon iconify" data-icon="${sanitizeString(btn.icon)}"></span>`;
                }
                el.innerHTML += `<span class="button-title">${sanitizeString(btn.title)}</span>`;
                if (appState.editMode) {
                    el.setAttribute('draggable', 'true');
                    el.ondragstart = handleDragStart;
                    el.ondragover = handleDragOver;
                    el.ondrop = handleDrop;
                    el.ondragend = handleDragEnd;
                    el.ondragleave = handleDragLeave;
                    el.onclick = (e) => {
                        // Only open edit modal on left click
                        if (e.button === 0) {
                            e.preventDefault();
                            openEditModal(btn.idx);
                        }
                    };
                    // Allow middle click to trigger normal action
                    el.onmousedown = (e) => {
                        if (e.button === 1) {
                            e.preventDefault();
                            const actionName = btn.action_id ? getActionNameById(btn.action_id) : (btn.action || '');
                            if (window.sbClient && window.sbClient.socket && window.sbClient.socket.readyState === 1 && actionName) {
                                window.sbClient.doAction({ name: actionName });
                            }
                        }
                    };
                } else {
                    el.removeAttribute('draggable');
                    el.ondragstart = null;
                    el.ondragover = null;
                    el.ondrop = null;
                    el.ondragend = null;
                    el.ondragleave = null;
                    // Remove old handlers
                    el.onclick = null;
                    el.ontouchend = null;
                    // Attach unified handler
                    el.__btnData = btn;
                    el.addEventListener('click', handleGridButtonAction, false);
                    el.addEventListener('touchend', handleGridButtonAction, false);
                }
                // Debug overlay
                if (gridDebugOverlay) {
                    el.style.border = '2px solid red';
                    el.style.position = 'relative';
                    const label = document.createElement('span');
                    label.textContent = `[${r},${c}]`;
                    label.style.position = 'absolute';
                    label.style.top = '2px';
                    label.style.left = '4px';
                    label.style.fontSize = '0.8em';
                    label.style.color = 'red';
                    label.style.background = 'rgba(0,0,0,0.3)';
                    label.style.padding = '0 2px';
                    label.style.borderRadius = '3px';
                    el.appendChild(label);
                } else {
                    el.style.border = '';
                }
                grid.appendChild(el);
            } else {
                // Always render empty cells
                const empty = document.createElement('div');
                empty.className = 'empty-cell' + (appState.editMode ? '' : ' hidden-cell');
                empty.dataset.row = r;
                empty.dataset.col = c;
                if (appState.editMode) {
                    empty.onclick = () => openAddButtonModal(r, c);
                    empty.ondragover = handleDragOver;
                    empty.ondrop = handleDrop;
                    empty.ondragleave = handleDragLeave;
                }
                // Debug overlay
                if (gridDebugOverlay) {
                    empty.style.border = '2px solid red';
                    empty.style.position = 'relative';
                    const label = document.createElement('span');
                    label.textContent = `[${r},${c}]`;
                    label.style.position = 'absolute';
                    label.style.top = '2px';
                    label.style.left = '4px';
                    label.style.fontSize = '0.8em';
                    label.style.color = 'red';
                    label.style.background = 'rgba(0,0,0,0.3)';
                    label.style.padding = '0 2px';
                    label.style.borderRadius = '3px';
                    empty.appendChild(label);
                } else {
                    empty.style.border = '';
                }
                grid.appendChild(empty);
            }
        }
    }
    if (window.Iconify) {
        window.Iconify.scan(grid);
    }
    setSaveButtonState();
}

let dragSrcIdx = null;

function handleDragStart(e) {
    dragSrcIdx = this.dataset.idx;
    this.style.opacity = '0.4';
}

/**
 * Handles the dragover event for grid cells, enabling drop by preventing default behavior and adding a visual indicator.
 * @param {DragEvent} e - The dragover event object.
 */
function handleDragOver(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

/**
 * Handles dropping a dragged button onto another button or empty cell in the grid, updating button positions and re-rendering the grid.
 * 
 * If dropped onto another button, swaps their positions. If dropped onto an empty cell, moves the dragged button to that cell. Marks the layout as having unsaved changes and updates the save button state.
 * 
 * @param {DragEvent} e - The drop event.
 */
function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');
    const targetIdx = this.dataset.idx;
    const targetRow = parseInt(this.dataset.row, 10);
    const targetCol = parseInt(this.dataset.col, 10);
    if (dragSrcIdx === null) {
        console.warn('handleDrop: dragSrcIdx is null');
    }
    if (dragSrcIdx !== null) {
        if (typeof targetIdx !== 'undefined') {
            // Swap with another button
            if (dragSrcIdx !== targetIdx) {
                if (!appState.gridData.buttons[dragSrcIdx] || !appState.gridData.buttons[targetIdx]) {
                    console.warn('handleDrop: Invalid button indices', dragSrcIdx, targetIdx);
                }
                const temp = { ...appState.gridData.buttons[dragSrcIdx] };
                appState.gridData.buttons[dragSrcIdx].row = appState.gridData.buttons[targetIdx].row;
                appState.gridData.buttons[dragSrcIdx].col = appState.gridData.buttons[targetIdx].col;
                appState.gridData.buttons[targetIdx].row = temp.row;
                appState.gridData.buttons[targetIdx].col = temp.col;
                appState.unsavedChanges = true;
                setSaveButtonState();
                renderGrid(appState.gridData);
            }
        } else {
            // Move to empty cell
            if (!appState.gridData.buttons[dragSrcIdx]) {
                console.warn('handleDrop: Invalid dragSrcIdx for empty cell', dragSrcIdx);
            }
            appState.gridData.buttons[dragSrcIdx].row = targetRow;
            appState.gridData.buttons[dragSrcIdx].col = targetCol;
            appState.unsavedChanges = true;
            setSaveButtonState();
            renderGrid(appState.gridData);
        }
    }
    dragSrcIdx = null;
}

function handleDragEnd(e) {
    this.style.opacity = '';
    this.style.outline = '';
}

/**
 * Removes the visual drag-over indicator from a grid cell or button during a drag-and-drop operation.
 */
function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

/**
 * Initializes the Edit Mode toggle functionality and inline grid settings UI, enabling users to switch between normal and edit modes, adjust grid dimensions, and export the current layout.
 *
 * When Edit Mode is activated, displays inline controls for modifying grid rows and columns with validation. Also fetches available actions from the connected Streamer.bot client if available. The Save Layout button allows exporting the current grid configuration as a JSON file.
 */
function setupEditModeToggle() {
    const editBtn = document.getElementById('edit-toggle');
    const saveBtn = document.getElementById('save-layout');
    const statusBarButtons = document.querySelector('.status-bar-buttons');
    if (!editBtn || !saveBtn || !statusBarButtons) {
        console.error('setupEditModeToggle: Required DOM elements missing', { editBtn, saveBtn, statusBarButtons });
        return;
    }
    let gridSettingsInline = document.getElementById('grid-settings-inline');
    /**
     * Updates the inline grid settings UI for editing grid rows and columns.
     *
     * Displays or hides the inline settings controls based on edit mode, synchronizes input values with the current grid configuration, and applies changes with validation. Marks unsaved changes and updates the grid when settings are applied.
     */
    function updateInlineSettings() {
        if (appState.editMode) {
            document.body.classList.add('edit-mode');
            if (!gridSettingsInline) {
                gridSettingsInline = document.createElement('span');
                gridSettingsInline.id = 'grid-settings-inline';
                gridSettingsInline.style.display = 'flex';
                gridSettingsInline.style.alignItems = 'center';
                gridSettingsInline.style.gap = '8px';
                gridSettingsInline.innerHTML = `
                    <label style="color:#b0eaff;font-size:0.98em;">Rows <input id="inline-edit-rows" type="number" min="1" max="20" value="${appState.gridData.rows}" class="inline-grid-input" /></label>
                    <label style="color:#b0eaff;font-size:0.98em;">Cols <input id="inline-edit-cols" type="number" min="1" max="20" value="${appState.gridData.cols}" class="inline-grid-input" /></label>
                    <button id="inline-grid-save" style="background:#23272f;color:#00ffff;border-radius:8px;padding:2px 12px;border:none;font-weight:600;">Apply</button>
                    <span id="inline-grid-error" style="color:#ff5c5c;font-size:0.95em;display:none;margin-left:8px;"></span>
                `;
                // Insert before editBtn inside statusBarButtons
                statusBarButtons.insertBefore(gridSettingsInline, editBtn);
                // Style the number inputs
                const style = document.createElement('style');
                style.innerHTML = `.inline-grid-input { background: #181a1b; color: #b0eaff; border: 1.5px solid #00ffff44; border-radius: 6px; padding: 2px 8px; font-size: 1em; width: 48px; outline: none; transition: border 0.2s; } .inline-grid-input:invalid { border-color: #ff5c5c; background: #2a1818; }`;
                document.head.appendChild(style);
                // Validation logic
                function validate() {
                    const rowsInput = document.getElementById('inline-edit-rows');
                    const colsInput = document.getElementById('inline-edit-cols');
                    const error = document.getElementById('inline-grid-error');
                    let valid = true;
                    let msg = '';
                    const rows = parseInt(rowsInput.value, 10);
                    const cols = parseInt(colsInput.value, 10);
                    if (isNaN(rows) || rows < 1 || rows > 20) {
                        valid = false;
                        msg = 'Rows must be 1-20.';
                        rowsInput.style.borderColor = '#ff5c5c';
                        rowsInput.style.background = '#2a1818';
                    } else {
                        rowsInput.style.borderColor = '#00ffff44';
                        rowsInput.style.background = '#181a1b';
                    }
                    if (isNaN(cols) || cols < 1 || cols > 20) {
                        valid = false;
                        msg = 'Cols must be 1-20.';
                        colsInput.style.borderColor = '#ff5c5c';
                        colsInput.style.background = '#2a1818';
                    } else {
                        colsInput.style.borderColor = '#00ffff44';
                        colsInput.style.background = '#181a1b';
                    }
                    error.textContent = msg;
                    error.style.display = valid ? 'none' : 'inline';
                    document.getElementById('inline-grid-save').disabled = !valid;
                    return valid;
                }
                document.getElementById('inline-edit-rows').addEventListener('input', validate);
                document.getElementById('inline-edit-cols').addEventListener('input', validate);
                document.getElementById('inline-grid-save').onclick = () => {
                    if (!validate()) return;
                    const newRows = parseInt(document.getElementById('inline-edit-rows').value, 10);
                    const newCols = parseInt(document.getElementById('inline-edit-cols').value, 10);
                    appState.gridData.rows = newRows;
                    appState.gridData.cols = newCols;
                    renderGrid(appState.gridData);
                    appState.unsavedChanges = true;
                    setSaveButtonState();
                };
                validate();
            } else {
                document.getElementById('inline-edit-rows').value = appState.gridData.rows;
                document.getElementById('inline-edit-cols').value = appState.gridData.cols;
                gridSettingsInline.style.display = 'flex';
            }
        } else if (gridSettingsInline) {
            document.body.classList.remove('edit-mode');
            gridSettingsInline.style.display = 'none';
        }
    }
    editBtn.onclick = async () => {
        appState.editMode = !appState.editMode;
        editBtn.textContent = appState.editMode ? 'Exit Edit Mode' : 'Edit Mode';
        appState.unsavedChanges = false;
        setSaveButtonState();
        if (appState.editMode && window.sbClient && window.sbClient.getActions) {
            try {
                const response = await window.sbClient.getActions();
                if (response && response.status === 'ok' && Array.isArray(response.actions)) {
                    // Uncomment for debugging:
                    // if (window.DEBUG) console.log(response.actions);
                    appState.availableActions = response.actions;
                }
            } catch (e) {
                appState.availableActions = [];
            }
        }
        updateInlineSettings();
        renderGrid(appState.gridData);
    };
    saveBtn.onclick = () => {
        // Download the new layout as data.json
        const exportData = {
            ...appState.gridData,
            buttons: appState.gridData.buttons.map(btn => ({
                row: btn.row,
                col: btn.col,
                title: btn.title,
                icon: btn.icon,
                action_id: btn.action_id
            }))
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        appState.unsavedChanges = false;
        setSaveButtonState();
    };
    updateInlineSettings();
    setSaveButtonState();
}

/**
 * Updates the visibility and enabled state of the save layout button according to the current edit mode and whether there are unsaved changes.
 */
function setSaveButtonState() {
    const saveBtn = document.getElementById('save-layout');
    if (!saveBtn) {
        console.warn('setSaveButtonState: Save button not found');
        return;
    }
    if (appState.editMode) {
        saveBtn.style.display = 'inline-block';
        saveBtn.disabled = !appState.unsavedChanges;
        saveBtn.classList.toggle('disabled', !appState.unsavedChanges);
    } else {
        saveBtn.style.display = 'none';
    }
}

/**
 * Attempts to establish a connection to a local Streamer.bot instance on the specified port.
 * Resolves with the connected client instance if successful, or rejects with an error object if the connection times out, disconnects, or encounters an error during setup.
 * If the `proxy` query parameter is present, attaches a custom message handler for proxy communication.
 * @param {string} port - The port number to connect to.
 * @param {number} [timeout=2000] - Connection timeout in milliseconds.
 * @returns {Promise<Object>} Resolves with the connected Streamer.bot client instance.
 */
async function tryStreamerbotClientConnect(port, timeout = 2000) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        let timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                if (client && client.disconnect) client.disconnect();
                console.error(`[DiceDeck] Streamer.bot connection timed out (port: ${port})`);
                reject({ reason: 'timeout', port });
            }
        }, timeout);
        let client;
        try {
            client = new window.StreamerbotClient({
                host: "127.0.0.1",
                port,
                onConnect: async (info) => {
                    SetConnectionStatus(true);
                    clearTimeout(timer);
                    if (!resolved) {
                        resolved = true;
                        resolve(client); // Return the client instance
                    }
                },
                onDisconnect: () => {
                    SetConnectionStatus(false);
                    if (!resolved) {
                        clearTimeout(timer);
                        resolved = true;
                        console.error(`[DiceDeck] Streamer.bot disconnected (port: ${port})`);
                        reject({ reason: 'disconnect', port });
                    }
                },
                onError: () => {
                    if (!resolved) {
                        clearTimeout(timer);
                        resolved = true;
                        console.error(`[DiceDeck] Streamer.bot connection error (port: ${port})`);
                        reject({ reason: 'error', port });
                    }
                }
            });
            if (getQueryParam('proxy') !== null)
                client.on("General.Custom", onCustomMessage);
        } catch (e) {
            clearTimeout(timer);
            if (!resolved) {
                resolved = true;
                console.error(`[DiceDeck] Exception during Streamer.bot connection (port: ${port}):`, e);
                reject({ reason: e && e.message ? e.message : 'exception', port });
            }
        }
    });
}

/**
 * Processes custom backend messages, specifically handling proxy RPC responses such as action lists for the Streamer.bot client.
 * Logs a warning for unknown message types and errors encountered during processing.
 * @param {Object} message - The message object received from the backend.
 */
function onCustomMessage(message){
    try {
        if(message?.type === "StreamerBotProxyGetActions"){
            if (window.sbClient instanceof ProxyStreamerBotClient) {
                window.sbClient._handleGetActionsResponse(message.actions || []);
            }
        } else {
            // Log unknown message types for debugging
            console.warn('onCustomMessage: Unknown message type', message?.type, message);
        }
    }
    catch (e) {
        console.error(e);
    }
}

/**
 * Retrieves the value of a query parameter from the current page URL.
 * @param {string} name - The name of the query parameter to retrieve.
 * @return {string|null} The value of the query parameter, or null if not present.
 */
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// --- Adaptive Mesh Complexity ---
let meshRows = 13, meshCols = 22;
if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) { meshRows = 7; meshCols = 12; }
if (navigator.deviceMemory && navigator.deviceMemory <= 4) { meshRows = 7; meshCols = 12; }
const noAnim = getQueryParam('noanim') !== null;

// --- DiceDeckClient Abstraction ---
/**
 * Base class for DiceDeck client implementations.
 * @abstract
 */
class DiceDeckClient {
    /**
     * Fetches available actions.
     * @returns {Promise<{status: string, actions: Array}>}
     */
    async getActions() { throw new Error('Not implemented'); }
    /**
     * Triggers an action.
     * @param {Object} params
     * @returns {Promise<{status: string}>}
     */
    async doAction(params) { throw new Error('Not implemented'); }
}

/**
 * Direct client implementation using the native Streamer.bot WebSocket API.
 */
class DirectStreamerBotClient extends DiceDeckClient {
    /**
     * @param {Object} client - The native Streamer.bot client instance.
     */
    constructor(client) {
        super();
        this.client = client;
    }
    /**
     * Fetches available actions from the native client.
     * @returns {Promise<{status: string, actions: Array}>}
     */
    async getActions() {
        return this.client.getActions();
    }
    /**
     * Triggers an action on the native client.
     * @param {Object} params
     * @returns {Promise<{status: string}>}
     */
    async doAction(params) {
        console.debug('DirectStreamerBotClient.doAction:', params);
        return this.client.doAction(params);
    }
}

/**
 * Proxy client implementation using RPC via localClient.doAction and async responses.
 * Only one in-flight getActions is supported at a time.
 */
class ProxyStreamerBotClient extends DiceDeckClient {
    /**
     * @param {Object} localClient - The local client used to send RPCs.
     */
    constructor(localClient) {
        super();
        this.localClient = localClient;
        this._pendingGetActions = null; // {resolve, reject, timeoutId}
    }
    /**
     * Fetches available actions via RPC. Resolves when the response is received.
     * @returns {Promise<{status: string, actions: Array}>}
     */
    async getActions() {
        if (this._pendingGetActions) {
            return Promise.reject(new Error('A getActions call is already pending'));
        }
        return new Promise((resolve, reject) => {
            // Set up a timeout to avoid hanging forever
            const timeoutId = setTimeout(() => {
                this._pendingGetActions = null;
                reject(new Error('ProxyStreamerBotClient.getActions timed out'));
            }, 5000);
            this._pendingGetActions = { resolve, reject, timeoutId };
            this.localClient.doAction({ name: 'remoteGetActions' });
        });
    }
    /**
     * Called by onCustomMessage when the remote actions response arrives.
     * Maps [{Item1, Item2}] to [{id, name}].
     * @param {Array} actions - The actions array from the remote response.
     */
    _handleGetActionsResponse(actions) {
        if (!Array.isArray(actions)) {
            console.error('ProxyStreamerBotClient._handleGetActionsResponse: Malformed response, expected array:', actions);
            actions = [];
        }
        if (this._pendingGetActions) {
            clearTimeout(this._pendingGetActions.timeoutId);
            // Map [{Item1, Item2}] to [{id, name}]
            const mapped = Array.isArray(actions)
                ? actions.map(a => ({ id: a.Item1, name: a.Item2 }))
                : [];
            this._pendingGetActions.resolve({ status: 'ok', actions: mapped });
            this._pendingGetActions = null;
        }
    }
    /**
     * Triggers a remote action via RPC. No feedback is provided to the caller.
     * @param {Object} params
     * @returns {Promise<{status: string}>}
     */
    async doAction(params) {
        // NOTE: No feedback is provided to the caller for remoteDoAction.
        // If you want to support async responses, implement a similar pattern as getActions.
        console.warn('ProxyStreamerBotClient.doAction: No feedback is provided to the caller.');
        this.localClient.doAction({ name: 'remoteDoAction' }, { remoteActionName: params.name });
        return { status: 'ok' };
    }
}

/**
 * Returns a DiceDeck client instance, selecting either a proxy or direct implementation based on the presence of the 'proxy' query parameter in the URL.
 * @param {Object} client - The native Streamer.bot client instance.
 * @returns {DiceDeckClient} A proxy or direct DiceDeck client.
 */
function createDiceDeckClient(client) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('proxy')) {
        return new ProxyStreamerBotClient(client);
    } else {
        return new DirectStreamerBotClient(client);
    }
}

let previousSbClient = null;

/**
 * Initializes and connects to the Streamer.bot client, assigning the appropriate client abstraction to `window.sbClient`.
 *
 * Disconnects any previous client, attempts to establish a new connection on the specified port, fetches available actions, and updates the UI to reflect connection status.
 *
 * @param {string} port - The port to connect to Streamer.bot (defaults to '8080' if not provided).
 * @returns {Promise<void>} Resolves when the connection is established and actions are fetched; rejects if the client is unavailable or the connection fails.
 */
async function setupStreamerBot(port) {
    if (!window.StreamerbotClient) {
        SetConnectionStatus(false);
        console.error('StreamerbotClient is not available: window.StreamerbotClient is undefined.');
        return Promise.reject('StreamerbotClient not available');
    }
    port = port || '8080';
    // Disconnect previous client if setupStreamerBot is called multiple times
    if (previousSbClient && previousSbClient.disconnect) {
        try {
            previousSbClient.disconnect();
            console.warn('[DiceDeck] Disconnected previous Streamer.bot client.');
        } catch (e) {
            console.error('[DiceDeck] Error disconnecting previous Streamer.bot client:', e);
        }
    }
    return tryStreamerbotClientConnect(port).then((client) => {
        previousSbClient = client;
        window.sbClient = createDiceDeckClient(client);
        // Fetch available actions immediately after connection
        if (window.sbClient.getActions) {
            return window.sbClient.getActions().then(response => {
                // Uncomment for debugging:
                // if (window.DEBUG) console.log(response);
                if (response && response.status === 'ok' && Array.isArray(response.actions)) {
                    appState.availableActions = response.actions;
                }
            });
        }
        return Promise.resolve(); // No actions to fetch
    }).then(() => {
        SetConnectionStatus(true);
        return Promise.resolve();
    }).catch((err) => {
        SetConnectionStatus(false);
        let reason = err && err.reason ? err.reason : err;
        console.warn('[DiceDeck] Failed to connect to Streamer.bot:', reason);
        const bar = document.getElementById('status-text');
        if (bar) {
            bar.textContent = `Failed to connect to Streamer.bot: ${reason}`;
        }
        return Promise.reject(err);
    });
}

/**
 * Opens a modal dialog to edit the properties of a grid button, allowing changes to its title, icon, and associated action, or removal of the button.
 * 
 * If the specified button index does not exist, the function logs an error and does nothing. Upon saving or removing, the grid is re-rendered and unsaved changes are marked.
 * 
 * @param {number} idx - The index of the button in the grid's button array to edit.
 */
function openEditModal(idx) {
    const btn = appState.gridData.buttons[idx];
    if (!btn) {
        console.error('openEditModal: Button not found at idx', idx);
        return;
    }
    // Modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'edit-modal-backdrop';
    // Modal
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <button class="modal-close" title="Close">&times;</button>
        <div class="modal-title">Edit Button</div>
        <label for="edit-title">Title</label>
        <input id="edit-title" type="text" value="${sanitizeString(btn.title)}" />
        <label for="edit-icon">Icon Name (e.g. ic:outline-question-mark)</label>
        <input id="edit-icon" type="text" value="${sanitizeString(btn.icon || '')}" placeholder="Optional iconify name" />
        <label for="edit-action">Action</label>
        <select id="edit-action"></select>
        <div class="add-remove-btns">
            <button class="remove-btn">Remove Button</button>
        </div>
        <div class="modal-actions">
            <button id="edit-save">Save</button>
            <button id="edit-cancel">Cancel</button>
        </div>
    `;
    // Populate actions
    const actionSelect = modal.querySelector('#edit-action');
    if (appState.availableActions && appState.availableActions.length > 0) {
        appState.availableActions.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.name;
            // Select by action_id, fallback to action name for legacy
            if ((btn.action_id && a.id === btn.action_id) || (!btn.action_id && btn.action && a.name === btn.action)) opt.selected = true;
            actionSelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = btn.action_id || '';
        opt.textContent = btn.action || '';
        opt.selected = true;
        actionSelect.appendChild(opt);
    }
    // Save handler
    modal.querySelector('#edit-save').onclick = () => {
        btn.title = modal.querySelector('#edit-title').value;
        btn.icon = modal.querySelector('#edit-icon').value.trim() || undefined;
        btn.action_id = actionSelect.value;
        // Remove legacy action name if present
        delete btn.action;
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        renderGrid(appState.gridData);
        appState.unsavedChanges = true;
        setSaveButtonState();
    };
    // Remove handler
    modal.querySelector('.remove-btn').onclick = () => {
        appState.gridData.buttons.splice(idx, 1);
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        renderGrid(appState.gridData);
        appState.unsavedChanges = true;
        setSaveButtonState();
    };
    // Cancel/close handler
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
    modal.querySelector('#edit-cancel').onclick = closeModal;
    modal.querySelector('.modal-close').onclick = closeModal;
    // Show
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    // Live icon preview
    const iconInput = modal.querySelector('#edit-icon');
    iconInput.addEventListener('input', () => {
        const val = iconInput.value.trim();
        let preview = modal.querySelector('.icon-preview');
        if (!preview) {
            preview = document.createElement('span');
            preview.className = 'icon-preview button-icon';
            iconInput.parentNode.insertBefore(preview, iconInput.nextSibling);
        }
        preview.innerHTML = val ? `<span class="iconify" data-icon="${val}"></span>` : '';
        if (window.Iconify) window.Iconify.scan(preview);
    });
    // Initial preview
    iconInput.dispatchEvent(new Event('input'));
}

/**
 * Opens a modal dialog to add a new button to the grid at the specified row and column.
 *
 * The modal allows the user to enter a title, optionally specify an icon, and select an action from the available actions.
 * On confirmation, the new button is added to the grid, the UI is updated, and unsaved changes are marked.
 * The modal also provides a live icon preview as the user types.
 *
 * @param {number} row - The row index where the new button will be placed.
 * @param {number} col - The column index where the new button will be placed.
 */
function openAddButtonModal(row, col) {
    if (!appState.gridData) {
        console.error('openAddButtonModal: appState.gridData is missing');
        return;
    }
    // Modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'edit-modal-backdrop';
    // Modal
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <button class="modal-close" title="Close">&times;</button>
        <div class="modal-title">Add Button</div>
        <label for="add-title">Title</label>
        <input id="add-title" type="text" value="" />
        <label for="add-icon">Icon Name (e.g. ic:outline-question-mark)</label>
        <input id="add-icon" type="text" value="" placeholder="Optional iconify name" />
        <label for="add-action">Action</label>
        <select id="add-action"></select>
        <div class="modal-actions">
            <button id="add-save">Add</button>
            <button id="add-cancel">Cancel</button>
        </div>
    `;
    // Populate actions
    const actionSelect = modal.querySelector('#add-action');
    if (appState.availableActions && appState.availableActions.length > 0) {
        appState.availableActions.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.name;
            actionSelect.appendChild(opt);
        });
    }
    // Save handler
    modal.querySelector('#add-save').onclick = () => {
        const title = modal.querySelector('#add-title').value;
        const icon = modal.querySelector('#add-icon').value.trim() || undefined;
        const action_id = actionSelect.value;
        appState.gridData.buttons.push({ row, col, title, icon, action_id });
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        renderGrid(appState.gridData);
        appState.unsavedChanges = true;
        setSaveButtonState();
    };
    // Cancel/close handler
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
    modal.querySelector('#add-cancel').onclick = closeModal;
    modal.querySelector('.modal-close').onclick = closeModal;
    // Show
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    // Live icon preview
    const iconInput = modal.querySelector('#add-icon');
    iconInput.addEventListener('input', () => {
        const val = iconInput.value.trim();
        let preview = modal.querySelector('.icon-preview');
        if (!preview) {
            preview = document.createElement('span');
            preview.className = 'icon-preview button-icon';
            iconInput.parentNode.insertBefore(preview, iconInput.nextSibling);
        }
        preview.innerHTML = val ? `<span class="iconify" data-icon="${val}"></span>` : '';
        if (window.Iconify) window.Iconify.scan(preview);
    });
    // Initial preview
    iconInput.dispatchEvent(new Event('input'));
}

/**
 * Displays a modal dialog allowing the user to change the grid's row and column count.
 *
 * Updates the grid structure in `appState.gridData` and re-renders the grid upon saving. Changes are marked as unsaved and must be explicitly saved to persist. If the grid data is missing, the function logs an error and does nothing.
 */
function openGridSettingsModal() {
    if (!appState.gridData) {
        console.error('openGridSettingsModal: appState.gridData is missing');
        return;
    }
    // Modal backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'edit-modal-backdrop';
    // Modal
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
        <button class="modal-close" title="Close">&times;</button>
        <div class="modal-title">Grid Settings</div>
        <div style="font-size:0.98em;margin-bottom:8px;color:#b0eaff;">Changing rows/columns updates the grid structure. <b>To save these changes, click the Save button at the top after closing this dialog.</b></div>
        <div class="row">
            <label for="edit-rows">Rows</label>
            <input id="edit-rows" type="number" min="1" max="20" value="${appState.gridData.rows}" style="width:60px;" />
            <label for="edit-cols">Columns</label>
            <input id="edit-cols" type="number" min="1" max="20" value="${appState.gridData.cols}" style="width:60px;" />
        </div>
        <div class="modal-actions">
            <button id="grid-save">Save</button>
            <button id="grid-cancel">Cancel</button>
        </div>
    `;
    modal.querySelector('#grid-save').onclick = () => {
        const newRows = parseInt(modal.querySelector('#edit-rows').value, 10);
        const newCols = parseInt(modal.querySelector('#edit-cols').value, 10);
        appState.gridData.rows = newRows;
        appState.gridData.cols = newCols;
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        renderGrid(appState.gridData);
        appState.unsavedChanges = true;
        setSaveButtonState();
    };
    function closeModal() {
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
    }
    modal.querySelector('#grid-cancel').onclick = closeModal;
    modal.querySelector('.modal-close').onclick = closeModal;
    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
}

let meshAnimationState = {
    svg: null,
    lines: [],
    lastFrame: 0,
    running: true,
    rows: meshRows,
    cols: meshCols,
};

/**
 * Animates the SVG polygonal mesh background with dynamic, wavy motion and adaptive complexity based on frame timing.
 * @param {boolean} force - If true, forces a redraw regardless of animation state or frame timing.
 *
 * The function updates the mesh's points and lines to create a fluid, animated effect. Mesh complexity (rows and columns) adjusts automatically for performance. If the SVG element is missing, a warning is logged and animation is skipped.
 */
function animatePolygonalMesh(force) {
    if (noAnim) return;
    if (!meshAnimationState.svg) {
        meshAnimationState.svg = document.getElementById('bg-mesh');
    }
    const svg = meshAnimationState.svg;
    if (!svg) {
        console.warn('animatePolygonalMesh: SVG element not found');
        return;
    }
    if (!meshAnimationState.running && !force) return;
    // 24fps throttle
    const now = performance.now();
    if (!force && now - meshAnimationState.lastFrame < 1000/24) {
        requestAnimationFrame(animatePolygonalMesh);
        return;
    }
    meshAnimationState.lastFrame = now;

    // Dynamic mesh complexity based on frame time
    if (!force && meshAnimationState.lastFrame) {
        const frameDuration = now - meshAnimationState.lastFrame;
        if (frameDuration > 50 && meshAnimationState.rows > 7) { meshAnimationState.rows--; meshAnimationState.cols--; }
        if (frameDuration < 30 && meshAnimationState.rows < meshRows) { meshAnimationState.rows++; meshAnimationState.cols++; }
    }

    const w = window.innerWidth * 1.12;
    const h = window.innerHeight * 1.12;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);

    const rows = meshAnimationState.rows;
    const cols = meshAnimationState.cols;
    const points = [];
    const time = Date.now() / 4000;
    const meshRadius = 110;
    for (let y = 0; y <= rows; y++) {
        for (let x = 0; x <= cols; x++) {
            const px = (w / cols) * x;
            const py = (h / rows) * y;
            const dx = Math.sin(time + x * 0.7 + y * 0.3) * meshRadius * Math.sin(time + y * 0.5 + x * 0.2);
            const dy = Math.cos(time + y * 0.6 + x * 0.4) * meshRadius * Math.cos(time + x * 0.3 + y * 0.2);
            points.push({ x: px + dx, y: py + dy });
        }
    }
    if (meshAnimationState.lines.length === 0) {
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                for (let l = 0; l < 4; l++) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('stroke', '#00ffff');
                    line.setAttribute('stroke-width', '1.2');
                    line.setAttribute('opacity', '0.35');
                    svg.appendChild(line);
                    meshAnimationState.lines.push(line);
                }
            }
        }
    }
    let lineIdx = 0;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const idx = y * (cols + 1) + x;
            const p1 = points[idx];
            const p2 = points[idx + 1];
            const p3 = points[idx + cols + 2];
            const p4 = points[idx + cols + 1];
            updateLine(meshAnimationState.lines[lineIdx++], p1, p2);
            updateLine(meshAnimationState.lines[lineIdx++], p2, p3);
            updateLine(meshAnimationState.lines[lineIdx++], p3, p4);
            updateLine(meshAnimationState.lines[lineIdx++], p4, p1);
        }
    }
    requestAnimationFrame(animatePolygonalMesh);
}
function updateLine(line, p1, p2) {
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
}
// Pause/resume on visibility change
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
        meshAnimationState.running = !document.hidden;
        if (meshAnimationState.running) animatePolygonalMesh(true);
    });
}

/**
 * Continuously animates a blur and saturation effect on the grid container for a dynamic visual appearance.
 */
function animateGridBlur() {
    if (noAnim) return;
    const grid = document.getElementById('grid-container');
    if (!grid) return;
    const t = Date.now() / 3000;
    const blur = appState.gridBlurMin + Math.abs(Math.sin(t)) * (appState.gridBlurMax - appState.gridBlurMin);
    grid.style.backdropFilter = `blur(${blur}px) saturate(1.1)`;
    grid.style.webkitBackdropFilter = `blur(${blur}px) saturate(1.1)`;
    requestAnimationFrame(animateGridBlur);
}

// On DOMContentLoaded, try normal connect, else discover
window.addEventListener('DOMContentLoaded', async () => {
    SetConnectionStatus(false);
    if (noAnim) {
        document.body.classList.add('no-anim');
    }
    SetConnectionStatus(false);
    try {
        appState.gridData = await fetchGridData();
        renderGrid(appState.gridData);
    } catch (e) {
        console.error(e);
        const bar = document.getElementById('status-text');
        bar.textContent = 'Failed to load grid data';
        return;
    }
    setupEditModeToggle();
    const urlParams = new URLSearchParams(window.location.search);

    const port = urlParams.get('port') || '8080';
    await setupStreamerBot(port);

    animatePolygonalMesh();
    animateGridBlur();
    // Add grid settings floating button if not present
    let gridSettingsBtn = document.getElementById('grid-settings-btn');
    if (!gridSettingsBtn) {
        gridSettingsBtn = document.createElement('button');
        gridSettingsBtn.id = 'grid-settings-btn';
        gridSettingsBtn.className = 'grid-settings-fab';
        gridSettingsBtn.title = 'Set grid rows/columns';
        gridSettingsBtn.innerHTML = '<span class="iconify" data-icon="ic:outline-grid-on"></span>';
        gridSettingsBtn.onclick = openGridSettingsModal;
        gridSettingsBtn.style.position = 'absolute';
        gridSettingsBtn.style.top = '36px';
        gridSettingsBtn.style.left = '36px';
        gridSettingsBtn.style.zIndex = '10';
        gridSettingsBtn.style.display = 'none';
        document.body.appendChild(gridSettingsBtn);
    }
    // Toggle visibility based on edit mode
    function updateGridSettingsBtn() {
        gridSettingsBtn.style.display = appState.editMode ? 'none' : '';
    }
    // Hook into edit mode toggle
    const origEditBtnHandler = document.getElementById('edit-toggle').onclick;
    document.getElementById('edit-toggle').onclick = function(...args) {
        if (typeof origEditBtnHandler === 'function') origEditBtnHandler.apply(this, args);
        updateGridSettingsBtn();
    };
    // Also update on load
    updateGridSettingsBtn();
});

// Debug Import Button and Modal Logic
const debugImportBtn = document.getElementById('debugImportBtn');
const debugImportModal = document.getElementById('debugImportModal');
const debugImportTextarea = document.getElementById('debugImportTextarea');
const debugImportCancel = document.getElementById('debugImportCancel');
const debugImportConfirm = document.getElementById('debugImportConfirm');

if (debugImportBtn && debugImportModal && debugImportTextarea && debugImportCancel && debugImportConfirm) {
    debugImportBtn.addEventListener('click', () => {
        debugImportTextarea.value = '';
        debugImportModal.style.display = 'flex';
    });
    debugImportCancel.addEventListener('click', () => {
        debugImportModal.style.display = 'none';
    });
    debugImportConfirm.addEventListener('click', () => {
        let json;
        try {
            json = JSON.parse(debugImportTextarea.value);
        } catch (e) {
            console.error('Debug Import: Invalid JSON', e);
            alert('Invalid JSON!');
            return;
        }
        // Detect if this is the complex format with pages/items
        let importButtons = null;
        if (json.pages && Array.isArray(json.pages) && json.pages.length > 0 && Array.isArray(json.pages[0].items)) {
            // Extract from first page's items
            const page = json.pages[0];
            importButtons = page.items.map(itemObj => {
                const item = itemObj.item || {};
                const state = Array.isArray(item.states) && item.states.length > 0 ? item.states[0] : {};
                return {
                    row: itemObj.y ?? 0,
                    col: itemObj.x ?? 0,
                    title: state.title || item.name || '',
                    icon: item.icon || undefined,
                    action_id: item.action_id || ''
                };
            });
            // Best fit: calculate min grid size needed
            let maxRow = 0, maxCol = 0;
            // Track used positions to resolve conflicts
            const usedPositions = new Set();
            // First pass: mark all intended positions
            importButtons.forEach(btn => {
                if (btn.row > maxRow) maxRow = btn.row;
                if (btn.col > maxCol) maxCol = btn.col;
            });
            let minRows = maxRow + 1;
            let minCols = maxCol + 1;
            // Use imported num_rows/num_cols only if larger than needed
            let useRows = (typeof page.num_rows === 'number' && page.num_rows > minRows) ? page.num_rows : minRows;
            let useCols = (typeof page.num_cols === 'number' && page.num_cols > minCols) ? page.num_cols : minCols;
            // Second pass: resolve conflicts by moving to next available cell
            const occupied = new Set();
            importButtons.forEach(btn => {
                let pos = `${btn.row},${btn.col}`;
                if (!occupied.has(pos)) {
                    occupied.add(pos);
                } else {
                    // Find next available cell
                    let found = false;
                    for (let r = 0; r < useRows && !found; r++) {
                        for (let c = 0; c < useCols && !found; c++) {
                            let tryPos = `${r},${c}`;
                            if (!occupied.has(tryPos)) {
                                btn.row = r;
                                btn.col = c;
                                occupied.add(tryPos);
                                found = true;
                            }
                        }
                    }
                    if (!found) {
                        // If grid is full, just skip (shouldn't happen with best fit sizing)
                    }
                }
            });
            // --- Compact bounds: remove fully empty rows and columns ---
            // 1. Find all used rows and columns
            const usedRows = new Set(importButtons.map(btn => btn.row));
            const usedCols = new Set(importButtons.map(btn => btn.col));
            // 2. Create sorted arrays of used rows/cols
            const sortedRows = Array.from(usedRows).sort((a, b) => a - b);
            const sortedCols = Array.from(usedCols).sort((a, b) => a - b);
            // 3. Build mapping from old index to new compacted index
            const rowMap = new Map(sortedRows.map((val, idx) => [val, idx]));
            const colMap = new Map(sortedCols.map((val, idx) => [val, idx]));
            // 4. Remap button positions
            importButtons.forEach(btn => {
                btn.row = rowMap.get(btn.row);
                btn.col = colMap.get(btn.col);
            });
            // 5. Set new compacted grid size
            if (appState.gridData) {
                appState.gridData.rows = sortedRows.length;
                appState.gridData.cols = sortedCols.length;
            }
        } else if (Array.isArray(json)) {
            // Simple array of {action_id, title, ...}
            importButtons = json.map(item => ({
                row: item.row ?? 0,
                col: item.col ?? 0,
                title: item.title,
                icon: item.icon,
                action_id: item.action_id
            }));
        }
        if (!importButtons || !Array.isArray(importButtons) || importButtons.length === 0) {
            console.warn('Debug Import: Could not find any buttons to import in the provided JSON.', json);
            alert('Could not find any buttons to import in the provided JSON.');
            return;
        }
        // Validate all have action_id and title
        const valid = importButtons.every(item => item.action_id && item.title);
        if (!valid) {
            console.warn('Debug Import: Each imported button must have action_id and title.', importButtons);
            alert('Each imported button must have action_id and title.');
            return;
        }
        // Update app data structure and UI
        importLayout(importButtons);
        debugImportModal.style.display = 'none';
    });
}

// Show Debug Import button only if ?import is present
if (getQueryParam('import') === null) {
    const debugBtn = document.getElementById('debugImportBtn');
    if (debugBtn) debugBtn.style.display = 'none';
}

/**
 * Imports and applies a new grid layout from an array of button objects.
 * 
 * The function sanitizes and normalizes button positions, compacts the grid to remove empty rows and columns, updates the grid configuration in `appState`, re-renders the grid, checks for empty leading rows or columns, and marks the layout as having unsaved changes.
 * 
 * @param {Array} layoutArray - Array of button objects to import into the grid.
 */
function importLayout(layoutArray) {
    if (!appState.gridData) {
        console.error('importLayout: appState.gridData is missing');
        return;
    }
    if (!Array.isArray(layoutArray)) {
        console.warn('importLayout: layoutArray is not an array', layoutArray);
        return;
    }
    // Normalize button positions
    let normalized = normalizeButtons(layoutArray.map(sanitizeButton));
    // Compact: remove empty trailing columns and rows
    if (normalized.length > 0) {
        // Find used rows and columns
        const usedRows = new Set(normalized.map(b => b.row));
        const usedCols = new Set(normalized.map(b => b.col));
        // Find max used row/col
        const maxRow = Math.max(...usedRows);
        const maxCol = Math.max(...usedCols);
        // Remove buttons outside compacted bounds (shouldn't happen, but safe)
        normalized = normalized.filter(b => b.row <= maxRow && b.col <= maxCol);
        // Remap rows/cols to compact (no gaps)
        const sortedRows = Array.from(usedRows).sort((a, b) => a - b);
        const sortedCols = Array.from(usedCols).sort((a, b) => a - b);
        const rowMap = new Map(sortedRows.map((val, idx) => [val, idx]));
        const colMap = new Map(sortedCols.map((val, idx) => [val, idx]));
        normalized.forEach(b => {
            b.row = rowMap.get(b.row);
            b.col = colMap.get(b.col);
        });
        appState.gridData.rows = sortedRows.length;
        appState.gridData.cols = sortedCols.length;
    }
    appState.gridData.buttons = normalized;
    renderGrid(appState.gridData);
    checkGridGaps(appState.gridData.buttons, appState.gridData.rows, appState.gridData.cols);
    appState.unsavedChanges = true;
    setSaveButtonState();
}

/**
 * Adjusts all button positions so that the smallest row and column indices start at zero.
 * @param {Array} buttons - Array of button objects with `row` and `col` properties.
 * @returns {Array} The input array with button positions normalized to start from the top-left corner.
 */
function normalizeButtons(buttons) {
    if (!Array.isArray(buttons) || buttons.length === 0) {
        console.warn('normalizeButtons: buttons is not a non-empty array', buttons);
        return buttons;
    }
    // Find min row/col
    let minRow = Math.min(...buttons.map(b => b.row));
    let minCol = Math.min(...buttons.map(b => b.col));
    // Shift all buttons so min row/col is 0
    if (minRow !== 0 || minCol !== 0) {
        buttons.forEach(b => {
            b.row -= minRow;
            b.col -= minCol;
        });
    }
    return buttons;
}
/**
 * Displays a warning if the first row or first column of the grid has no buttons.
 * @param {Array} buttons - Array of button objects with `row` and `col` properties.
 * @param {number} rows - Total number of grid rows.
 * @param {number} cols - Total number of grid columns.
 */
function checkGridGaps(buttons, rows, cols) {
    let firstRowEmpty = true, firstColEmpty = true;
    for (let c = 0; c < cols; c++) {
        if (buttons.some(b => b.row === 0 && b.col === c)) {
            firstRowEmpty = false;
            break;
        }
    }
    for (let r = 0; r < rows; r++) {
        if (buttons.some(b => b.col === 0 && b.row === r)) {
            firstColEmpty = false;
            break;
        }
    }
    let warn = document.getElementById('grid-gap-warning');
    if (!warn) {
        warn = document.createElement('div');
        warn.id = 'grid-gap-warning';
        warn.style.position = 'fixed';
        warn.style.bottom = '16px';
        warn.style.left = '50%';
        warn.style.transform = 'translateX(-50%)';
        warn.style.background = '#ff5c5c';
        warn.style.color = '#fff';
        warn.style.padding = '8px 18px';
        warn.style.borderRadius = '8px';
        warn.style.fontWeight = 'bold';
        warn.style.zIndex = 9999;
        warn.style.boxShadow = '0 2px 8px #0008';
        document.body.appendChild(warn);
    }
    if (firstRowEmpty || firstColEmpty) {
        warn.textContent = 'Warning: The entire first row or column of your grid is empty.';
        warn.style.display = 'block';
    } else {
        warn.style.display = 'none';
    }
}

/**
 * Escapes special HTML characters in a string to prevent HTML injection when inserting into the DOM.
 * @param {string} str - The input string to sanitize.
 * @returns {string} The sanitized string with special characters replaced by HTML entities.
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function (c) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]);
    });
}

/**
 * Returns a sanitized and normalized button object with validated row and column indices and escaped string fields.
 * @param {Object} btn - The button object to sanitize.
 * @returns {Object} A new button object with safe and normalized properties.
 */
function sanitizeButton(btn) {
    return {
        row: Number.isInteger(btn.row) ? btn.row : 0,
        col: Number.isInteger(btn.col) ? btn.col : 0,
        title: sanitizeString(btn.title || ''),
        icon: sanitizeString(btn.icon || ''),
        action_id: sanitizeString(btn.action_id || ''),
    };
}

// Debug overlay toggle
let gridDebugOverlay = false;
document.addEventListener('keydown', (e) => {
    if (e.key === 'F12') {
        gridDebugOverlay = !gridDebugOverlay;
        renderGrid(appState.gridData);
        e.preventDefault();
    }
});