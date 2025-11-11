"""
ARKAMUAS Infrastructure Monitor — Backend (Flask-SocketIO)
==========================================================
Real-time monitoring via WebSocket.
Run: python server.py
Dashboard: http://localhost:5000 (production) | http://localhost:5173 (dev)
"""

import eventlet
eventlet.monkey_patch()

import os
import sys
import time
import getpass
import threading
from datetime import datetime
from flask import Flask, send_from_directory
from flask_socketio import SocketIO, emit
import paramiko

# =============================================================================
# App Setup
# =============================================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.join(BASE_DIR, 'frontend', 'dist')

app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path='')
app.config['SECRET_KEY'] = 'arkamuas-monitor-secret'
socketio = SocketIO(
    app,
    cors_allowed_origins='*',
    async_mode='eventlet',
    logger=False,
    engineio_logger=False,
)

# =============================================================================
# Server Configuration
# =============================================================================

SERVERS = {
    'lb': {
        'host': '192.168.46.100',
        'name': 'Load Balancer',
        'role': 'Reverse Proxy + WAF + IDS',
        'username': 'root',
        'port': 22,
        'services': ['nginx', 'fail2ban', 'suricata', 'ufw'],
        'logs': {
            'nginx_access': '/var/log/nginx/access.log',
            'nginx_error': '/var/log/nginx/error.log',
            'modsecurity': '/var/log/apache2/modsec_audit.log',
            'fail2ban': '/var/log/fail2ban.log',
            'suricata': '/var/log/suricata/fast.log',
            'ufw': '/var/log/ufw.log',
            'auth': '/var/log/auth.log',
        }
    },
    'web1': {
        'host': '192.168.46.3',
        'name': 'Web Server 1',
        'role': 'Apache + WordPress',
        'username': 'root',
        'port': 22,
        'services': ['apache2', 'fail2ban', 'ufw'],
        'logs': {
            'apache_access': '/var/log/apache2/access.log',
            'apache_error': '/var/log/apache2/error.log',
            'fail2ban': '/var/log/fail2ban.log',
            'ufw': '/var/log/ufw.log',
            'auth': '/var/log/auth.log',
        }
    },
    'web2': {
        'host': '192.168.46.12',
        'name': 'Web Server 2',
        'role': 'Apache + WordPress',
        'username': 'root',
        'port': 22,
        'services': ['apache2', 'fail2ban', 'ufw'],
        'logs': {
            'apache_access': '/var/log/apache2/access.log',
            'apache_error': '/var/log/apache2/error.log',
            'fail2ban': '/var/log/fail2ban.log',
            'ufw': '/var/log/ufw.log',
            'auth': '/var/log/auth.log',
        }
    },
    'db': {
        'host': '192.168.46.16',
        'name': 'Database Server',
        'role': 'MySQL Database',
        'username': 'root',
        'port': 22,
        'services': ['mysql', 'fail2ban', 'ufw'],
        'logs': {
            'mysql': '/var/log/mysql/error.log',
            'fail2ban': '/var/log/fail2ban.log',
            'ufw': '/var/log/ufw.log',
            'auth': '/var/log/auth.log',
        }
    }
}

SERVER_ORDER = ['lb', 'web1', 'web2', 'db']
LOG_LINES = 80
EMIT_INTERVAL = 3   # seconds between broadcasts

# =============================================================================
# Globals
# =============================================================================

SSH_PASSWORD = None
prev_cpu_stats = {}

# =============================================================================
# SSH Manager
# =============================================================================

class SSHManager:
    def __init__(self):
        self._connections = {}
        self._lock = threading.Lock()

    def _connect(self, server_id):
        server = SERVERS[server_id]
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                hostname=server['host'],
                port=server['port'],
                username=server['username'],
                password=SSH_PASSWORD,
                timeout=5,
                banner_timeout=5,
                auth_timeout=5,
            )
            t = client.get_transport()
            if t:
                t.set_keepalive(30)
            return client
        except Exception as e:
            print(f'  [SSH] Gagal konek ke {server["name"]}: {e}')
            return None

    def get_connection(self, server_id):
        with self._lock:
            client = self._connections.get(server_id)
            if client:
                t = client.get_transport()
                if t and t.is_active():
                    return client
                try:
                    client.close()
                except:
                    pass
            client = self._connect(server_id)
            if client:
                self._connections[server_id] = client
            return client

    def execute(self, server_id, command, timeout=10):
        client = self.get_connection(server_id)
        if not client:
            return None
        try:
            _, stdout, _ = client.exec_command(command, timeout=timeout)
            return stdout.read().decode('utf-8', errors='replace')
        except Exception as e:
            print(f'  [SSH] Command error ({server_id}): {e}')
            with self._lock:
                if server_id in self._connections:
                    try:
                        self._connections[server_id].close()
                    except:
                        pass
                    del self._connections[server_id]
            return None

    def test_connection(self, server_id):
        return self.get_connection(server_id) is not None

    def close_all(self):
        with self._lock:
            for c in self._connections.values():
                try:
                    c.close()
                except:
                    pass
            self._connections.clear()


