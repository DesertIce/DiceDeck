// Utility to fetch JSON data
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
function getActionNameById(action_id) {
    if (!appState.availableActions || !Array.isArray(appState.availableActions)) return '';
    const found = appState.availableActions.find(a => a.id === action_id);
    if (!found) {
        console.warn(`getActionNameById: Action name not found for id: ${action_id}`);
    }
    return found ? found.name : '';
}
// Utility to map action name to action_id
function getActionIdByName(action_name) {
    if (!appState.availableActions || !Array.isArray(appState.availableActions)) return '';
    const found = appState.availableActions.find(a => a.name === action_name);
    if (!found) {
        console.warn(`getActionIdByName: Action id not found for name: ${action_name}`);
    }
    return found ? found.id : '';
}

function renderGrid({ rows, cols, buttons, gap, blurMin, blurMax }) {
    const grid = document.getElementById('grid-container');
    if (!grid) {
        console.error('renderGrid: Grid container not found in DOM');
        return;
    }
    if (!Array.isArray(buttons)) {
        console.warn('renderGrid: buttons is not an array', buttons);
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
        btnMap[`${btn.row},${btn.col}`] = { ...btn, idx };
    });

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
                        console.log("YEEET");
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
                    el.onclick = async (e) => {
                        const actionName = btn.action_id ? getActionNameById(btn.action_id) : (btn.action || '');
                        if (
                            window.sbClient &&
                            window.sbClient.socket &&
                            window.sbClient.socket.readyState === 1 &&
                            actionName
                        ) {
                            try {
                                await window.sbClient.doAction({ name: actionName });
                            } catch (err) {
                                alert('Failed to trigger action: ' + actionName);
                            }
                        }
                    };
                    el.ontouchend = el.onclick;
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

function handleDragOver(e) {
    e.preventDefault();
    this.classList.add('drag-over');
}

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

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function setupEditModeToggle() {
    const editBtn = document.getElementById('edit-toggle');
    const saveBtn = document.getElementById('save-layout');
    const statusBarButtons = document.querySelector('.status-bar-buttons');
    if (!editBtn || !saveBtn || !statusBarButtons) {
        console.error('setupEditModeToggle: Required DOM elements missing', { editBtn, saveBtn, statusBarButtons });
        return;
    }
    let gridSettingsInline = document.getElementById('grid-settings-inline');
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
                    console.log(response.actions);
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

// Move setSaveButtonState to top level
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

// Utility to get password from query param
function getStreamerbotPassword() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('password') || undefined;
}

// Use StreamerbotClient for handshake/info
async function tryStreamerbotClientConnect(host, port, timeout = 2000) {
    return new Promise((resolve, reject) => {
        let resolved = false;
        let timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                if (client && client.disconnect) client.disconnect();
                reject({ reason: 'timeout', host, port });
            }
        }, timeout);
        let client;
        try {
            client = new window.StreamerbotClient({
                host,
                port,
                password: getStreamerbotPassword(),
                onConnect: async (info) => {
                    clearTimeout(timer);
                    if (!resolved) {
                        resolved = true;
                        // Do not disconnect here; keep the client alive
                        resolve(client); // Return the client instance
                    }
                },
                onDisconnect: () => {
                    if (!resolved) {
                        clearTimeout(timer);
                        resolved = true;
                        reject({ reason: 'disconnect', host, port });
                    }
                },
                onError: () => {
                    if (!resolved) {
                        clearTimeout(timer);
                        resolved = true;
                        reject({ reason: 'error', host, port });
                    }
                }
            });

            client.on("General.Custom", onCustomMessage)
        } catch (e) {
            clearTimeout(timer);
            if (!resolved) {
                resolved = true;
                reject({ reason: e && e.message ? e.message : 'exception', host, port });
            }
        }
    });
}

function onCustomMessage(message){
    try {
        if(message?.type === "StreamerBotProxyGetActions"){
            //const remoteJson = 
        }
    }
    catch (e) {
        console.error(e);
    }
}

// --- Query Param Helpers ---
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// --- Adaptive Mesh Complexity ---
let meshRows = 13, meshCols = 22;
if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) { meshRows = 7; meshCols = 12; }
if (navigator.deviceMemory && navigator.deviceMemory <= 4) { meshRows = 7; meshCols = 12; }
const noAnim = getQueryParam('noanim') !== null;

