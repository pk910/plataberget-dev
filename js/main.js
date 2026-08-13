// Store for live data
let liveData = null;
let splitsData = null;
let epochsData = null;
let lastUpdateTime = null;
let updateTimerInterval = null;

// Utility functions
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'UTC'
    }) + ' UTC';
}

function formatNumber(num) {
    return num.toLocaleString('en-US');
}

function formatEther(gwei) {
    // Convert from gwei to ETH
    const eth = gwei / 1e9;
    if (eth >= 1e6) {
        return (eth / 1e6).toFixed(2) + 'M ETH';
    }
    if (eth >= 1e3) {
        return (eth / 1e3).toFixed(2) + 'K ETH';
    }
    return eth.toFixed(2) + ' ETH';
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds}s`;
    }
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins}m`;
    }
    if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 60) {
        return 'just now';
    }
    if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        return `${mins} min ago`;
    }
    const hours = Math.floor(seconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
}

// API functions
async function fetchApiData(endpoint) {
    try {
        const headers = {};
        if (PLATABERGET_CONFIG.api.token) {
            headers['Authorization'] = `Bearer ${PLATABERGET_CONFIG.api.token}`;
        }
        const response = await fetch(PLATABERGET_CONFIG.api.baseUrl + endpoint, { headers });

        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }

        const json = await response.json();
        if (json.status !== 'OK' || !json.data) {
            throw new Error('Invalid API response');
        }

        return json.data;
    } catch (err) {
        console.warn(`Failed to fetch ${endpoint}:`, err.message);
        return null;
    }
}

async function fetchNetworkData() {
    // Fetch all endpoints in parallel
    const [overview, splits, epochs] = await Promise.all([
        fetchApiData(PLATABERGET_CONFIG.api.endpoints.overview),
        fetchApiData(PLATABERGET_CONFIG.api.endpoints.splits),
        fetchApiData(PLATABERGET_CONFIG.api.endpoints.epochs)
    ]);

    liveData = overview;
    splitsData = splits;
    epochsData = epochs;

    if (liveData !== null) {
        lastUpdateTime = Date.now();
    }

    return liveData !== null;
}

function updateLastUpdateDisplay() {
    const el = document.getElementById('last-update-time');
    if (el && lastUpdateTime) {
        el.textContent = formatTimeAgo(lastUpdateTime);
    }
}

async function refreshLiveStatus() {
    await fetchNetworkData();
    renderLiveStatus();
    renderNetworkInfo();
    renderForkSchedule();
}

// Get participation from canonical fork in splits data
function getCanonicalParticipation() {
    if (!splitsData || !splitsData.splits || splitsData.splits.length === 0) {
        return null;
    }

    // Find the canonical fork
    const canonicalFork = splitsData.splits.find(s => s.is_canonical);
    if (!canonicalFork || !canonicalFork.last_epoch_participation || canonicalFork.last_epoch_participation.length === 0) {
        return null;
    }

    // Get the highest participation from the array (most recent epochs)
    const maxParticipation = Math.max(...canonicalFork.last_epoch_participation);
    return maxParticipation;
}

// Calculate block production rate from epochs data
function getBlockProductionRate() {
    if (!epochsData || !epochsData.epochs || epochsData.epochs.length === 0) {
        return null;
    }

    let totalProposed = 0;
    let totalMissed = 0;

    for (const epoch of epochsData.epochs) {
        totalProposed += epoch.proposed_blocks || 0;
        totalMissed += epoch.missed_blocks || 0;
    }

    const total = totalProposed + totalMissed;
    if (total === 0) return null;

    return (totalProposed / total) * 100;
}

