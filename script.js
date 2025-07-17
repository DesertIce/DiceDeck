// Utility to fetch JSON data
async function fetchGridData() {
    const res = await fetch('data.json');
    return await res.json();
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

function renderGrid({ rows, cols, buttons }) {
    const grid = document.getElementById('grid-container');
    grid.innerHTML = '';
    grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

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
            const el = document.createElement('button');
            el.className = 'grid-button';
            el.dataset.row = r;
            el.dataset.col = c;
            if (btn) {
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
                        if (window.sbClient && window.sbClient.socket.readyState === 1) {
                            try {
                                await window.sbClient.doAction({ name: btn.action });
                            } catch (err) {
                                alert('Failed to trigger action: ' + btn.action);
                            }
                        }
                    };
                    el.ontouchend = el.onclick;
                }
            } else if (editMode) {
                // Empty cell in edit mode: allow add button and allow drop
                el.classList.add('empty-cell');
                el.textContent = '+';
                el.onclick = () => openAddButtonModal(r, c);
                el.ondragover = handleDragOver;
                el.ondrop = handleDrop;
                el.ondragleave = handleDragLeave;
            } else {
                el.disabled = true;
                el.style.visibility = 'hidden';
            }
            grid.appendChild(el);
        }
    }
    // Re-render Iconify icons
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
        const dataStr = JSON.stringify(gridData, null, 2);
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

function setupStreamerBot() {
    if (!window.StreamerbotClient) {
        SetConnectionStatus(false);
        return;
    }
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const sbServerAddress = urlParams.get("address") || "127.0.0.1";
    const sbServerPort = urlParams.get("port") || "8080";

    const client = new window.StreamerbotClient({
        host: sbServerAddress,
        port: sbServerPort,
        onConnect: (data) => {
            console.log(`Streamer.bot successfully connected to ${sbServerAddress}:${sbServerPort}`);
            console.debug(data);
            SetConnectionStatus(true);
        },
        onDisconnect: () => {
            console.error(`Streamer.bot disconnected from ${sbServerAddress}:${sbServerPort}`);
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
            opt.value = a.name;
            opt.textContent = a.name;
            if (a.name === btn.action) opt.selected = true;
            actionSelect.appendChild(opt);
        });
    } else {
        const opt = document.createElement('option');
        opt.value = btn.action;
        opt.textContent = btn.action;
        opt.selected = true;
        actionSelect.appendChild(opt);
    }
    // Save handler
    modal.querySelector('#edit-save').onclick = () => {
        btn.title = modal.querySelector('#edit-title').value;
        btn.icon = modal.querySelector('#edit-icon').value.trim() || undefined;
        btn.action = actionSelect.value;
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
            opt.value = a.name;
            opt.textContent = a.name;
            actionSelect.appendChild(opt);
        });
    }
    // Save handler
    modal.querySelector('#add-save').onclick = () => {
        const title = modal.querySelector('#add-title').value;
        const icon = modal.querySelector('#add-icon').value.trim() || undefined;
        const action = actionSelect.value;
        gridData.buttons.push({ row, col, title, icon, action });
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

function animatePolygonalMesh() {
    const svg = document.getElementById('bg-mesh');
    if (!svg) return;
    const w = window.innerWidth * 1.12;
    const h = window.innerHeight * 1.12;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.innerHTML = '';

    // Mesh parameters
    const rows = 13;
    const cols = 22;
    const points = [];
    const time = Date.now() / 4000;
    const meshRadius = 110;
    // Generate points with slow morphing
    for (let y = 0; y <= rows; y++) {
        for (let x = 0; x <= cols; x++) {
            const px = (w / cols) * x;
            const py = (h / rows) * y;
            // Animate with sin/cos for organic movement
            const dx = Math.sin(time + x * 0.7 + y * 0.3) * meshRadius * Math.sin(time + y * 0.5 + x * 0.2);
            const dy = Math.cos(time + y * 0.6 + x * 0.4) * meshRadius * Math.cos(time + x * 0.3 + y * 0.2);
            points.push({ x: px + dx, y: py + dy });
        }
    }
    // Draw wireframe polygons (edges only)
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const idx = y * (cols + 1) + x;
            const p1 = points[idx];
            const p2 = points[idx + 1];
            const p3 = points[idx + cols + 2];
            const p4 = points[idx + cols + 1];
            // Draw lines for each edge
            drawLine(svg, p1, p2);
            drawLine(svg, p2, p3);
            drawLine(svg, p3, p4);
            drawLine(svg, p4, p1);
        }
    }
    requestAnimationFrame(animatePolygonalMesh);
}
function drawLine(svg, p1, p2) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    line.setAttribute('stroke', '#00ffff');
    line.setAttribute('stroke-width', '1.2');
    line.setAttribute('opacity', '0.35');
    svg.appendChild(line);
}

function animateGridBlur() {
    const grid = document.getElementById('grid-container');
    if (!grid) return;
    const t = Date.now() / 3000;
    const blur = 10 + Math.abs(Math.sin(t)) * 18; // 10px to 28px
    grid.style.backdropFilter = `blur(${blur}px) saturate(1.1)`;
    grid.style.webkitBackdropFilter = `blur(${blur}px) saturate(1.1)`;
    requestAnimationFrame(animateGridBlur);
}

window.addEventListener('DOMContentLoaded', async () => {
    SetConnectionStatus(false);
    try {
        gridData = await fetchGridData();
        renderGrid(gridData);
    } catch (e) {
        const bar = document.getElementById('status-text');
        bar.textContent = 'Failed to load grid data';
        return;
    }
    setupEditModeToggle();
    setupStreamerBot();
    animatePolygonalMesh();
    animateGridBlur();
});
