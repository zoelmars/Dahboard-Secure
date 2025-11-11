/**
 * ARKAMUAS Infrastructure Monitor — Frontend Application
 * ======================================================
 * Polls the Flask backend every 10 seconds and updates the dashboard.
 */

(function () {
    'use strict';

    // =========================================================================
    // Config
    // =========================================================================
    const REFRESH_INTERVAL = 10000; // 10 seconds
    const API_BASE = '';            // Same origin

    // =========================================================================
    // State
    // =========================================================================
    let serverConfig = null;
    let currentLogTab = null;      // { server_id, log_type }
    let isFirstLoad = true;

    // =========================================================================
    // Helpers
    // =========================================================================

    async function fetchJSON(url) {
        try {
            const resp = await fetch(API_BASE + url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return await resp.json();
        } catch (err) {
            console.error(`Fetch error: ${url}`, err);
            return null;
        }
    }

    function formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toString();
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // =========================================================================
    // Clock
    // =========================================================================

    function updateClock() {
        const now = new Date();
        const h = String(now.getHours()).padStart(2, '0');
        const m = String(now.getMinutes()).padStart(2, '0');
        const s = String(now.getSeconds()).padStart(2, '0');
        document.getElementById('header-clock').textContent = `${h}:${m}:${s}`;
    }

    setInterval(updateClock, 1000);
    updateClock();

    // =========================================================================
    // Connection Status
    // =========================================================================

    function setConnectionStatus(status, text) {
        const dot = document.querySelector('#header-status .status-dot');
        const label = document.querySelector('#header-status .status-text');
        dot.className = 'status-dot ' + status;
        label.textContent = text;
    }

    // =========================================================================
    // Server Cards
    // =========================================================================

    function createGaugeSVG(id, label, colorClass) {
        const r = 38;
        const circ = 2 * Math.PI * r;
        return `
            <div class="gauge-container">
                <svg class="gauge-svg" viewBox="0 0 96 96">
                    <circle class="gauge-bg" cx="48" cy="48" r="${r}" />
                    <circle class="gauge-fill ${colorClass}" id="gauge-${id}" cx="48" cy="48" r="${r}"
                            style="stroke-dasharray:${circ.toFixed(2)};stroke-dashoffset:${circ.toFixed(2)}" />
                    <g class="gauge-text-group">
                        <text class="gauge-value" x="48" y="44" id="gval-${id}">--%</text>
                        <text class="gauge-label-text" x="48" y="58">${label}</text>
                    </g>
                </svg>
            </div>
        `;
    }

    function updateGauge(id, percent) {
        const r = 38;
        const circ = 2 * Math.PI * r;
        const offset = circ * (1 - percent / 100);
        const el = document.getElementById('gauge-' + id);
        const valEl = document.getElementById('gval-' + id);

        if (el) {
            el.style.strokeDashoffset = offset.toFixed(2);
            // Color coding
            el.classList.remove('warning', 'danger');
            if (percent > 85) el.classList.add('danger');
            else if (percent > 70) el.classList.add('warning');
        }
        if (valEl) {
            valEl.textContent = percent.toFixed(1) + '%';
        }
    }

    function renderServerCard(srv) {
        const sid = srv.server_id;
        const isOffline = srv.status === 'offline';

        return `
            <div class="server-card ${isOffline ? 'offline' : ''}" data-server="${sid}">
                <div class="card-header">
                    <div>
                        <div class="card-title">${escapeHtml(srv.name)}</div>
                        <div class="card-ip">${escapeHtml(srv.host)}</div>
                        <div class="card-role">${escapeHtml(srv.role || '')}</div>
                    </div>
                    <span class="card-status-badge ${isOffline ? 'offline' : ''}">${isOffline ? 'OFFLINE' : 'ONLINE'}</span>
                </div>
                ${isOffline ? `
                    <div style="text-align:center;padding:40px 0;color:var(--text-muted);font-size:0.85rem;">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:0.4"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.56 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 016.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                        <div>Server tidak terjangkau</div>
                    </div>
                ` : `
                    <div class="gauges-row">
                        ${createGaugeSVG(sid + '-cpu', 'CPU', 'cpu')}
                        ${createGaugeSVG(sid + '-mem', 'RAM', 'mem')}
                    </div>
                    <div class="disk-section">
                        <div class="disk-header">
                            <span>DISK</span>
                            <span>${escapeHtml(srv.disk_used || '0')} / ${escapeHtml(srv.disk_total || '0')}</span>
                        </div>
                        <div class="disk-bar">
                            <div class="disk-bar-fill ${(srv.disk_percent || 0) > 85 ? 'danger' : (srv.disk_percent || 0) > 70 ? 'warning' : ''}"
                                 id="disk-${sid}" style="width: ${srv.disk_percent || 0}%"></div>
                        </div>
                    </div>
                    <div class="services-list">
                        ${Object.entries(srv.services || {}).map(([name, status]) => `
                            <div class="service-item">
                                <span class="service-dot ${status}"></span>
                                <span class="service-name">${escapeHtml(name)}</span>
                                <span class="service-status-text">${status}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="card-footer">
                        <span>⏱ ${escapeHtml(srv.uptime || 'N/A')}</span>
                        <span>⚡ ${(srv.load || [0])[0].toFixed(2)}</span>
                    </div>
                `}
            </div>
        `;
    }

    function updateServerCards(servers, serverOrder) {
        const grid = document.getElementById('server-grid');

        // Render all cards
        let html = '';
        for (const sid of serverOrder) {
            if (servers[sid]) {
                html += renderServerCard(servers[sid]);
            }
        }
        grid.innerHTML = html;

        // Animate gauges after DOM update
        requestAnimationFrame(() => {
            for (const sid of serverOrder) {
                const srv = servers[sid];
                if (srv && srv.status !== 'offline') {
                    updateGauge(sid + '-cpu', srv.cpu || 0);
                    updateGauge(sid + '-mem', srv.mem_percent || 0);
                }
            }
        });
    }

    // =========================================================================
    // Security Overview
    // =========================================================================

    function updateSecurity(data) {
        // Numbers
        const animate = (id, value) => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = formatNumber(value);
                el.style.color = value > 0 ? 'var(--text-primary)' : 'var(--text-muted)';
            }
        };

        animate('stat-f2b-num', data.fail2ban_total_bans || 0);
        animate('stat-waf-num', data.waf_blocks || 0);
        animate('stat-ids-num', data.ids_alerts || 0);
        animate('stat-ufw-num', data.ufw_blocks || 0);
    }

    function updateSecurityEvents(events) {
        const list = document.getElementById('events-list');

        if (!events || events.length === 0) {
            list.innerHTML = '<div class="event-placeholder">Belum ada security events terdeteksi</div>';
            return;
        }

        let html = '';
        // Show newest first
        const reversed = [...events].reverse();
        for (const evt of reversed.slice(0, 20)) {
            html += `
                <div class="event-item ${evt.severity || 'info'}">
                    <span class="event-source ${evt.source}">${escapeHtml(evt.source)}</span>
                    <span class="event-message">${escapeHtml(evt.message)}</span>
                    <span class="event-server">${escapeHtml(evt.server || '')}</span>
                </div>
            `;
        }
        list.innerHTML = html;
    }

    // =========================================================================
    // Load Balancer Stats
    // =========================================================================

    function updateLBStats(data) {
        document.getElementById('lb-bar-ws1').style.width = data.web1_pct + '%';
        document.getElementById('lb-bar-ws2').style.width = data.web2_pct + '%';
        document.getElementById('lb-pct-ws1').textContent = data.web1_pct + '%';
        document.getElementById('lb-pct-ws2').textContent = data.web2_pct + '%';
        document.getElementById('lb-count-ws1').textContent = formatNumber(data.web1_count) + ' req';
        document.getElementById('lb-count-ws2').textContent = formatNumber(data.web2_count) + ' req';
        document.getElementById('lb-total').innerHTML = `Total: <strong>${formatNumber(data.total)}</strong> requests`;
    }

    // =========================================================================
    // Log Tabs & Viewer
    // =========================================================================

    function buildLogTabs(config) {
        const container = document.getElementById('log-tabs');
        let html = '';

        // Build tabs from server config
        const tabDefs = [];

        for (const [sid, srv] of Object.entries(config)) {
            for (const logType of srv.log_types) {
                const label = `${sid}:${logType}`;
                tabDefs.push({ sid, logType, label, serverName: srv.name });
            }
        }

        for (const tab of tabDefs) {
            html += `<button class="log-tab" data-server="${tab.sid}" data-log="${tab.logType}"
                             title="${tab.serverName}">${tab.label}</button>`;
        }

        container.innerHTML = html;

        // Click handlers
        container.querySelectorAll('.log-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.log-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentLogTab = {
                    server_id: btn.dataset.server,
                    log_type: btn.dataset.log,
                };
                refreshLogs();
            });
        });

        // Auto-select first tab
        if (tabDefs.length > 0) {
            const firstBtn = container.querySelector('.log-tab');
            if (firstBtn) firstBtn.click();
        }
    }

    async function refreshLogs() {
        if (!currentLogTab) return;

        const { server_id, log_type } = currentLogTab;
        const data = await fetchJSON(`/api/logs/${server_id}/${log_type}`);
        const viewer = document.getElementById('log-viewer');

        if (!data || !data.lines) {
            viewer.innerHTML = '<div class="log-placeholder">Gagal memuat log</div>';
            return;
        }

        let html = '';
        for (const line of data.lines) {
            html += `<div class="log-line">${escapeHtml(line)}</div>`;
        }
        viewer.innerHTML = html;

        // Auto-scroll
        const autoScroll = document.getElementById('autoscroll-check');
        if (autoScroll && autoScroll.checked) {
            viewer.scrollTop = viewer.scrollHeight;
        }
    }

    // =========================================================================
    // Main Refresh Loop
    // =========================================================================

    async function refresh() {
        const indicator = document.getElementById('refresh-indicator');
        const spinSvg = indicator.querySelector('.spin');

        try {
            // Show spinning indicator
            if (spinSvg) spinSvg.style.display = 'inline';

            // Fetch all data in parallel
            const [overview, security, secEvents, lbStats] = await Promise.all([
                fetchJSON('/api/overview'),
                fetchJSON('/api/security'),
                fetchJSON('/api/security/events'),
                fetchJSON('/api/lb-stats'),
            ]);

            // Update connection status
            if (overview) {
                const onlineCount = Object.values(overview.servers)
                    .filter(s => s.status === 'online').length;
                const total = Object.keys(overview.servers).length;

                if (onlineCount === total) {
                    setConnectionStatus('', `All ${total} servers online`);
                } else if (onlineCount > 0) {
                    setConnectionStatus('connecting', `${onlineCount}/${total} servers online`);
                } else {
                    setConnectionStatus('error', 'All servers offline');
                }

                updateServerCards(overview.servers, overview.server_order);
                document.getElementById('last-update').textContent = overview.timestamp;
            } else {
                setConnectionStatus('error', 'API unreachable');
            }

            if (security) updateSecurity(security);
            if (secEvents) updateSecurityEvents(secEvents.events);
            if (lbStats) updateLBStats(lbStats);

            // Refresh current log tab
            if (currentLogTab) refreshLogs();

        } catch (err) {
            console.error('Refresh error:', err);
            setConnectionStatus('error', 'Error');
        } finally {
            // Hide spinning indicator after a moment
            setTimeout(() => {
                if (spinSvg) spinSvg.style.display = 'none';
            }, 800);
        }
    }

    // =========================================================================
    // Initialization
    // =========================================================================

    async function init() {
        // Load server config for log tabs
        serverConfig = await fetchJSON('/api/server-config');
        if (serverConfig) {
            buildLogTabs(serverConfig);
        }

        // Initial data load
        await refresh();
        isFirstLoad = false;

        // Start refresh loop
        setInterval(refresh, REFRESH_INTERVAL);
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
