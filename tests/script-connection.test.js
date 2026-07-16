const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { initializeDiceDeckClient } = require('../connection-supervisor');

function createElement() {
    return {
        classList: { add() {}, remove() {}, toggle() {} },
        style: {},
        textContent: '',
        addEventListener() {},
    };
}

function loadScript({
    search = '',
    StreamerbotClient,
    ConnectionSupervisor,
} = {}) {
    const elements = new Map();
    const document = {
        hidden: false,
        body: { classList: { add() {} } },
        addEventListener() {},
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        },
    };
    const window = {
        location: { search },
        StreamerbotClient,
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
        ConnectionSupervisor,
        initializeDiceDeckClient,
        module: { exports: {} },
    });
    const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
    vm.runInContext(`${source}\nmodule.exports = {
        DirectStreamerBotClient,
        ProxyStreamerBotClient,
        setupStreamerBot,
        startStreamerBotConnection: typeof startStreamerBotConnection === 'function'
            ? startStreamerBotConnection
            : undefined,
        tryStreamerbotClientConnect,
    };`, context);

    return { ...context.module.exports, elements, window };
}

test('forwards socket loss after the initial connection succeeds', async () => {
    let nativeClient;
    class FakeStreamerbotClient {
        constructor(options) {
            this.options = options;
            nativeClient = this;
            queueMicrotask(() => options.onConnect({}));
        }
    }
    const { tryStreamerbotClientConnect } = loadScript({ StreamerbotClient: FakeStreamerbotClient });
    const losses = [];

    await tryStreamerbotClientConnect('8080', 2000, reason => losses.push(reason));
    nativeClient.options.onDisconnect();

    assert.equal(losses.length, 1);
    assert.equal(losses[0].reason, 'disconnect');
    assert.equal(losses[0].port, '8080');
});

test('proxy disconnect cancels its pending remote action-list request', async () => {
    let nativeDisconnects = 0;
    const { ProxyStreamerBotClient } = loadScript();
    const client = new ProxyStreamerBotClient({
        disconnect() { nativeDisconnects += 1; },
    });
    let rejection;
    const timeoutId = setTimeout(() => {}, 60000);
    timeoutId.unref();
    client._pendingGetActions = {
        resolve() {},
        reject(error) { rejection = error; },
        timeoutId,
    };

    client.disconnect();

    assert.match(rejection.message, /disconnected/);
    assert.equal(client._pendingGetActions, null);
    assert.equal(nativeDisconnects, 1);
});

test('proxy setup publishes the client only after the remote action list is ready', async () => {
    let publishedDuringRemoteFetch;
    class FakeStreamerbotClient {
        constructor(options) {
            this.options = options;
            this.customHandler = null;
            queueMicrotask(() => options.onConnect({}));
        }

        on(event, handler) {
            if (event === 'General.Custom') this.customHandler = handler;
        }

        async getActions() {
            return {
                status: 'ok',
                actions: [
                    { id: 'get', name: 'remoteGetActions' },
                    { id: 'do', name: 'remoteDoAction' },
                ],
            };
        }

        async doAction(actionId) {
            if (actionId !== 'get') return;
            publishedDuringRemoteFetch = Boolean(runtime.window.sbClient);
            queueMicrotask(() => this.customHandler({
                data: {
                    type: 'StreamerBotProxyGetActions',
                    json: JSON.stringify([{ Item1: 'remote-1', Item2: 'Remote Action' }]),
                },
            }));
        }

        disconnect() {}
    }

    const runtime = loadScript({ search: '?proxy', StreamerbotClient: FakeStreamerbotClient });
    const connection = await runtime.setupStreamerBot('8080', () => {});

    assert.equal(publishedDuringRemoteFetch, false);
    assert.equal(runtime.window.sbClient, undefined);
    assert.equal(connection.actions.length, 1);
    assert.equal(connection.actions[0].id, 'remote-1');
    assert.equal(connection.actions[0].name, 'Remote Action');
});

