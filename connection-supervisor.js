class ConnectionSupervisor {
    constructor({
        connect,
        disconnect = () => {},
        onStateChange = () => {},
        setTimer = setTimeout,
        clearTimer = clearTimeout,
        initialDelayMs = 5000,
        maxDelayMs = 300000,
    }) {
        this.connect = connect;
        this.disconnect = disconnect;
        this.onStateChange = onStateChange;
        this.setTimer = setTimer;
        this.clearTimer = clearTimer;
        this.initialDelayMs = initialDelayMs;
        this.maxDelayMs = maxDelayMs;
        this.nextDelayMs = initialDelayMs;
        this.running = false;
        this.attempting = false;
        this.attemptId = 0;
        this.connection = null;
        this.retryTimer = null;
        this.retryRequested = false;
        this.retryReason = null;
        this.attemptPromise = null;
    }

    start() {
        if (this.running) return this.attemptPromise || Promise.resolve();
        this.running = true;
        return this._attempt();
    }

    stop() {
        this.running = false;
        this.attemptId += 1;
        if (this.retryTimer) this.clearTimer(this.retryTimer);
        this.retryTimer = null;
        if (this.connection) this.disconnect(this.connection);
        this.connection = null;
    }

    async _attempt() {
        if (!this.running || this.attempting) return this.attemptPromise;

        this.attempting = true;
        this.retryRequested = false;
        this.retryReason = null;
        const attemptId = ++this.attemptId;
        this.onStateChange({ state: 'connecting' });

        this.attemptPromise = (async () => {
            let candidate = null;
            try {
                candidate = await this.connect(reason => this._handleDisconnect(attemptId, reason));
                if (this.retryRequested || attemptId !== this.attemptId || !this.running) {
                    this.disconnect(candidate);
                    return;
                }

                this.connection = candidate;
                this.nextDelayMs = this.initialDelayMs;
                this.onStateChange({ state: 'ready', connection: candidate });
            } catch (error) {
                this.retryRequested = true;
                this.retryReason = this.retryReason || error;
            } finally {
                this.attempting = false;
                this.attemptPromise = null;
                if (this.running && this.retryRequested) this._scheduleRetry(this.retryReason);
            }
        })();

        return this.attemptPromise;
    }

    _handleDisconnect(attemptId, reason) {
        if (!this.running || attemptId !== this.attemptId) return;

        if (this.attempting) {
            this.retryRequested = true;
            this.retryReason = reason;
            return;
        }

        this.attemptId += 1;
        const connection = this.connection;
        this.connection = null;
        if (connection) this.disconnect(connection);
        this._scheduleRetry(reason);
    }

    _scheduleRetry(reason) {
        if (!this.running || this.retryTimer) return;

        const delayMs = this.nextDelayMs;
        this.nextDelayMs = Math.min(delayMs * 2, this.maxDelayMs);
        this.onStateChange({ state: 'waiting', reason, delayMs });
        this.retryTimer = this.setTimer(() => {
            this.retryTimer = null;
            return this._attempt();
        }, delayMs);
    }
}

async function initializeDiceDeckClient(nativeClient, createClient, setPendingClient = () => {}) {
    const sbClient = createClient(nativeClient);
    setPendingClient(sbClient);

    try {
        await sbClient.init();
        const response = await sbClient.getActions();
        if (response?.status !== 'ok' || !Array.isArray(response.actions)) {
            throw new Error('Streamer.bot did not return a valid action list');
        }

        return { nativeClient, sbClient, actions: response.actions };
    } catch (error) {
        sbClient.disconnect?.();
        throw error;
    } finally {
        setPendingClient(null);
    }
}

if (typeof window !== 'undefined') {
    window.ConnectionSupervisor = ConnectionSupervisor;
    window.initializeDiceDeckClient = initializeDiceDeckClient;
}
if (typeof module !== 'undefined') {
    module.exports = { ConnectionSupervisor, initializeDiceDeckClient };
}