ssh = SSHManager()

# =============================================================================
# Data Collectors
# =============================================================================

def _parse_sections(output):
    sections = {}
    current = None
    lines = []
    for line in output.strip().split('\n'):
        if line.startswith(':::') and line.endswith(':::'):
            if current:
                sections[current] = '\n'.join(lines)
            current = line.strip(':')
            lines = []
        else:
            lines.append(line)
    if current:
        sections[current] = '\n'.join(lines)
    return sections


def collect_health(server_id):
    global prev_cpu_stats
    cmd = (
        "echo ':::CPU:::' && head -1 /proc/stat && "
        "echo ':::MEM:::' && free | grep Mem && "
        "echo ':::DISK:::' && df -h / | tail -1 && "
        "echo ':::UPTIME:::' && cat /proc/uptime && "
        "echo ':::LOAD:::' && cat /proc/loadavg"
    )
    output = ssh.execute(server_id, cmd)
    base = {
        'server_id': server_id,
        'name': SERVERS[server_id]['name'],
        'host': SERVERS[server_id]['host'],
        'role': SERVERS[server_id]['role'],
    }
    if output is None:
        base['status'] = 'offline'
        return base

    base['status'] = 'online'
    s = _parse_sections(output)

    # CPU
    try:
        parts = s.get('CPU', '').strip().split()
        vals = [int(x) for x in parts[1:] if x.isdigit()]
        if len(vals) >= 5:
            idle = vals[3] + vals[4]
            total = sum(vals)
            if server_id in prev_cpu_stats:
                pi, pt = prev_cpu_stats[server_id]
                di, dt = idle - pi, total - pt
                base['cpu'] = round((1 - di / dt) * 100, 1) if dt > 0 else 0.0
            else:
                base['cpu'] = round((1 - idle / total) * 100, 1) if total > 0 else 0.0
            prev_cpu_stats[server_id] = (idle, total)
        else:
            base['cpu'] = 0.0
    except:
        base['cpu'] = 0.0

    # Memory
    try:
        parts = s.get('MEM', '').strip().split()
        total_mem = int(parts[1])
        used_mem = int(parts[2])
        base['mem_total_mb'] = round(total_mem / 1024, 0)
        base['mem_used_mb'] = round(used_mem / 1024, 0)
        base['mem_percent'] = round(used_mem / total_mem * 100, 1) if total_mem > 0 else 0
    except:
        base['mem_total_mb'] = base['mem_used_mb'] = base['mem_percent'] = 0

    # Disk
    try:
        parts = s.get('DISK', '').strip().split()
        base['disk_total'] = parts[1]
        base['disk_used'] = parts[2]
        base['disk_percent'] = float(parts[4].rstrip('%'))
    except:
        base['disk_total'] = base['disk_used'] = '0'
        base['disk_percent'] = 0

    # Uptime
    try:
        secs = float(s.get('UPTIME', '0').strip().split()[0])
        d = int(secs // 86400)
        h = int((secs % 86400) // 3600)
        m = int((secs % 3600) // 60)
        base['uptime'] = f"{d}d {h}h {m}m" if d else (f"{h}h {m}m" if h else f"{m}m")
    except:
        base['uptime'] = 'N/A'

    # Load
    try:
        parts = s.get('LOAD', '').strip().split()
        base['load'] = [float(parts[0]), float(parts[1]), float(parts[2])]
    except:
        base['load'] = [0, 0, 0]

    return base


def collect_services(server_id):
    svcs = SERVERS[server_id]['services']
    svc_str = ' '.join(svcs)
    cmd = f"for s in {svc_str}; do echo \"$s:$(systemctl is-active $s 2>/dev/null)\"; done"
    output = ssh.execute(server_id, cmd)
    if output is None:
        return {s: 'unknown' for s in svcs}
    result = {}
    for line in output.strip().split('\n'):
        if ':' in line:
            k, v = line.split(':', 1)
            result[k.strip()] = v.strip()
    for s in svcs:
        if s not in result:
            result[s] = 'unknown'
    return result


def collect_security_summary():
    results = {
        'fail2ban_total_bans': 0,
        'fail2ban_ips': [],
        'waf_blocks': 0,
        'ids_alerts': 0,
        'ufw_blocks': 0,
        'per_server': {},
    }

    def fetch_server(sid):
        parts = [
            "echo ':::F2B:::' && (fail2ban-client status sshd 2>/dev/null | grep 'Currently banned' || echo '0')",
            "echo ':::F2BIP:::' && (fail2ban-client status sshd 2>/dev/null | grep 'Banned IP' || echo '')",
            "echo ':::UFW:::' && (grep -c 'UFW BLOCK' /var/log/ufw.log 2>/dev/null || echo '0')",
        ]
        if sid == 'lb':
            parts.append("echo ':::WAF:::' && (grep -c 'ModSecurity' /var/log/apache2/modsec_audit.log 2>/dev/null || echo '0')")
            parts.append("echo ':::IDS:::' && (wc -l < /var/log/suricata/fast.log 2>/dev/null || echo '0')")

        output = ssh.execute(sid, ' && '.join(parts))
        srv = {'fail2ban_bans': 0, 'fail2ban_ips': [], 'ufw_blocks': 0, 'waf_blocks': 0, 'ids_alerts': 0}
        if output is None:
            return sid, srv
        sec = _parse_sections(output)
        try:
            for w in sec.get('F2B', '').split():
                if w.isdigit():
                    srv['fail2ban_bans'] = int(w)
                    break
        except:
            pass
        try:
            line = sec.get('F2BIP', '').strip()
            if 'Banned IP list:' in line:
                ips_str = line.split('Banned IP list:')[1].strip()
                if ips_str:
                    srv['fail2ban_ips'] = [ip.strip() for ip in ips_str.split() if ip.strip()]
        except:
            pass
        try:
            srv['ufw_blocks'] = int(sec.get('UFW', '0').strip())
        except:
            pass
        try:
            srv['waf_blocks'] = int(sec.get('WAF', '0').strip())
        except:
            pass
        try:
            srv['ids_alerts'] = int(sec.get('IDS', '0').strip())
        except:
            pass
        return sid, srv

    thread_results = {}

    def worker(sid):
        thread_results[sid] = fetch_server(sid)

    threads = [threading.Thread(target=worker, args=(sid,)) for sid in SERVERS]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=12)

    for sid in SERVERS:
        if sid in thread_results:
            _, srv = thread_results[sid]
        else:
            srv = {'fail2ban_bans': 0, 'fail2ban_ips': [], 'ufw_blocks': 0, 'waf_blocks': 0, 'ids_alerts': 0}
        results['per_server'][sid] = srv
        results['fail2ban_total_bans'] += srv['fail2ban_bans']
        for ip in srv['fail2ban_ips']:
            results['fail2ban_ips'].append({
                'ip': ip,
                'server_id': sid,
                'server': SERVERS[sid]['name']
            })
        results['ufw_blocks'] += srv['ufw_blocks']
        results['waf_blocks'] += srv['waf_blocks']
        results['ids_alerts'] += srv['ids_alerts']

    return results


def collect_security_events():
    events = []
    for sid in SERVERS:
        output = ssh.execute(sid, "tail -20 /var/log/fail2ban.log 2>/dev/null | grep -E 'Ban|Unban' | tail -5")
        if output:
            for line in output.strip().split('\n'):
                if line.strip():
                    events.append({
                        'source': 'fail2ban',
                        'server': SERVERS[sid]['name'],
                        'server_id': sid,
                        'message': line.strip(),
                        'severity': 'danger' if 'Ban ' in line and 'Unban' not in line else 'warning',
                    })

    output = ssh.execute('lb', "grep -a -E 'id \"[0-9]+\"' /var/log/apache2/modsec_audit.log 2>/dev/null | tail -5")
    if output:
        for line in output.strip().split('\n'):
            if line.strip():
                events.append({'source': 'waf', 'server': 'Load Balancer', 'server_id': 'lb',
                                'message': line.strip()[:200], 'severity': 'danger'})

    output = ssh.execute('lb', "tail -5 /var/log/suricata/fast.log 2>/dev/null")
    if output:
        for line in output.strip().split('\n'):
            if line.strip():
                events.append({'source': 'suricata', 'server': 'Load Balancer', 'server_id': 'lb',
                                'message': line.strip()[:200], 'severity': 'warning'})

    for sid in SERVERS:
        output = ssh.execute(sid, "grep 'UFW BLOCK' /var/log/ufw.log 2>/dev/null | tail -3")
        if output:
            for line in output.strip().split('\n'):
                if line.strip():
                    events.append({'source': 'ufw', 'server': SERVERS[sid]['name'], 'server_id': sid,
                                   'message': line.strip()[:200], 'severity': 'info'})

    return events[-30:]


def collect_logs(server_id, log_type, lines=LOG_LINES):
    logs = SERVERS.get(server_id, {}).get('logs', {})
    if log_type not in logs:
        return {'lines': [f'[Log type "{log_type}" tidak tersedia]'], 'server': server_id, 'log_type': log_type}
    path = logs[log_type]
    output = ssh.execute(server_id, f"tail -n {lines} {path} 2>/dev/null || echo '[File tidak ditemukan: {path}]'")
    if output is None:
        return {'lines': ['[Koneksi SSH gagal]'], 'server': server_id, 'log_type': log_type, 'path': path}
    return {
        'lines': [l for l in output.strip().split('\n') if l],
        'server': server_id,
        'log_type': log_type,
        'path': path,
    }


def collect_lb_stats():
    def get_count(sid):
        out = ssh.execute(sid, "wc -l < /var/log/apache2/access.log 2>/dev/null || echo 0")
        try:
            return int(out.strip()) if out else 0
        except:
            return 0
    w1, w2 = get_count('web1'), get_count('web2')
    total = w1 + w2
    return {
        'web1_count': w1, 'web2_count': w2, 'total': total,
        'web1_pct': round(w1 / total * 100, 1) if total > 0 else 50.0,
        'web2_pct': round(w2 / total * 100, 1) if total > 0 else 50.0,
    }


def collect_all_servers():
    results = {}
    lock = threading.Lock()

    def worker(sid):
        health = collect_health(sid)
        services = collect_services(sid)
        with lock:
            results[sid] = {**health, 'services': services}

    threads = [threading.Thread(target=worker, args=(sid,)) for sid in SERVERS]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=12)

    for sid in SERVERS:
        if sid not in results:
            results[sid] = {
                'server_id': sid, 'name': SERVERS[sid]['name'],
                'host': SERVERS[sid]['host'], 'role': SERVERS[sid]['role'],
                'status': 'offline',
                'services': {s: 'unknown' for s in SERVERS[sid]['services']},
            }
    return results


def build_server_config():
    return {
        sid: {
            'name': srv['name'],
            'host': srv['host'],
            'role': srv['role'],
            'services': srv['services'],
            'log_types': list(srv['logs'].keys()),
        }
        for sid, srv in SERVERS.items()
    }


# =============================================================================
# WebSocket Events
# =============================================================================

@socketio.on('connect')
def handle_connect():
    print('  [WS] Client connected')
    # Send server config immediately
    emit('server_config', {'config': build_server_config(), 'server_order': SERVER_ORDER})
    # Send initial snapshot (async in background so connect doesn't block)
    socketio.start_background_task(send_initial_snapshot)


def send_initial_snapshot():
    servers = collect_all_servers()
    security = collect_security_summary()
    events = collect_security_events()
    lb = collect_lb_stats()
    socketio.emit('server_update', {
        'servers': servers,
        'server_order': SERVER_ORDER,
        'timestamp': datetime.now().strftime('%H:%M:%S'),
    })
    socketio.emit('security_update', security)
    socketio.emit('security_events', {'events': events})
    socketio.emit('lb_update', lb)


@socketio.on('disconnect')
def handle_disconnect():
    print('  [WS] Client disconnected')


@socketio.on('request_logs')
def handle_request_logs(data):
    server_id = data.get('server_id', '')
    log_type = data.get('log_type', '')
    if server_id not in SERVERS:
        emit('log_data', {'lines': ['[Server tidak valid]'], 'server': server_id, 'log_type': log_type})
        return
    result = collect_logs(server_id, log_type)
    emit('log_data', result)

@socketio.on('unban_ip')
def handle_unban_ip(data):
    server_id = data.get('server_id')
    ip = data.get('ip')
    if server_id in SERVERS and ip:
        print(f"  [WS] Unbanning IP {ip} on {SERVERS[server_id]['name']}")
        ssh.execute(server_id, f"fail2ban-client set sshd unbanip {ip}")
        # Force a broadcast to update UI immediately
        socketio.start_background_task(send_initial_snapshot)


# =============================================================================
# Background Broadcast Thread
# =============================================================================

def background_broadcaster():
    """Runs forever: collects data and broadcasts to all connected clients every EMIT_INTERVAL seconds."""
    print(f'  [BG] Background broadcaster started (interval: {EMIT_INTERVAL}s)')
    # Stagger security collection (every 3 cycles = 9s to reduce SSH load)
    cycle = 0
    while True:
        try:
            servers = collect_all_servers()
            socketio.emit('server_update', {
                'servers': servers,
                'server_order': SERVER_ORDER,
                'timestamp': datetime.now().strftime('%H:%M:%S'),
            })

            if cycle % 3 == 0:
                security = collect_security_summary()
                events = collect_security_events()
                socketio.emit('security_update', security)
                socketio.emit('security_events', {'events': events})

            if cycle % 5 == 0:
                lb = collect_lb_stats()
                socketio.emit('lb_update', lb)

            cycle += 1
        except Exception as e:
            print(f'  [BG] Broadcast error: {e}')

        eventlet.sleep(EMIT_INTERVAL)


# =============================================================================
# Flask Routes (serve React build in production)
# =============================================================================

@app.route('/')
def index():
    dist = os.path.join(BASE_DIR, 'frontend', 'dist')
    if os.path.exists(os.path.join(dist, 'index.html')):
        return send_from_directory(dist, 'index.html')
    return '''
    <html><body style="font-family:monospace;background:#0a0e1a;color:#94a3b8;padding:40px">
    <h2 style="color:#00d4ff">ARKAMUAS Monitor — Backend Running ✓</h2>
    <p>Frontend belum di-build. Jalankan:</p>
    <pre style="background:#111827;padding:16px;border-radius:8px">
cd frontend
npm install
npm run dev    ← development (port 5173)
npm run build  ← production build
    </pre>
    <p>WebSocket siap di <strong>ws://localhost:5000</strong></p>
    </body></html>
    '''


@app.route('/<path:path>')
def serve_static(path):
    dist = os.path.join(BASE_DIR, 'frontend', 'dist')
    file_path = os.path.join(dist, path)
    if os.path.exists(file_path):
        return send_from_directory(dist, path)
    return send_from_directory(dist, 'index.html')


# =============================================================================
# Startup
# =============================================================================

def print_banner():
    print()
    print('  ╔══════════════════════════════════════════════════╗')
    print('  ║  ARKAMUAS Infrastructure Monitor v2.0           ║')
    print('  ║  WebSocket Real-time + React + shadcn/ui         ║')
    print('  ╚══════════════════════════════════════════════════╝')
    print()


def startup():
    global SSH_PASSWORD
    print_banner()
    print('  Server yang dimonitor:')
    for sid, srv in SERVERS.items():
        print(f'    • {srv["name"]:20s} → {srv["host"]}')
    print()

    SSH_PASSWORD = getpass.getpass('  Password SSH (root): ')
    print()
    print('  [SSH] Testing koneksi...')

    all_ok = True
    for sid, srv in SERVERS.items():
        ok = ssh.test_connection(sid)
        mark = '✓' if ok else '✗'
        print(f'    {mark} {srv["name"]:20s} ({srv["host"]}){" — GAGAL" if not ok else ""}')
        if not ok:
            all_ok = False

    print()
    if not all_ok:
        print('  [!] Beberapa server tidak bisa diakses (akan ditampilkan sebagai offline).')
        print()

    ans = input('  Start dashboard? (y/n) [y]: ').strip().lower()
    if ans == 'n':
        print('  Dibatalkan.')
        ssh.close_all()
        sys.exit(0)

    print()
    print('  ✓ Dashboard: http://localhost:5000')
    print('  ✓ WebSocket: ws://localhost:5000')
    print('  ✓ Tekan Ctrl+C untuk stop')
    print()


if __name__ == '__main__':
    startup()
    # Start background broadcaster
    socketio.start_background_task(background_broadcaster)
    try:
        socketio.run(app, host='0.0.0.0', port=5000, debug=False)
    except KeyboardInterrupt:
        print('\n  Shutting down...')
    finally:
        ssh.close_all()
        print('  ✓ Done.')
