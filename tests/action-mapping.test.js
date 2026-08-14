const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadActionMappingHelpers() {
    class FakeElement {
        constructor(tagName = 'div') {
            this.tagName = tagName.toUpperCase();
            this.children = [];
            this.dataset = {};
            this.attributes = {};
            this.listeners = {};
            this.style = { setProperty() {} };
            this._classes = new Set();
            this._innerHTML = '';
            this.classList = {
                add: (...names) => names.forEach(name => this._classes.add(name)),
                remove: (...names) => names.forEach(name => this._classes.delete(name)),
                toggle: (name, force) => {
                    if (force === true) this._classes.add(name);
                    else if (force === false) this._classes.delete(name);
                    else if (this._classes.has(name)) this._classes.delete(name);
                    else this._classes.add(name);
                },
                contains: name => this._classes.has(name),
            };
        }

        get className() { return [...this._classes].join(' '); }
        set className(value) { this._classes = new Set(value.split(/\s+/).filter(Boolean)); }
        get innerHTML() { return this._innerHTML; }
        set innerHTML(value) {
            this._innerHTML = value;
            if (value === '') this.children = [];
        }

        appendChild(child) {
            this.children.push(child);
            return child;
        }

        setAttribute(name, value) { this.attributes[name] = String(value); }
        getAttribute(name) { return this.attributes[name] ?? null; }
        removeAttribute(name) { delete this.attributes[name]; }
        addEventListener(type, listener) {
            (this.listeners[type] ||= []).push(listener);
        }
    }

    const elements = new Map([
        ['grid-container', new FakeElement('div')],
        ['save-layout', new FakeElement('button')],
    ]);
    const document = {
        hidden: false,
        body: { classList: { add() {} } },
        documentElement: { addEventListener() {} },
        addEventListener() {},
        createElement(tagName) { return new FakeElement(tagName); },
        getElementById(id) { return elements.get(id) || null; },
    };
    const window = {
        location: { search: '' },
        addEventListener() {},
    };
    const context = vm.createContext({
        window,
        document,
        navigator: {},
        console: { log() {}, warn() {}, error() {} },
        URLSearchParams,
        setTimeout,
        clearTimeout,
        requestAnimationFrame() {},
        alert() {},
        module: { exports: {} },
    });
    const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
    vm.runInContext(`${source}\nmodule.exports = {
        getActionMappingState: typeof getActionMappingState === 'function'
            ? getActionMappingState
            : undefined,
        renderGrid,
        appState,
        refreshActionCatalog: typeof refreshActionCatalog === 'function'
            ? refreshActionCatalog
            : undefined,
        populateEditActionSelect: typeof populateEditActionSelect === 'function'
            ? populateEditActionSelect
            : undefined,
        applySelectedAction: typeof applySelectedAction === 'function'
            ? applySelectedAction
            : undefined,
    };`, context);
    return { ...context.module.exports, document, elements, window };
}

test('reports mapping validity only when the action catalog is authoritative', () => {
    const { getActionMappingState } = loadActionMappingHelpers();
    const availableIds = new Set(['valid-action']);

    assert.equal(getActionMappingState?.('missing-action', false, availableIds), 'unknown');
    assert.equal(getActionMappingState?.('valid-action', true, availableIds), 'valid');
    assert.equal(getActionMappingState?.('missing-action', true, availableIds), 'missing');
    assert.equal(getActionMappingState?.('', true, availableIds), 'missing');
});

test('marks a confirmed missing action on the rendered button', () => {
    const runtime = loadActionMappingHelpers();
    runtime.appState.actionCatalogReady = true;
    runtime.appState.availableActions = [{ id: 'valid-action', name: 'Valid Action' }];

    runtime.renderGrid({
        rows: 1,
        cols: 2,
        buttons: [
            { row: 0, col: 0, title: 'Missing Button', action_id: 'missing-action' },
            { row: 0, col: 1, title: 'Valid Button', action_id: 'valid-action' },
        ],
    });

    const [missingButton, validButton] = runtime.elements.get('grid-container').children;
    assert.equal(missingButton.dataset.actionState, 'missing');
    assert.equal(missingButton.getAttribute('aria-disabled'), 'true');
    assert.match(missingButton.getAttribute('aria-label'), /Missing Button.*action unavailable/i);
    assert.equal(missingButton.children[0].className, 'action-missing-badge');
    assert.equal(missingButton.children[0].textContent, '!');
    assert.equal(validButton.dataset.actionState, 'valid');
    assert.equal(validButton.getAttribute('aria-disabled'), null);
});

