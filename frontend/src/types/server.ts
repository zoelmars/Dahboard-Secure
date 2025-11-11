export interface ServerInfo {
  server_id: string;
  name: string;
  host: string;
  role: string;
  status: 'online' | 'offline';
  cpu?: number;
  mem_total_mb?: number;
  mem_used_mb?: number;
  mem_percent?: number;
  disk_total?: string;
  disk_used?: string;
  disk_percent?: number;
  uptime?: string;
  load?: [number, number, number];
  services: Record<string, string>;
}

export interface SecuritySummary {
  fail2ban_total_bans: number;
  fail2ban_ips: Array<{ip: string, server_id: string, server: string}>;
  waf_blocks: number;
  ids_alerts: number;
  ufw_blocks: number;
  per_server: Record<string, any>;
}

export interface SecurityEvent {
  source: string;
  server: string;
  server_id: string;
  message: string;
  severity: 'danger' | 'warning' | 'info';
}

export interface LBStats {
  web1_count: number;
  web2_count: number;
  total: number;
  web1_pct: number;
  web2_pct: number;
}