// Map API forks to our display format
function mapApiForks(apiForks) {
    // Group forks by epoch to combine EL/CL forks
    const forksByEpoch = {};

    // Map of CL fork names to EL equivalents and friendly names
    const forkInfo = {
        'Electra': { el: 'Prague', displayName: 'Pectra (Prague/Electra)' },
        'Fulu': { el: 'Osaka', displayName: 'Fusaka (Osaka/Fulu)' },
        'Gloas': { el: 'Amsterdam', displayName: 'Glamsterdam (Amsterdam/Gloas)' },
        'Deneb': { el: 'Cancun', displayName: null }
    };

    for (const fork of apiForks) {
        const epoch = fork.epoch;
        if (!forksByEpoch[epoch]) {
            forksByEpoch[epoch] = {
                epoch: epoch,
                timestamp: fork.time,
                active: fork.active,
                clVersions: [],
                elVersions: [],
                names: [],
                type: fork.type
            };
        }

        // Track fork names and versions
        if (fork.type === 'consensus') {
            forksByEpoch[epoch].clVersions.push(fork.name);
            if (forkInfo[fork.name]) {
                forksByEpoch[epoch].elVersions.push(forkInfo[fork.name].el);
            }
        } else if (fork.type === 'bpo') {
            // Format BPO names nicely (BPO1 -> BPO 1)
            const bpoName = fork.name.replace(/^BPO(\d+)$/, 'BPO $1');
            forksByEpoch[epoch].names.push(bpoName);
            forksByEpoch[epoch].type = 'bpo';
        }
    }

    // Convert to display format
    const displayForks = [];

    // Sort epochs
    const epochs = Object.keys(forksByEpoch).map(Number).sort((a, b) => a - b);

    for (const epoch of epochs) {
        const data = forksByEpoch[epoch];

        let name, elVersion, clVersion;

        if (data.type === 'bpo') {
            // BPO forks
            name = data.names.join(' / ');
            // BPOs don't change versions, use latest consensus versions
            const prevFork = displayForks[displayForks.length - 1];
            elVersion = prevFork ? prevFork.elVersion : 'Osaka';
            clVersion = prevFork ? prevFork.clVersion : 'Fulu';
        } else if (epoch === 0) {
            // Genesis forks - Platåberget launches with everything through Fusaka active
            name = 'Genesis (Merge → Fusaka)';
            elVersion = 'Osaka';
            clVersion = 'Fulu';
        } else {
            // Regular consensus forks - use friendly name if available
            const latestCl = data.clVersions[data.clVersions.length - 1];
            const latestEl = data.elVersions[data.elVersions.length - 1] || displayForks[displayForks.length - 1]?.elVersion;

            // Use the friendly display name if available
            if (forkInfo[latestCl] && forkInfo[latestCl].displayName) {
                name = forkInfo[latestCl].displayName;
            } else if (latestEl && latestCl) {
                name = `${latestEl}/${latestCl}`;
            } else {
                name = latestCl || latestEl;
            }

            elVersion = latestEl;
            clVersion = latestCl;
        }

        displayForks.push({
            name: name,
            timestamp: data.timestamp,
            epoch: epoch,
            elVersion: elVersion,
            clVersion: clVersion,
            isGenesis: epoch === 0,
            active: data.active
        });
    }

    return displayForks;
}

function getForks() {
    let forks;
    if (liveData && liveData.forks) {
        forks = mapApiForks(liveData.forks);
    } else {
        forks = PLATABERGET_CONFIG.forks.slice();
    }
    // Merge scheduled non-fork events (e.g. gas limit bumps) into the timeline
    const extra = (PLATABERGET_CONFIG.extraEvents || []).filter(
        e => !forks.some(f => f.epoch === e.epoch)
    );
    return forks.concat(extra).sort((a, b) => a.epoch - b.epoch);
}

function isForkActive(fork) {
    // If we have live data, use the active flag
    if (fork.active !== undefined) {
        return fork.active;
    }
    // Fallback to timestamp check
    if (fork.isGenesis) return true;
    const now = Math.floor(Date.now() / 1000);
    return fork.timestamp <= now;
}

function getCurrentVersions() {
    const forks = getForks();
    let currentEl = null;
    let currentCl = null;

    // Find the latest active fork to get current versions
    for (const fork of forks) {
        if (isForkActive(fork)) {
            if (fork.elVersion) currentEl = fork.elVersion;
            if (fork.clVersion) currentCl = fork.clVersion;
        }
    }

    return { elVersion: currentEl, clVersion: currentCl };
}

