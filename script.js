// Utility to fetch JSON data
async function fetchGridData() {
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

let gridData = null;
let editMode = false;
let availableActions = [];

// Utility to map action_id to action name
function getActionNameById(action_id) {
    if (!availableActions || !Array.isArray(availableActions)) return '';
    const found = availableActions.find(a => a.id === action_id);
    return found ? found.name : '';
}
// Utility to map action name to action_id
function getActionIdByName(action_name) {
    if (!availableActions || !Array.isArray(availableActions)) return '';
    const found = availableActions.find(a => a.name === action_name);
    return found ? found.id : '';
}

function renderGrid({ rows, cols, buttons, gap, blurMin, blurMax }) {
    const grid = document.getElementById('grid-container');
    grid.innerHTML = '';
    // Set CSS variables for grid sizing
    grid.style.setProperty('--grid-rows', rows);
    grid.style.setProperty('--grid-cols', cols);
    grid.style.gap = (gap !== undefined ? gap : 16) + 'px';
    gridBlurMin = (blurMin !== undefined ? blurMin : 4);
    gridBlurMax = (blurMax !== undefined ? blurMax : 12);

    // Add grid settings button in edit mode
    if (editMode) {
        let gridSettingsBtn = document.createElement('button');
        gridSettingsBtn.id = 'grid-settings-btn';
        gridSettingsBtn.className = 'grid-settings-fab';
        gridSettingsBtn.title = 'Set grid rows/columns';
        gridSettingsBtn.innerHTML = '<span class="iconify" data-icon="ic:outline-grid-on"></span>';
        gridSettingsBtn.onclick = openGridSettingsModal;
        grid.appendChild(gridSettingsBtn);
        if (window.Iconify) window.Iconify.scan(gridSettingsBtn);
    }

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
                el.innerHTML = '';
                if (btn.icon) {
                    el.innerHTML += `<span class="button-icon iconify" data-icon="${btn.icon}"></span>`;
                }
                el.innerHTML += `<span class="button-title">${btn.title}</span>`;
                if (editMode) {
                    el.setAttribute('draggable', 'true');
                    el.ondragstart = handleDragStart;
                    el.ondragover = handleDragOver;
                    el.ondrop = handleDrop;
                    el.ondragend = handleDragEnd;
                    el.ondragleave = handleDragLeave;
                    el.onclick = (e) => {
                        e.preventDefault();
                        openEditModal(btn.idx);
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
                        if (window.sbClient && window.sbClient.socket.readyState === 1 && actionName) {
                            try {
                                await window.sbClient.doAction({ name: actionName });
                            } catch (err) {
                                alert('Failed to trigger action: ' + actionName);
                            }
                        }
                    };
                    el.ontouchend = el.onclick;
                }
                grid.appendChild(el);
            } else if (editMode) {
                // In edit mode, show faded outline for empty cells
                const empty = document.createElement('div');
                empty.className = 'empty-cell';
                empty.dataset.row = r;
                empty.dataset.col = c;
                empty.onclick = () => openAddButtonModal(r, c);
                empty.ondragover = handleDragOver;
                empty.ondrop = handleDrop;
                empty.ondragleave = handleDragLeave;
                grid.appendChild(empty);
            }
            // In normal mode, do not render anything for empty cells
        }
    }
    if (window.Iconify) {
        window.Iconify.scan(grid);
    }
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
    if (dragSrcIdx !== null) {
        if (typeof targetIdx !== 'undefined') {
            // Swap with another button
            if (dragSrcIdx !== targetIdx) {
                const temp = { ...gridData.buttons[dragSrcIdx] };
                gridData.buttons[dragSrcIdx].row = gridData.buttons[targetIdx].row;
                gridData.buttons[dragSrcIdx].col = gridData.buttons[targetIdx].col;
                gridData.buttons[targetIdx].row = temp.row;
                gridData.buttons[targetIdx].col = temp.col;
                renderGrid(gridData);
                document.getElementById('save-layout').style.display = 'inline-block';
            }
        } else {
            // Move to empty cell
            gridData.buttons[dragSrcIdx].row = targetRow;
            gridData.buttons[dragSrcIdx].col = targetCol;
            renderGrid(gridData);
            document.getElementById('save-layout').style.display = 'inline-block';
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
    let gridSettingsInline = document.getElementById('grid-settings-inline');
    function updateInlineSettings() {
        if (editMode) {
            document.body.classList.add('edit-mode');
            if (!gridSettingsInline) {
                gridSettingsInline = document.createElement('span');
                gridSettingsInline.id = 'grid-settings-inline';
                gridSettingsInline.style.display = 'flex';
                gridSettingsInline.style.alignItems = 'center';
                gridSettingsInline.style.gap = '8px';
                gridSettingsInline.innerHTML = `
                    <label style="color:#b0eaff;font-size:0.98em;">Rows <input id="inline-edit-rows" type="number" min="1" max="20" value="${gridData.rows}" class="inline-grid-input" /></label>
                    <label style="color:#b0eaff;font-size:0.98em;">Cols <input id="inline-edit-cols" type="number" min="1" max="20" value="${gridData.cols}" class="inline-grid-input" /></label>
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
                    gridData.rows = newRows;
                    gridData.cols = newCols;
                    renderGrid(gridData);
                    saveBtn.style.display = 'inline-block';
                };
                validate();
            } else {
                document.getElementById('inline-edit-rows').value = gridData.rows;
                document.getElementById('inline-edit-cols').value = gridData.cols;
                gridSettingsInline.style.display = 'flex';
            }
        } else if (gridSettingsInline) {
            document.body.classList.remove('edit-mode');
            gridSettingsInline.style.display = 'none';
        }
    }
    editBtn.onclick = async () => {
        editMode = !editMode;
        editBtn.textContent = editMode ? 'Exit Edit Mode' : 'Edit Mode';
        saveBtn.style.display = 'none';
        if (editMode && window.sbClient && window.sbClient.getActions) {
            try {
                const response = await window.sbClient.getActions();
                if (response && response.status === 'ok' && Array.isArray(response.actions)) {
                    availableActions = response.actions;
                }
            } catch (e) {
                availableActions = [];
            }
        }
        updateInlineSettings();
        renderGrid(gridData);
    };
    saveBtn.onclick = () => {
        // Download the new layout as data.json
        const exportData = {
            ...gridData,
            buttons: gridData.buttons.map(btn => ({
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
        saveBtn.style.display = 'none';
    };
    updateInlineSettings();
}

// --- Streamer.bot LAN Discovery Overlay and Logic ---
function showDiscoveryOverlay(message, progress = 0, showBtns = false, onConfirm = null, onReject = null) {
    let overlay = document.getElementById('sb-discovery-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sb-discovery-overlay';
        overlay.innerHTML = `
            <div class="sb-discovery-box">
                <div class="sb-discovery-message"></div>
                <div class="sb-discovery-progress"><div class="sb-discovery-bar" style="width:0%"></div></div>
                <div class="sb-discovery-btns" style="display:none;">
                    <button class="sb-discovery-confirm">Yes</button>
                    <button class="sb-discovery-reject">No</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    const msg = overlay.querySelector('.sb-discovery-message');
    const bar = overlay.querySelector('.sb-discovery-bar');
    const btns = overlay.querySelector('.sb-discovery-btns');
    msg.innerHTML = message;
    bar.style.width = (progress * 100) + '%';
    if (showBtns) {
        btns.style.display = 'flex';
        const confirmBtn = overlay.querySelector('.sb-discovery-confirm');
        const rejectBtn = overlay.querySelector('.sb-discovery-reject');
        confirmBtn.onclick = () => { if (onConfirm) onConfirm(); hideDiscoveryOverlay(); };
        rejectBtn.onclick = () => { if (onReject) onReject(); hideDiscoveryOverlay(); };
    } else {
        btns.style.display = 'none';
    }
}
function hideDiscoveryOverlay() {
    const overlay = document.getElementById('sb-discovery-overlay');
    if (overlay) overlay.remove();
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
                onConnect: async (info) => {
                    clearTimeout(timer);
                    if (!resolved) {
                        resolved = true;
                        if (client && client.disconnect) client.disconnect();
                        resolve(info);
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
        } catch (e) {
            clearTimeout(timer);
            if (!resolved) {
                resolved = true;
                reject({ reason: e && e.message ? e.message : 'exception', host, port });
            }
        }
    });
}

function resolveHostToIP(host, port, callback) {
    // Try to fetch with port (HEAD)
    fetch(`http://${host}:${port}/`, { method: 'HEAD', mode: 'no-cors' })
        .then(() => callback(host))
        .catch(() => {
            // Try to fetch without port (HEAD)
            fetch(`http://${host}/`, { method: 'HEAD', mode: 'no-cors' })
                .then(() => callback(host))
                .catch(() => {
                    // Try to fetch with port (GET)
                    fetch(`http://${host}:${port}/`, { method: 'GET', mode: 'no-cors' })
                        .then(() => callback(host))
                        .catch(() => {
                            // Try to fetch without port (GET)
                            fetch(`http://${host}/`, { method: 'GET', mode: 'no-cors' })
                                .then(() => callback(host))
                                .catch(() => callback(null));
                        });
                });
        });
}

// --- Parallel LAN Discovery with Web Workers ---
// --- Query Param Helpers ---
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// --- Adaptive Mesh Complexity ---
let meshRows = 13, meshCols = 22;
if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) { meshRows = 7; meshCols = 12; }
if (navigator.deviceMemory && navigator.deviceMemory <= 4) { meshRows = 7; meshCols = 12; }
const noAnim = getQueryParam('noanim') !== null;

// --- Adaptive LAN Scan Concurrency ---
let SB_DISCOVERY_WORKER_COUNT = 5;
let MAX_CONCURRENT_PROBES = 20;
const qpConcurrency = parseInt(getQueryParam('concurrency'), 10);
const qpWorkers = parseInt(getQueryParam('workers'), 10);
const qpProbes = parseInt(getQueryParam('probes'), 10);
if (!isNaN(qpConcurrency) && qpConcurrency > 0) {
    // Try to split evenly between workers/probes
    SB_DISCOVERY_WORKER_COUNT = Math.max(1, Math.floor(Math.sqrt(qpConcurrency)));
    MAX_CONCURRENT_PROBES = Math.max(1, Math.ceil(qpConcurrency / SB_DISCOVERY_WORKER_COUNT));
}
if (!isNaN(qpWorkers) && qpWorkers > 0) SB_DISCOVERY_WORKER_COUNT = qpWorkers;
if (!isNaN(qpProbes) && qpProbes > 0) MAX_CONCURRENT_PROBES = qpProbes;

// Patch global for worker
window.SB_DISCOVERY_WORKER_COUNT = SB_DISCOVERY_WORKER_COUNT;
window.MAX_CONCURRENT_PROBES = MAX_CONCURRENT_PROBES;

// --- Patch worker creation to use adaptive concurrency ---
const SB_DISCOVERY_WORKER_URL = 'sb-discovery-worker.js';
// SB_DISCOVERY_WORKER_COUNT is now set above

async function discoverStreamerBotOnLAN() {
    // Scan most common residential subnets first, then the rest
    const subnets = [];
    // 1. Most common: 192.168.1.x
    subnets.push('192.168.1');
    // 2. Next most common: 192.168.0.x
    subnets.push('192.168.0');
    // 3. Also common: 10.0.0.x
    subnets.push('10.0.0');
    // 4. All other 192.168.x.x (excluding .0 and .1)
    for (let i = 2; i <= 255; i++) {
        subnets.push(`192.168.${i}`);
    }
    // 5. 172.16.x.x through 172.31.x.x
    for (let i = 16; i <= 31; i++) {
        subnets.push(`172.${i}.0`);
    }
    const port = '8080';
    const hosts = [];
    for (const subnet of subnets) {
        for (let i = 1; i <= 254; i++) {
            hosts.push(`${subnet}.${i}`);
        }
    }
    // Add 78 dummy (but valid) IPs for the lulz (using 192.0.2.x TEST-NET-1)
    for (let i = 1; i <= 78; i++) {
        hosts.push(`192.0.2.${i}`);
    }
    // Split hosts into chunks for workers
    const chunkSize = Math.ceil(hosts.length / SB_DISCOVERY_WORKER_COUNT);
    let found = false;
    let completedWorkers = 0;
    let totalProbed = 0;
    let totalToProbe = hosts.length;
    let workers = [];
    function stopAllWorkers() {
        workers.forEach(w => w.terminate());
        workers = [];
    }
    const discoveryNote = '<br><small style="color:#aaa">Note: You may see many connection errors in your browser console during scanning. This is normal and expected.<br><br>Tip: Discovery is only needed if the server IP address changes or is lost. If you already know the IP and port of your Streamer.bot server, you can skip scanning by adding them to the URL as query parameters.<br>For example: <code>?address=192.168.1.100&port=8080</code></small>';
    showDiscoveryOverlay('Scanning LAN for Streamer.bot...' + discoveryNote, 0);
    const workerDelay = 200; // ms delay between worker spawns
    for (let w = 0; w < SB_DISCOVERY_WORKER_COUNT; w++) {
        setTimeout(() => {
            const chunk = hosts.slice(w * chunkSize, (w + 1) * chunkSize);
            if (chunk.length === 0) return;
            const worker = new Worker(SB_DISCOVERY_WORKER_URL);
            workers.push(worker);
            worker.postMessage({ ips: chunk, port });
            worker.onmessage = async (e) => {
                if (e.data.log) {
                    console.log(`[LANScan] ${e.data.log}`);
                }
                if (found) return;
                if (e.data.progress) {
                    totalProbed += e.data.progress;
                    showDiscoveryOverlay(`Scanning LAN for Streamer.bot... (${totalProbed}/${totalToProbe})` + discoveryNote, totalProbed / totalToProbe);
                }
                if (e.data.ip) {
                    // Escalate to StreamerbotClient handshake
                    const isTargetIP = e.data.ip === '192.168.50.32';
                    if (isTargetIP) {
                        console.info(`[LANScan][DETAIL] Attempting handshake with ${e.data.ip}:${port}`);
                    }
                    try {
                        const info = await tryStreamerbotClientConnect(e.data.ip, port, 1200);
                        if (isTargetIP) {
                            console.info(`[LANScan][DETAIL] Handshake success for ${e.data.ip}:${port}`);
                            console.info(`[LANScan][DETAIL] Handshake info:`, info);
                        }
                        found = true;
                        stopAllWorkers();
                        showDiscoveryOverlay(`Found Streamer.bot at ${e.data.ip}:${port}. Connect?`, 1, true,
                            () => {
                                localStorage.setItem('sbServerAddress', e.data.ip);
                                localStorage.setItem('sbServerPort', port);
                                hideDiscoveryOverlay();
                                setupStreamerBot(e.data.ip, port);
                            },
                            () => {
                                found = false;
                                discoverStreamerBotOnLAN();
                            }
                        );
                    } catch (err) {
                        // Not a valid Streamer.bot instance, keep going
                        if (err && err.host && err.port && err.reason) {
                            if (isTargetIP) {
                                console.warn(`[LANScan][DETAIL] Failed to connect to ${err.host}:${err.port} - ${err.reason}`);
                                if (err && err.stack) {
                                    console.warn(`[LANScan][DETAIL] Stack:`, err.stack);
                                }
                            } else {
                                // Only log disconnects and errors for other IPs
                                if (err.reason !== 'timeout' && !"Timeout" in err.toString()) {
                                    console.warn(`[LANScan] Failed to connect to ${err.host}:${err.port} - ${err.reason}`);
                                }
                            }
                        }
                    }
                }
                if (e.data.done) {
                    completedWorkers++;
                    // Do not increment totalProbed here, as it's now updated per-IP
                    if (completedWorkers === workers.length && !found) {
                        showDiscoveryOverlay('No Streamer.bot server found on your LAN. Please check your network or enter the address manually.', 1, false);
                        setTimeout(hideDiscoveryOverlay, 4000);
                    }
                }
            };
        }, w * workerDelay);
    }
}

// Patch setupStreamerBot to accept address/port
function setupStreamerBot(address, port) {
    if (!window.StreamerbotClient) {
        SetConnectionStatus(false);
        return;
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
    const client = new window.StreamerbotClient({
        host: address,
        port: port,
        onConnect: async (info) => {
            console.log(`Streamer.bot successfully connected to ${address}:${port}`);
            console.debug(info);
            SetConnectionStatus(true);
            // Fetch available actions immediately after connection
            if (client.getActions) {
                try {
                    const response = await client.getActions();
                    if (response && response.status === 'ok' && Array.isArray(response.actions)) {
                        availableActions = response.actions;
                    }
                } catch (e) {
                    availableActions = [];
                }
            }
            // Confirm instanceId if previously stored
            if (storedInstanceId) {
                try {
                    let hostInfo = info;
                    if (client.getHostInfo) {
                        hostInfo = await client.getHostInfo();
                    }
                    if (hostInfo && hostInfo.instanceId === storedInstanceId) {
                        console.log(`[DiceDeck] Confirmed reconnection to previously confirmed Streamer.bot instance: ${hostInfo.instanceId}`);
                    } else {
                        console.warn(`[DiceDeck] Connected to a different Streamer.bot instance! Expected: ${storedInstanceId}, Got: ${hostInfo && hostInfo.instanceId}`);
                        showDiscoveryOverlay(
                            `Connected to a different Streamer.bot instance:<br><b>${hostInfo && hostInfo.name}</b><br>ID: <code>${hostInfo && hostInfo.instanceId}</code><br><br>Do you want to accept this new instance?`,
                            1, true,
                            () => {
                                localStorage.setItem('sbInstanceId', hostInfo.instanceId);
                                localStorage.setItem('sbServerAddress', address);
                                localStorage.setItem('sbServerPort', port);
                                hideDiscoveryOverlay();
                                console.log('[DiceDeck] User accepted new Streamer.bot instance.');
                            },
                            () => {
                                hideDiscoveryOverlay();
                                discoverStreamerBotOnLAN();
                            }
                        );
                    }
                } catch (e) {
                    console.warn('[DiceDeck] Could not confirm Streamer.bot instanceId after reconnect.', e);
                }
            }
        },
        onDisconnect: () => {
            console.error(`Streamer.bot disconnected from ${address}:${port}`);
            SetConnectionStatus(false);
        }
    });
    window.sbClient = client;
}

function openEditModal(idx) {
    const btn = gridData.buttons[idx];
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
        <input id="edit-title" type="text" value="${btn.title}" />
        <label for="edit-icon">Icon Name (e.g. ic:outline-question-mark)</label>
        <input id="edit-icon" type="text" value="${btn.icon || ''}" placeholder="Optional iconify name" />
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
    if (availableActions && availableActions.length > 0) {
        availableActions.forEach(a => {
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
        renderGrid(gridData);
        document.getElementById('save-layout').style.display = 'inline-block';
    };
    // Remove handler
    modal.querySelector('.remove-btn').onclick = () => {
        gridData.buttons.splice(idx, 1);
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        renderGrid(gridData);
        document.getElementById('save-layout').style.display = 'inline-block';
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
    if (availableActions && availableActions.length > 0) {
        availableActions.forEach(a => {
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
        gridData.buttons.push({ row, col, title, icon, action_id });
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        renderGrid(gridData);
        document.getElementById('save-layout').style.display = 'inline-block';
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
            <input id="edit-rows" type="number" min="1" max="20" value="${gridData.rows}" style="width:60px;" />
            <label for="edit-cols">Columns</label>
            <input id="edit-cols" type="number" min="1" max="20" value="${gridData.cols}" style="width:60px;" />
        </div>
        <div class="modal-actions">
            <button id="grid-save">Save</button>
            <button id="grid-cancel">Cancel</button>
        </div>
    `;
    modal.querySelector('#grid-save').onclick = () => {
        const newRows = parseInt(modal.querySelector('#edit-rows').value, 10);
        const newCols = parseInt(modal.querySelector('#edit-cols').value, 10);
        gridData.rows = newRows;
        gridData.cols = newCols;
        document.body.removeChild(backdrop);
        document.body.removeChild(modal);
        renderGrid(gridData);
        document.getElementById('save-layout').style.display = 'inline-block';
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
    if (!svg) return;
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

let gridBlurMin = 4;
let gridBlurMax = 12;

function animateGridBlur() {
    if (noAnim) return;
    const grid = document.getElementById('grid-container');
    if (!grid) return;
    const t = Date.now() / 3000;
    const blur = gridBlurMin + Math.abs(Math.sin(t)) * (gridBlurMax - gridBlurMin);
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
        gridData = await fetchGridData();
        renderGrid(gridData);
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
    if (address) {
        try {
            await tryStreamerbotClientConnect(address, port, 1200);
            setupStreamerBot(address, port);
            connected = true;
        } catch {
            // Fail fast: do not run LAN scan
            SetConnectionStatus(false);
            const bar = document.getElementById('status-text');
            bar.textContent = `Failed to connect to Streamer.bot at ${address}:${port}`;
        }
    } else if (host) {
        try {
            await tryStreamerbotClientConnect(host, port, 1200);
            setupStreamerBot(host, port);
            connected = true;
        } catch {
            SetConnectionStatus(false);
            const bar = document.getElementById('status-text');
            bar.textContent = `Failed to connect to Streamer.bot at ${host}:${port}`;
        }
    } else {
        // No address/host in query params, check localStorage
        const storedAddress = localStorage.getItem('sbServerAddress');
        if (storedAddress) {
            try {
                await tryStreamerbotClientConnect(storedAddress, port, 1200);
                setupStreamerBot(storedAddress, port);
                connected = true;
            } catch {
                // If fails, run LAN scan
                discoverStreamerBotOnLAN();
            }
        } else {
            // No stored address, run LAN scan
            discoverStreamerBotOnLAN();
        }
    }
    animatePolygonalMesh();
    animateGridBlur();
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
            if (gridData) {
                gridData.rows = sortedRows.length;
                gridData.cols = sortedCols.length;
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
            alert('Could not find any buttons to import in the provided JSON.');
            return;
        }
        // Validate all have action_id and title
        const valid = importButtons.every(item => item.action_id && item.title);
        if (!valid) {
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
    // Replace current gridData.buttons with imported layout
    if (!gridData) return;
    // Keep grid size, replace buttons
    gridData.buttons = layoutArray.map(item => ({
        row: item.row ?? 0,
        col: item.col ?? 0,
        title: item.title,
        icon: item.icon,
        action_id: item.action_id
    }));
    renderGrid(gridData);
    document.getElementById('save-layout').style.display = 'inline-block';
}