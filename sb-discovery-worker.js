// sb-discovery-worker.js
importScripts('https://unpkg.com/@streamerbot/client/dist/streamerbot-client.js');
self.onmessage = function(e) {
    const { ips, port, useSecure, handshakeTimeout = 1500 } = e.data;
    let completed = 0;
    const baseRetryDelay = 1000; // ms
    const retryCounts = {};
    const MAX_CONCURRENT_PROBES = 20;
    let activeProbes = 0;
    let probeQueue = ips.slice();
    let adaptiveBaseDelay = 1000; // Start at 1s, increase if resource errors

    function isValidIP(ip) {
        // Basic check for IPv4, skip 0.0.0.0, 127.0.0.1, and empty
        if (!ip || typeof ip !== 'string') return false;
        if (ip === '0.0.0.0' || ip === '127.0.0.1' || ip === 'localhost') return false;
        // Add more checks as needed (e.g., IPv6, reserved ranges)
        return true;
    }

    function runNextProbe() {
        while (activeProbes < MAX_CONCURRENT_PROBES && probeQueue.length > 0) {
            const ip = probeQueue.shift();
            if (!isValidIP(ip)) {
                self.postMessage({ log: `Skipping invalid or unroutable IP: ${ip}` });
                completed++;
                continue;
            }
            activeProbes++;
            probe(ip, () => {
                activeProbes--;
                runNextProbe();
            });
        }
        if (completed === ips.length && probeQueue.length === 0 && activeProbes === 0) {
            self.postMessage({ done: true });
        }
    }

    function probe(ip, onDone) {
        let finished = false;
        let protocol = useSecure ? 'wss' : 'ws';
        let client;
        try {
            client = new self.StreamerbotClient({
                host: ip,
                port: port,
                useSecure: useSecure,
                onConnect: (info) => {
                    if (!finished) {
                        finished = true;
                        self.postMessage({ log: `Success: ${ip}` });
                        self.postMessage({ ip });
                        done(onDone);
                        self.postMessage({ progress: 1 });
                        client.disconnect && client.disconnect();
                    }
                },
                onDisconnect: () => {
                    if (!finished) {
                        finished = true;
                        self.postMessage({ log: `Disconnected: ${ip}` });
                        if (!shouldRetry(ip)) {
                            done(onDone);
                        } else {
                            scheduleRetry(ip, onDone, false, 'disconnect');
                        }
                        self.postMessage({ progress: 1 });
                    }
                },
                onError: () => {
                    if (!finished) {
                        finished = true;
                        self.postMessage({ log: `Error: ${ip}` });
                        if (!shouldRetry(ip)) {
                            done(onDone);
                        } else {
                            scheduleRetry(ip, onDone, false, 'error');
                        }
                        self.postMessage({ progress: 1 });
                    }
                }
            });
        } catch (err) {
            self.postMessage({ log: `Failed to create StreamerbotClient for ${ip}:${port} - ${err}` });
            if (!shouldRetry(ip)) {
                done(onDone);
            } else {
                scheduleRetry(ip, onDone, false, 'create-fail');
            }
            self.postMessage({ progress: 1 });
        }
    }

    function done(onDone) {
        completed++;
        if (onDone) onDone();
    }

    function shouldRetry(ip) {
        retryCounts[ip] = (retryCounts[ip] || 0) + 1;
        if (retryCounts[ip] < MAX_ATTEMPTS) {
            return true;
        } else {
            self.postMessage({ log: `Giving up on ${ip}:${port} after ${MAX_ATTEMPTS} failed attempts.` });
            return false;
        }
    }

    function scheduleRetry(ip, onDone, isResourceError, reason) {
        // Use exponential backoff with jitter for all errors
        const base = isResourceError ? adaptiveBaseDelay : baseRetryDelay;
        const jitter = base * (0.5 + Math.random());
        const delay = Math.round(jitter * (retryCounts[ip] || 1));
        self.postMessage({ log: `Retrying ${ip}:${port} due to ${reason} (attempt ${retryCounts[ip]}) in ${delay}ms` });
        setTimeout(() => {
            probeQueue.push(ip);
            // Do NOT call done(onDone) here; just requeue and run next probe
            runNextProbe();
        }, delay);
    }

    // Warn if using insecure ws://
    if (!useSecure) {
        self.postMessage({ log: 'Warning: Using ws:// (insecure). Prefer wss:// for security.' });
    }

    runNextProbe();
}; 