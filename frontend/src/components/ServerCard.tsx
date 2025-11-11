import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ServerInfo } from "@/types/server";
import { Server, Activity, HardDrive, Clock, Cpu } from 'lucide-react';

export const ServerCard: React.FC<{ server: ServerInfo }> = ({ server }) => {
  const isOffline = server.status === 'offline';

  const cpuPercent = server.cpu || 0;
  const memPercent = server.mem_percent || 0;
  const diskPercent = server.disk_percent || 0;

  const getGaugeClass = (val: number, base: string) => {
    if (val > 85) return `${base} danger`;
    if (val > 70) return `${base} warning`;
    return base;
  };

  return (
    <Card className={isOffline ? 'opacity-70 border-destructive/50' : ''}>
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            {server.name}
          </CardTitle>
          <div className="text-sm text-muted-foreground mt-1 font-mono">{server.host}</div>
          <div className="text-xs text-muted-foreground mt-1">{server.role}</div>
        </div>
        <Badge variant={isOffline ? "destructive" : "success"}>
          {isOffline ? 'OFFLINE' : 'ONLINE'}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isOffline ? (
          <div className="py-8 text-center text-muted-foreground flex flex-col items-center">
            <Activity className="h-8 w-8 mb-2 opacity-50" />
            <p>Server tidak terjangkau</p>
          </div>
        ) : (
          <>
            <div className="flex justify-around py-2">
              <div className="gauge-container">
                <svg className="gauge-svg" viewBox="0 0 96 96">
                  <circle className="gauge-bg" cx="48" cy="48" r="38" />
                  <circle 
                    className={`gauge-fill ${getGaugeClass(cpuPercent, 'cpu')}`}
                    cx="48" cy="48" r="38"
                    style={{ strokeDasharray: 238.76, strokeDashoffset: 238.76 * (1 - cpuPercent / 100) }}
                  />
                  <g className="gauge-text-group">
                    <text className="gauge-value" x="48" y="44">{cpuPercent.toFixed(1)}%</text>
                    <text className="gauge-label-text" x="48" y="58">CPU</text>
                  </g>
                </svg>
              </div>
              <div className="gauge-container">
                <svg className="gauge-svg" viewBox="0 0 96 96">
                  <circle className="gauge-bg" cx="48" cy="48" r="38" />
                  <circle 
                    className={`gauge-fill ${getGaugeClass(memPercent, 'mem')}`}
                    cx="48" cy="48" r="38"
                    style={{ strokeDasharray: 238.76, strokeDashoffset: 238.76 * (1 - memPercent / 100) }}
                  />
                  <g className="gauge-text-group">
                    <text className="gauge-value" x="48" y="44">{memPercent.toFixed(1)}%</text>
                    <text className="gauge-label-text" x="48" y="58">RAM</text>
                  </g>
                </svg>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs mb-1">
                <span className="flex items-center gap-1 text-muted-foreground"><HardDrive className="h-3 w-3"/> DISK</span>
                <span>{server.disk_used} / {server.disk_total} ({diskPercent}%)</span>
              </div>
              <Progress value={diskPercent} indicatorClassName={diskPercent > 85 ? 'bg-destructive' : diskPercent > 70 ? 'bg-warning' : 'bg-primary'} />
            </div>

            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Services</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(server.services || {}).map(([name, status]) => (
                  <div key={name} className="flex items-center text-sm bg-muted/50 rounded px-2 py-1">
                    <span className={`status-dot ${status === 'active' ? 'active' : 'inactive'}`}></span>
                    <span className="truncate flex-1">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
      
      {!isOffline && (
        <CardFooter className="bg-muted/30 py-3 flex justify-between text-xs text-muted-foreground border-t">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {server.uptime}
          </div>
          <div className="flex items-center gap-1">
            <Cpu className="h-3.5 w-3.5" /> Load: {server.load?.[0]?.toFixed(2)}
          </div>
        </CardFooter>
      )}
    </Card>
  );
};