// Patch setupStreamerBot to accept address/port
function setupStreamerBot(address, port) {
    if (!window.StreamerbotClient) {
        SetConnectionStatus(false);
        return Promise.reject('StreamerbotClient not available');
    }
    const urlParams = new URLSearchParams(window.location.search);
    const paramAddress = urlParams.get('address');
    const paramPort = urlParams.get('port');
    address = address || localStorage.getItem('sbServerAddress') || paramAddress || '127.0.0.1';
    port = port || localStorage.getItem('sbServerPort') || paramPort || '8080';
    if (paramAddress || paramPort) {
        console.log(`[DiceDeck] Using Streamer.bot address from query params: ${address}:${port}`);
    }
    const storedInstanceId = localStorage.getItem('sbInstanceId');
    return tryStreamerbotClientConnect(address, port).then((client) => {
        window.sbClient = client;
        // Fetch available actions immediately after connection
        if (client.getActions) {
            return client.getActions().then(response => {
                if (response && response.status === 'ok' && Array.isArray(response.actions)) {
                    console.debug(response.action);
                    appState.availableActions = response.actions;
                }
            });
        }
        return Promise.resolve(); // No actions to fetch
    }).then(() => {
        // Confirm instanceId if previously stored
        if (storedInstanceId) {
            return (client.getHostInfo ? client.getHostInfo() : Promise.resolve()).then(hostInfo => {
                if (hostInfo && hostInfo.instanceId === storedInstanceId) {
                    console.log(`[DiceDeck] Confirmed reconnection to previously confirmed Streamer.bot instance: ${hostInfo.instanceId}`);
                } else {
                    console.warn(`[DiceDeck] Connected to a different Streamer.bot instance! Expected: ${storedInstanceId}, Got: ${hostInfo && hostInfo.instanceId}`);
                    // This part of the logic is now handled by lan-scan.js, so we just log and let it handle the overlay
                    console.log('[DiceDeck] User accepted new Streamer.bot instance.');
                }
            });
        }
        return Promise.resolve(); // No instanceId to confirm
    }).then(() => {
        SetConnectionStatus(true);
        return Promise.resolve();
    }).catch((err) => {
        SetConnectionStatus(false);
        console.warn('[DiceDeck] Failed to connect to Streamer.bot:', err);
        return Promise.reject(err);
    });
}

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
    const address = urlParams.get('address');
    const host = urlParams.get('host');
    const port = urlParams.get('port') || localStorage.getItem('sbServerPort') || '8080';
    let connected = false;
    let connectPromise;
    if (address) {
        connectPromise = setupStreamerBot(address, port)
            .then(() => {
                connected = true;
                console.log('[DiceDeck] Connected to Streamer.bot at', address, port);
            })
            .catch(() => {
                SetConnectionStatus(false);
                const bar = document.getElementById('status-text');
                bar.textContent = `Failed to connect to Streamer.bot at ${address}:${port}`;
                console.warn('[DiceDeck] Failed to connect to Streamer.bot at', address, port);
            });
    } else if (host) {
        connectPromise = setupStreamerBot(host, port)
            .then(() => {
                connected = true;
                console.log('[DiceDeck] Connected to Streamer.bot at', host, port);
            })
            .catch(() => {
                SetConnectionStatus(false);
                const bar = document.getElementById('status-text');
                bar.textContent = `Failed to connect to Streamer.bot at ${host}:${port}`;
                console.warn('[DiceDeck] Failed to connect to Streamer.bot at', host, port);
            });
    } else {
        // 2. Try localhost/127.0.0.1
        connectPromise = setupStreamerBot('127.0.0.1', port)
            .then(() => {
                connected = true;
                console.log('[DiceDeck] Connected to Streamer.bot at 127.0.0.1', port);
            })
            .catch(() => {
                // 3. Try localStorage
                const storedAddress = localStorage.getItem('sbServerAddress');
                if (storedAddress) {
                    connectPromise = setupStreamerBot(storedAddress, port)
                        .then(() => {
                            connected = true;
                            console.log('[DiceDeck] Connected to Streamer.bot at', storedAddress, port);
                        })
                        .catch(() => {
                            // 4. If fails, run LAN scan
                            // This part of the logic is now handled by lan-scan.js
                            console.log('[DiceDeck] No stored address, running LAN scan for Streamer.bot.');
                            // The actual LAN scan logic is now in lan-scan.js
                        });
                } else {
                    // 4. No stored address, run LAN scan
                    // This part of the logic is now handled by lan-scan.js
                    console.log('[DiceDeck] No stored address, running LAN scan for Streamer.bot.');
                }
            });
    }
    // --- Ensure availableActions is always populated if possible ---
    // (Removed: now handled in setupStreamerBot)
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

// Function to import layout from JSON (array of {action_id, title})
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

// Utility: Normalize button positions so min row/col is 0, and fill from top-left
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
// Utility: Check for gaps in first row/col and show a warning
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

// Utility: sanitize string for DOM insertion (basic)
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, function (c) {
        return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]);
    });
}

// Sanitize all imported button fields
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