// Render functions
function renderNetworkInfo() {
    const versions = getCurrentVersions();

    const elVersionEl = document.getElementById('current-el-version');
    const clVersionEl = document.getElementById('current-cl-version');

    if (elVersionEl) elVersionEl.textContent = versions.elVersion || '-';
    if (clVersionEl) clVersionEl.textContent = versions.clVersion || '-';
}

function renderLiveStatus() {
    const container = document.getElementById('live-status');
    if (!container) return;

    if (!liveData) {
        container.innerHTML = '<p class="status-unavailable">Live data unavailable</p>';
        return;
    }

    const state = liveData.current_state;
    const checkpoints = liveData.checkpoints;
    const validators = liveData.validator_stats;
    const queue = liveData.queue_stats;

    // Calculate finalization health
    const finalizedLag = state.current_epoch - checkpoints.finalized_epoch;
    const justifiedLag = state.current_epoch - checkpoints.justified_epoch;
    const isFinalizing = finalizedLag <= 3;
    const isJustifying = justifiedLag <= 2;

    // Calculate unfinality duration if not healthy
    const secondsPerEpoch = state.seconds_per_epoch || 384;
    const unfinalityEpochs = finalizedLag > 3 ? finalizedLag - 2 : 0;
    const unfinalitySeconds = unfinalityEpochs * secondsPerEpoch;

    // Get participation data
    const participation = getCanonicalParticipation();
    const blockRate = getBlockProductionRate();
    const isParticipationLow = participation !== null && participation < 66;

    container.innerHTML = `
        <div class="live-status-sections">
            <!-- Head Status -->
            <div class="status-section">
                <h4 class="status-section-title">Chain Head</h4>
                <div class="status-row cols-2">
                    <div class="status-item">
                        <span class="status-label">Slot</span>
                        <span class="status-value mono">${formatNumber(state.current_slot)}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Epoch</span>
                        <span class="status-value mono">${formatNumber(state.current_epoch)}</span>
                    </div>
                </div>
                ${participation !== null || blockRate !== null ? `
                <div class="status-row cols-2 secondary">
                    ${participation !== null ? `
                    <div class="status-item">
                        <span class="status-label">Vote Participation</span>
                        <span class="status-value ${isParticipationLow ? 'unhealthy' : 'healthy'}">
                            ${isParticipationLow ? '<span class="status-indicator warn"></span>' : ''}
                            ${participation.toFixed(1)}%
                        </span>
                    </div>
                    ` : ''}
                    ${blockRate !== null ? `
                    <div class="status-item">
                        <span class="status-label">Block Production (5 epoch avg)</span>
                        <span class="status-value">${blockRate.toFixed(1)}%</span>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
                ${isParticipationLow ? `
                <div class="status-alert">
                    Low participation (below 66%) - network may lose finality
                </div>
                ` : ''}
            </div>

            <!-- Finalization Status -->
            <div class="status-section">
                <h4 class="status-section-title">Finalization</h4>
                <div class="status-row cols-2">
                    <div class="status-item">
                        <span class="status-label">Finalized Epoch</span>
                        <span class="status-value ${isFinalizing ? 'healthy' : 'unhealthy'}">
                            <span class="status-indicator ${isFinalizing ? 'ok' : 'warn'}"></span>
                            <span class="mono">${formatNumber(checkpoints.finalized_epoch)}</span>
                            <span class="status-lag">(${finalizedLag} behind)</span>
                        </span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Justified Epoch</span>
                        <span class="status-value ${isJustifying ? 'healthy' : 'unhealthy'}">
                            <span class="status-indicator ${isJustifying ? 'ok' : 'warn'}"></span>
                            <span class="mono">${formatNumber(checkpoints.justified_epoch)}</span>
                            <span class="status-lag">(${justifiedLag} behind)</span>
                        </span>
                    </div>
                </div>
                ${!isFinalizing ? `
                <div class="status-alert">
                    Network not finalizing for ${unfinalityEpochs} epochs (${formatDuration(unfinalitySeconds)})
                </div>
                ` : ''}
            </div>

            <!-- Validator Stats -->
            <div class="status-section">
                <h4 class="status-section-title">Validators</h4>
                <div class="status-row cols-2">
                    <div class="status-item">
                        <span class="status-label">Active Validators</span>
                        <span class="status-value mono">${formatNumber(validators.active_validator_count)}</span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Total Staked</span>
                        <span class="status-value">${formatEther(validators.total_active_balance)}</span>
                    </div>
                </div>
            </div>

            <!-- Queue Stats -->
            <div class="status-section">
                <h4 class="status-section-title">Validator Queues</h4>
                <div class="status-row cols-2">
                    <div class="status-item">
                        <span class="status-label">Deposit Queue</span>
                        <span class="status-value">
                            ${queue.entering_validator_count > 0
                                ? `${formatNumber(queue.entering_validator_count)} validators`
                                : '<span class="empty-queue">Empty</span>'}
                            ${queue.deposit_estimated_time > 0
                                ? `<span class="queue-time">(~${formatDuration(queue.deposit_estimated_time)})</span>`
                                : ''}
                        </span>
                    </div>
                    <div class="status-item">
                        <span class="status-label">Exit Queue</span>
                        <span class="status-value">
                            ${queue.exiting_validator_count > 0
                                ? `${formatNumber(queue.exiting_validator_count)} validators`
                                : '<span class="empty-queue">Empty</span>'}
                            ${queue.exit_estimated_time > 0
                                ? `<span class="queue-time">(~${formatDuration(queue.exit_estimated_time)})</span>`
                                : ''}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Last Update -->
            <div class="status-footer">
                <span class="last-update">Last update: <span id="last-update-time">${lastUpdateTime ? formatTimeAgo(lastUpdateTime) : 'just now'}</span></span>
            </div>
        </div>
    `;
}

function renderForkSchedule() {
    const container = document.getElementById('fork-timeline');
    if (!container) return;

    container.innerHTML = '';

    const forks = getForks();

    for (const fork of forks) {
        const isActive = isForkActive(fork);
        const forkItem = document.createElement('div');
        forkItem.className = `fork-item ${isActive ? 'active' : 'upcoming'}`;

        let dateText = '';
        let epochText = '';

        if (fork.isGenesis || fork.epoch === 0) {
            dateText = `At Genesis (${formatDate(PLATABERGET_CONFIG.network.launchTimestamp)})`;
        } else {
            dateText = formatDateTime(fork.timestamp);
            epochText = `Epoch ${formatNumber(fork.epoch)} \u2022 Timestamp ${fork.timestamp}`;
        }

        forkItem.innerHTML = `
            <div class="fork-name">${fork.name}</div>
            <div class="fork-date">${dateText}</div>
            ${epochText ? `<div class="fork-epoch">${epochText}</div>` : ''}
        `;

        container.appendChild(forkItem);
    }
}

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + type;
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// MetaMask integration
async function addToMetaMask() {
    if (typeof window.ethereum === 'undefined') {
        showToast('Please install MetaMask first!', 'error');
        window.open('https://metamask.io/download/', '_blank');
        return;
    }

    const config = PLATABERGET_CONFIG.metamask;

    try {
        // Try to switch to the chain first
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: config.chainId }]
        });
        showToast('Switched to Platåberget Testnet!', 'success');
    } catch (switchError) {
        // Chain not added yet, try to add it
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [config]
                });
                showToast('Platåberget Testnet added to MetaMask!', 'success');
            } catch (addError) {
                console.error('Error adding chain:', addError);
                showToast('Failed to add network', 'error');
            }
        } else {
            console.error('Error switching chain:', switchError);
            showToast('Failed to switch network', 'error');
        }
    }
}

