const test = require('node:test');
const assert = require('node:assert/strict');

const {
    ConnectionSupervisor,
    initializeDiceDeckClient,
} = require('../connection-supervisor');

function createFakeTimers() {
    const queue = [];
    let now = 0;

    return {
        queue,
        now() { return now; },
        advance(milliseconds) { now += milliseconds; },
        setTimer(callback, delayMs) {
            const timer = { callback, delayMs, cancelled: false };
            queue.push(timer);
            return timer;
        },
        clearTimer(timer) {
            timer.cancelled = true;
        },
        next() {
            return queue.find(timer => !timer.cancelled);
        },
        async runNext() {
            const timer = this.next();
            assert.ok(timer, 'expected a scheduled timer');
            timer.cancelled = true;
            now += timer.delayMs;
            await timer.callback();
        },
        async runUntil(predicate, maxTicks = 2000) {
            let ticks = 0;
            while (!predicate()) {
                assert.ok(ticks < maxTicks, 'condition was not reached before the timer limit');
                await this.runNext();
                ticks += 1;
            }
        },
    };
}

test('backs off from five seconds to a five minute ceiling', async () => {
    const timers = createFakeTimers();
    const states = [];
    let attempts = 0;
    const supervisor = new ConnectionSupervisor({
        connect: async () => {
            attempts += 1;
            throw new Error('offline');
        },
        onStateChange: state => states.push(state),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
        now: timers.now,
    });

    await supervisor.start();

    const expectedDelays = [5000, 10000, 20000, 40000, 80000, 160000, 300000, 300000];
    for (const [index, delayMs] of expectedDelays.entries()) {
        assert.equal(states.at(-1).delayMs, delayMs);
        if (index < expectedDelays.length - 1) {
            const completedAttempts = attempts;
            await timers.runUntil(() => attempts > completedAttempts);
        }
    }
});

test('resets the backoff after a connection becomes fully ready', async () => {
    const timers = createFakeTimers();
    const states = [];
    let onDisconnect;
    let attempt = 0;
    const supervisor = new ConnectionSupervisor({
        connect: async callback => {
            attempt += 1;
            onDisconnect = callback;
            if (attempt < 3) throw new Error('offline');
            return { id: attempt };
        },
        onStateChange: state => states.push(state),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
        now: timers.now,
    });

    await supervisor.start();
    await timers.runUntil(() => attempt === 2);
    await timers.runUntil(() => attempt === 3);
    onDisconnect('disconnected');

    assert.equal(states.at(-1).delayMs, 5000);
});

test('serializes duplicate starts and retries a disconnect during initialization', async () => {
    const timers = createFakeTimers();
    const states = [];
    const disconnectedCandidates = [];
    let resolveConnection;
    let onDisconnect;
    let attempts = 0;
    const supervisor = new ConnectionSupervisor({
        connect: callback => {
            attempts += 1;
            onDisconnect = callback;
            return new Promise(resolve => { resolveConnection = resolve; });
        },
        disconnect: connection => disconnectedCandidates.push(connection),
        onStateChange: state => states.push(state),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
        now: timers.now,
    });

    const first = supervisor.start();
    const second = supervisor.start();
    assert.equal(attempts, 1);

    onDisconnect('lost during initialization');
    resolveConnection({ id: 1 });
    await Promise.all([first, second]);

    assert.deepEqual(disconnectedCandidates, [{ id: 1 }]);
    assert.equal(states.at(-1).delayMs, 5000);
});

test('updates waiting time each second and retries at the deadline without showing zero', async () => {
    const timers = createFakeTimers();
    const states = [];
    let attempts = 0;
    const supervisor = new ConnectionSupervisor({
        connect: async () => {
            attempts += 1;
            throw new Error('offline');
        },
        onStateChange: state => states.push(state),
        setTimer: timers.setTimer,
        clearTimer: timers.clearTimer,
        now: timers.now,
    });

    await supervisor.start();
    assert.equal(states.at(-1).delayMs, 5000);

    timers.advance(1);
    await timers.runNext();
    assert.equal(states.at(-1).delayMs, 4000);

    await timers.runNext();
    await timers.runNext();
    await timers.runNext();
    await timers.runNext();

    assert.equal(attempts, 2);
    assert.equal(states.some(state => state.state === 'waiting' && state.delayMs === 0), false);
});

test('requires initialization and a successful action list before readiness', async () => {
    const calls = [];
    const pendingClients = [];
    const wrapper = {
        async init() { calls.push('init'); },
        async getActions() {
            calls.push('actions');
            return { status: 'ok', actions: [{ id: '1' }] };
        },
    };

    const result = await initializeDiceDeckClient(
        { id: 'native' },
        () => wrapper,
        client => pendingClients.push(client),
    );

    assert.deepEqual(calls, ['init', 'actions']);
    assert.deepEqual(result.actions, [{ id: '1' }]);
    assert.deepEqual(pendingClients, [wrapper, null]);
});

test('rejects direct clients with an invalid action response', async () => {
    let disconnected = false;
    const wrapper = {
        async init() {},
        async getActions() { return { status: 'error' }; },
        disconnect() { disconnected = true; },
    };

    await assert.rejects(
        initializeDiceDeckClient({}, () => wrapper),
        /valid action list/,
    );
    assert.equal(disconnected, true);
});

test('propagates proxy relay initialization failures', async () => {
    const wrapper = {
        async init() { throw new Error('Could not find remote action IDs'); },
        async getActions() { return { status: 'ok', actions: [] }; },
        disconnect() {},
    };

    await assert.rejects(
        initializeDiceDeckClient({}, () => wrapper),
        /Could not find remote action IDs/,
    );
});

test('propagates proxy remote action-list timeouts', async () => {
    const wrapper = {
        async init() {},
        async getActions() { throw new Error('getActions timed out'); },
        disconnect() {},
    };

    await assert.rejects(
        initializeDiceDeckClient({}, () => wrapper),
        /getActions timed out/,
    );
});
