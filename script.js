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
                        if (window.sbClient && window.sbClient.isConnected) {
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
    let gridSettingsBtn = document.getElementById('grid-settings-btn');
    if (!gridSettingsBtn) {
        gridSettingsBtn = document.createElement('button');
        gridSettingsBtn.textContent = 'Grid';
        gridSettingsBtn.className = 'edit-btn-floating';
        gridSettingsBtn.id = 'grid-settings-btn';
        gridSettingsBtn.onclick = openGridSettingsModal;
        editBtn.parentNode.insertBefore(gridSettingsBtn, saveBtn);
    }
    gridSettingsBtn.classList.remove('edit-visible');
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
        if (editMode) {
            gridSettingsBtn.classList.add('edit-visible');
        } else {
            gridSettingsBtn.classList.remove('edit-visible');
        }
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
    // Ensure grid settings button is hidden on load
    gridSettingsBtn.classList.remove('edit-visible');
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
    const w = window.innerWidth;
    const h = window.innerHeight;
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.innerHTML = '';

    // Mesh parameters
    const rows = 7;
    const cols = 12;
    const points = [];
    const time = Date.now() / 4000;
    const meshRadius = 60;
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