// Copy to clipboard functionality
function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn[data-copy]');

    copyButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            const textToCopy = this.getAttribute('data-copy');

            try {
                await navigator.clipboard.writeText(textToCopy);

                // Show success state
                this.classList.add('copied');

                // Change icon to checkmark
                const originalSvg = this.innerHTML;
                this.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>';

                // Reset after 2 seconds
                setTimeout(() => {
                    this.classList.remove('copied');
                    this.innerHTML = originalSvg;
                }, 2000);

            } catch (err) {
                console.error('Failed to copy:', err);
                showToast('Failed to copy to clipboard', 'error');
            }
        });
    });
}

// Endpoint liveness checking

// Fallback check using no-cors mode - can't read response but can detect reachability
async function checkEndpointNoCors(url) {
    const startTime = performance.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        await fetch(url, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsed = Math.round(performance.now() - startTime);

        // With no-cors, we get an opaque response but if we reach here, server responded
        return { status: 'online', latency: elapsed };
    } catch (err) {
        const elapsed = Math.round(performance.now() - startTime);
        return { status: 'offline', latency: elapsed };
    }
}

async function checkRpcEndpoint(url) {
    const startTime = performance.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_chainId',
                params: [],
                id: 1
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsed = Math.round(performance.now() - startTime);

        if (response.ok) {
            const data = await response.json();
            if (data.result) {
                return { status: 'online', latency: elapsed };
            }
        }
        return { status: 'offline', latency: elapsed };
    } catch (err) {
        // CORS error - fallback to no-cors mode to check reachability
        if (err.name === 'TypeError') {
            return await checkEndpointNoCors(url);
        }
        const elapsed = Math.round(performance.now() - startTime);
        return { status: 'offline', latency: elapsed };
    }
}