test('does not execute a confirmed missing action', () => {
    const runtime = loadActionMappingHelpers();
    const executedActions = [];
    runtime.window.sbClient = {
        doAction(actionId) {
            executedActions.push(actionId);
            return Promise.resolve();
        },
    };
    runtime.appState.actionCatalogReady = true;
    runtime.appState.availableActions = [{ id: 'valid-action', name: 'Valid Action' }];

    runtime.renderGrid({
        rows: 1,
        cols: 2,
        buttons: [
            { row: 0, col: 0, title: 'Missing Button', action_id: 'missing-action' },
            { row: 0, col: 1, title: 'Valid Button', action_id: 'valid-action' },
        ],
    });

    const [missingButton, validButton] = runtime.elements.get('grid-container').children;
    const click = element => element.listeners.click[0]({
        type: 'click',
        target: element,
        currentTarget: element,
        preventDefault() {},
    });
    click(missingButton);
    click(validButton);

    assert.deepEqual(executedActions, ['valid-action']);
});

test('does not middle-click a confirmed missing action in edit mode', () => {
    const runtime = loadActionMappingHelpers();
    const executedActions = [];
    runtime.window.sbClient = {
        doAction(actionId) {
            executedActions.push(actionId);
            return Promise.resolve();
        },
    };
    runtime.appState.editMode = true;
    runtime.appState.actionCatalogReady = true;
    runtime.appState.availableActions = [{ id: 'valid-action', name: 'Valid Action' }];

    runtime.renderGrid({
        rows: 1,
        cols: 2,
        buttons: [
            { row: 0, col: 0, title: 'Missing Button', action_id: 'missing-action' },
            { row: 0, col: 1, title: 'Valid Button', action_id: 'valid-action' },
        ],
    });

    const [missingButton, validButton] = runtime.elements.get('grid-container').children;
    missingButton.onmousedown({ button: 1, preventDefault() {} });
    validButton.onmousedown({ button: 1, preventDefault() {} });

    assert.deepEqual(executedActions, ['valid-action']);
});

test('makes a successfully refreshed action catalog authoritative', async () => {
    const runtime = loadActionMappingHelpers();
    const actions = [{ id: 'action-1', name: 'Action One' }];

    await runtime.refreshActionCatalog?.({
        async getActions() { return { status: 'ok', actions }; },
    });

    assert.equal(runtime.appState.actionCatalogReady, true);
    assert.equal(runtime.appState.availableActions, actions);
});

test('makes action validity unknown when a catalog refresh fails', async () => {
    const runtime = loadActionMappingHelpers();
    runtime.appState.actionCatalogReady = true;
    runtime.appState.availableActions = [{ id: 'stale-action', name: 'Stale Action' }];

    const refreshed = await runtime.refreshActionCatalog?.({
        async getActions() { throw new Error('offline'); },
    });

    assert.equal(refreshed, false);
    assert.equal(runtime.appState.actionCatalogReady, false);
    assert.equal(runtime.appState.availableActions.length, 0);
});

test('preserves a missing action as the selected edit option', () => {
    const runtime = loadActionMappingHelpers();
    runtime.appState.actionCatalogReady = true;
    runtime.appState.availableActions = [{ id: 'valid-action', name: 'Valid Action' }];
    const select = runtime.document.createElement('select');

    const isMissing = runtime.populateEditActionSelect?.(select, {
        title: 'Missing Button',
        action_id: 'missing-action',
    });

    assert.equal(isMissing, true);
    assert.equal(select.children[0].value, 'missing-action');
    assert.equal(select.children[0].selected, true);
    assert.match(select.children[0].textContent, /missing action/i);
    assert.equal(select.children[1].value, 'valid-action');
    assert.equal(select.children[1].selected, false);
});

test('preserves an unresolved legacy action name when saving without a replacement', () => {
    const runtime = loadActionMappingHelpers();
    runtime.appState.actionCatalogReady = true;
    runtime.appState.availableActions = [{ id: 'valid-action', name: 'Valid Action' }];
    const button = { title: 'Legacy Button', action: 'Deleted Legacy Action', action_id: '' };
    const select = runtime.document.createElement('select');
    runtime.populateEditActionSelect(select, button);
    select.value = select.children[0].value;
    select.selectedOptions = [select.children[0]];

    runtime.applySelectedAction?.(button, select);

    assert.equal(button.action_id, '');
    assert.equal(button.action, 'Deleted Legacy Action');
    assert.match(select.children[0].textContent, /Deleted Legacy Action/);
});
