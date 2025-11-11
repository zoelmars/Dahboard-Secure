import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SecuritySummary, SecurityEvent } from "@/types/server";
import { Shield, ShieldAlert, ShieldBan, ShieldCheck, Unlock } from 'lucide-react';
import { socket } from "@/lib/socket";

export const SecurityPanel: React.FC<{ summary: SecuritySummary | null, events: SecurityEvent[] }> = ({ summary, events }) => {
  
  const handleUnban = (server_id: string, ip: string) => {
    if (confirm(`Apakah Anda yakin ingin melakukan unban pada IP ${ip}?`)) {
      socket.emit('unban_ip', { server_id, ip });
    }
  };
  const StatBox = ({ title, value, icon: Icon, color }: any) => (
    <div className="flex items-center p-4 bg-muted/30 rounded-lg border">
      <div className={`p-3 rounded-md mr-4 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value || 0}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider">{title}</div>
      </div>
    </div>
  );

  return (
    <Card className="col-span-full xl:col-span-1 border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-destructive" />
          Security Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-4">
          <StatBox title="Fail2ban Bans" value={summary?.fail2ban_total_bans} icon={ShieldBan} color="bg-red-500/20 text-red-500" />
          <StatBox title="WAF Blocks" value={summary?.waf_blocks} icon={ShieldAlert} color="bg-amber-500/20 text-amber-500" />
          <StatBox title="IDS Alerts" value={summary?.ids_alerts} icon={ShieldAlert} color="bg-purple-500/20 text-purple-500" />
          <StatBox title="UFW Blocks" value={summary?.ufw_blocks} icon={ShieldCheck} color="bg-emerald-500/20 text-emerald-500" />
        </div>

        <div>
          <Tabs defaultValue="events" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-2 bg-muted/50">
              <TabsTrigger value="events">Recent Events</TabsTrigger>
              <TabsTrigger value="banned">Banned IPs ({summary?.fail2ban_ips?.length || 0})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="events" className="m-0">
              <div className="rounded-md border bg-muted/10 h-[260px] overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableBody>
                      {events.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                            Belum ada event terdeteksi.
                          </TableCell>
                        </TableRow>
                      ) : (
                        [...events].reverse().map((ev, i) => (
                          <TableRow key={i} className="group">
                            <TableCell className="w-[100px] align-top py-3">
                              <Badge variant={ev.severity === 'danger' ? 'destructive' : ev.severity === 'warning' ? 'warning' : 'info'} className="text-[10px]">
                                {ev.source.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">
                              {ev.message}
                            </TableCell>
                            <TableCell className="text-right py-3 align-top">
                              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded">{ev.server}</span>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="banned" className="m-0">
              <div className="rounded-md border bg-muted/10 h-[260px] overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableBody>
                      {!summary?.fail2ban_ips || summary.fail2ban_ips.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                            Tidak ada IP yang di-ban.
                          </TableCell>
                        </TableRow>
                      ) : (
                        summary.fail2ban_ips.map((item, i) => (
                          <TableRow key={i} className="group">
                            <TableCell className="w-[100px] py-3">
                              <Badge variant="destructive" className="text-[10px]">BANNED</Badge>
                            </TableCell>
                            <TableCell className="py-3 font-mono text-sm text-red-400 font-bold">
                              {item.ip}
                            </TableCell>
                            <TableCell className="py-3 text-xs text-muted-foreground">
                              {item.server}
                            </TableCell>
                            <TableCell className="text-right py-3">
                              <button 
                                onClick={() => handleUnban(item.server_id, item.ip)}
                                className="inline-flex items-center gap-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground px-2 py-1 rounded text-xs transition-colors"
                              >
                                <Unlock className="h-3 w-3" /> Unban
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
};