async function checkCheckpointEndpoint(url) {
    const startTime = performance.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url + '/eth/v1/beacon/genesis', {
            method: 'GET',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsed = Math.round(performance.now() - startTime);

        if (response.ok) {
            return { status: 'online', latency: elapsed };
        }
        return { status: 'offline', latency: elapsed };
    } catch (err) {
        // CORS error - fallback to no-cors mode to check reachability
        if (err.name === 'TypeError') {
            return await checkEndpointNoCors(url + '/eth/v1/beacon/genesis');
        }
        const elapsed = Math.round(performance.now() - startTime);
        return { status: 'offline', latency: elapsed };
    }
}

function updateEndpointStatus(row, result) {
    const statusEl = row.querySelector('.endpoint-status');
    if (!statusEl) return;

    statusEl.className = 'endpoint-status ' + result.status;

    if (result.status === 'online') {
        statusEl.textContent = result.latency + 'ms';
        statusEl.title = 'Online - ' + result.latency + 'ms response time';
    } else {
        statusEl.textContent = 'Offline';
        statusEl.title = 'Endpoint unreachable or returned an error';
    }
}

async function checkAllEndpoints() {
    const rows = document.querySelectorAll('.resource-link-row[data-endpoint]');

    // Mark all as checking
    rows.forEach(row => {
        const statusEl = row.querySelector('.endpoint-status');
        if (statusEl) {
            statusEl.className = 'endpoint-status checking';
            statusEl.textContent = '';
            statusEl.title = 'Checking...';
        }
    });

    // Check all endpoints in parallel
    const checks = Array.from(rows).map(async (row) => {
        const type = row.dataset.endpoint;
        const url = row.dataset.url;

        let result;
        if (type === 'rpc') {
            result = await checkRpcEndpoint(url);
        } else if (type === 'checkpoint') {
            result = await checkCheckpointEndpoint(url);
        }

        updateEndpointStatus(row, result);
    });

    await Promise.all(checks);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Try to fetch live data first
    await fetchNetworkData();

    // Render all sections (will use live data if available, fallback to config)
    renderNetworkInfo();
    renderLiveStatus();
    renderForkSchedule();
    initCopyButtons();

    // Check endpoint liveness
    checkAllEndpoints();

    // Auto-refresh live status every 5 minutes
    setInterval(refreshLiveStatus, 5 * 60 * 1000);

    // Re-check endpoints every 2 minutes
    setInterval(checkAllEndpoints, 2 * 60 * 1000);

    // Update "last update" display every 30 seconds
    setInterval(updateLastUpdateDisplay, 30 * 1000);
});