test('proxy setup rejects malformed remote action-list messages', async () => {
    class FakeStreamerbotClient {
        constructor(options) {
            this.customHandler = null;
            queueMicrotask(() => options.onConnect({}));
        }

        on(event, handler) {
            if (event === 'General.Custom') this.customHandler = handler;
        }

        async getActions() {
            return {
                status: 'ok',
                actions: [
                    { id: 'get', name: 'remoteGetActions' },
                    { id: 'do', name: 'remoteDoAction' },
                ],
            };
        }

        async doAction(actionId) {
            if (actionId !== 'get') return;
            queueMicrotask(() => this.customHandler({
                data: {
                    type: 'StreamerBotProxyGetActions',
                    json: '{invalid-json',
                },
            }));
        }

        disconnect() {}
    }

    const runtime = loadScript({ search: '?proxy', StreamerbotClient: FakeStreamerbotClient });

    await assert.rejects(
        runtime.setupStreamerBot('8080', () => {}),
        /parse proxy action list/i,
    );
});

test('starts recovery without awaiting the connection and publishes only ready clients', () => {
    let supervisor;
    let starts = 0;
    class FakeConnectionSupervisor {
        constructor(options) {
            this.options = options;
            supervisor = this;
        }

        start() {
            starts += 1;
            return new Promise(() => {});
        }
    }
    const runtime = loadScript({ ConnectionSupervisor: FakeConnectionSupervisor });

    const result = runtime.startStreamerBotConnection('8080');

    assert.equal(result, supervisor);
    assert.equal(starts, 1);
    assert.equal(runtime.window.connectionSupervisor, supervisor);

    supervisor.options.onStateChange({ state: 'connecting' });
    assert.equal(runtime.elements.get('status-text').textContent, 'Connecting to Streamer.bot...');

    const readyConnection = {
        sbClient: { id: 'ready-client' },
        actions: [{ id: 'action-1' }],
    };
    supervisor.options.onStateChange({ state: 'ready', connection: readyConnection });
    assert.equal(runtime.window.sbClient, readyConnection.sbClient);
    assert.equal(runtime.window.appState.availableActions, readyConnection.actions);
    assert.equal(runtime.elements.get('status-text').textContent, 'Connected to Streamer.bot');

    supervisor.options.onStateChange({
        state: 'waiting',
        reason: new Error('offline'),
        delayMs: 300000,
    });
    assert.equal(runtime.window.sbClient, null);
    assert.equal(
        runtime.elements.get('status-text').textContent,
        'Streamer.bot unavailable (offline). Retrying in 5 minutes.',
    );
    supervisor.options.onStateChange({ state: 'connecting' });
});

test('renders status through repeated waiting and connection states', () => {
    let supervisor;
    class FakeConnectionSupervisor {
        constructor(options) {
            this.options = options;
            supervisor = this;
        }

        start() { return Promise.resolve(); }
    }
    const runtime = loadScript({ ConnectionSupervisor: FakeConnectionSupervisor });
    runtime.startStreamerBotConnection('8080');

    supervisor.options.onStateChange({
        state: 'waiting',
        reason: new Error('offline'),
        delayMs: 5000,
    });
    assert.equal(
        runtime.elements.get('status-text').textContent,
        'Streamer.bot unavailable (offline). Retrying in 5 seconds.',
    );

    supervisor.options.onStateChange({
        state: 'waiting',
        reason: new Error('offline'),
        delayMs: 4000,
    });
    assert.equal(
        runtime.elements.get('status-text').textContent,
        'Streamer.bot unavailable (offline). Retrying in 4 seconds.',
    );

    supervisor.options.onStateChange({ state: 'connecting' });
    assert.equal(
        runtime.elements.get('status-text').textContent,
        'Connecting to Streamer.bot...',
    );

    supervisor.options.onStateChange({
        state: 'waiting',
        reason: new Error('still offline'),
        delayMs: 10000,
    });
    assert.equal(
        runtime.elements.get('status-text').textContent,
        'Streamer.bot unavailable (still offline). Retrying in 10 seconds.',
    );

    supervisor.options.onStateChange({
        state: 'waiting',
        reason: new Error('still offline'),
        delayMs: 9000,
    });
    assert.equal(
        runtime.elements.get('status-text').textContent,
        'Streamer.bot unavailable (still offline). Retrying in 9 seconds.',
    );

    supervisor.options.onStateChange({
        state: 'ready',
        connection: { sbClient: {}, actions: [] },
    });
    assert.equal(
        runtime.elements.get('status-text').textContent,
        'Connected to Streamer.bot',
    );
});
