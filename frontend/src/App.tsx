import { useState, useEffect } from 'react';
import { socket } from '@/lib/socket';
import { ServerCard } from '@/components/ServerCard';
import { SecurityPanel } from '@/components/SecurityPanel';
import { LogViewer } from '@/components/LogViewer';
import { LBStats } from '@/components/LBStats';
import { ServerInfo, SecuritySummary, SecurityEvent, LBStats as LBStatsType } from '@/types/server';
import { Activity, Radio } from 'lucide-react';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [servers, setServers] = useState<Record<string, ServerInfo>>({});
  const [serverOrder, setServerOrder] = useState<string[]>([]);
  const [serverConfig, setServerConfig] = useState<Record<string, any>>({});
  const [security, setSecurity] = useState<SecuritySummary | null>(null);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [lbStats, setLbStats] = useState<LBStatsType | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--');

  useEffect(() => {
    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    
    socket.on('server_config', (data) => {
      setServerConfig(data.config);
      setServerOrder(data.server_order);
    });

    socket.on('server_update', (data) => {
      setServers(data.servers);
      if (data.server_order) setServerOrder(data.server_order);
      setLastUpdate(data.timestamp);
    });

    socket.on('security_update', (data) => setSecurity(data));
    socket.on('security_events', (data) => setEvents(data.events));
    socket.on('lb_update', (data) => setLbStats(data));

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('server_config');
      socket.off('server_update');
      socket.off('security_update');
      socket.off('security_events');
      socket.off('lb_update');
    };
  }, []);

  const onlineCount = Object.values(servers).filter(s => s.status === 'online').length;
  const totalCount = serverOrder.length;

  return (
    <div className="min-h-screen bg-background text-foreground pb-12 selection:bg-primary/30">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none tracking-tight">DashboardSecure</h1>
              <p className="text-xs text-muted-foreground mt-1">Infrastructure Monitor v2.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Last update:</span>
              <span className="font-mono">{lastUpdate}</span>
            </div>
            
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border">
              <Radio className={`h-4 w-4 ${isConnected ? 'text-emerald-500 animate-pulse' : 'text-destructive'}`} />
              <span className="font-medium">
                {isConnected ? 'Live WebSocket' : 'Disconnected'}
              </span>
            </div>

            {totalCount > 0 && (
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${onlineCount === totalCount ? 'bg-emerald-500' : 'bg-warning'}`}></span>
                <span className="font-medium">{onlineCount}/{totalCount} Online</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container pt-8 space-y-8">
        {/* Server Grid */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            Server Status
            <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{totalCount} nodes</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {serverOrder.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-xl">
                Menunggu konfigurasi server...
              </div>
            ) : (
              serverOrder.map(sid => (
                servers[sid] ? <ServerCard key={sid} server={servers[sid]} /> : (
                  <div key={sid} className="h-[300px] bg-muted/20 animate-pulse rounded-xl border"></div>
                )
              ))
            )}
          </div>
        </div>

        {/* Security & Logs Row */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <SecurityPanel summary={security} events={events} />
          <LogViewer serverConfig={serverConfig} serverOrder={serverOrder} />
        </div>

        {/* LB Stats Row */}
        <div className="grid grid-cols-1">
          <LBStats stats={lbStats} />
        </div>
      </main>
    </div>
  );
}

export default App;
