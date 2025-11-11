import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Terminal } from 'lucide-react';
import { socket } from "@/lib/socket";

interface LogViewerProps {
  serverConfig: Record<string, any>;
  serverOrder: string[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ serverConfig, serverOrder }) => {
  const [activeTab, setActiveTab] = useState<string>('');
  const [logLines, setLogLines] = useState<string[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate tabs based on server config
  const tabs: { id: string; label: string; serverId: string; logType: string }[] = [];
  serverOrder.forEach(sid => {
    const srv = serverConfig[sid];
    if (srv && srv.log_types) {
      srv.log_types.forEach((logType: string) => {
        tabs.push({
          id: `${sid}:${logType}`,
          label: `${sid}:${logType}`,
          serverId: sid,
          logType: logType
        });
      });
    }
  });

  useEffect(() => {
    if (tabs.length > 0 && !activeTab) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    const handleLogData = (data: any) => {
      if (`${data.server}:${data.log_type}` === activeTab) {
        setLogLines(data.lines || []);
      }
    };
    
    socket.on('log_data', handleLogData);
    return () => { socket.off('log_data', handleLogData); };
  }, [activeTab]);

  // Request logs every 3 seconds for active tab
  useEffect(() => {
    if (!activeTab) return;
    const [serverId, logType] = activeTab.split(':');
    
    const fetchLogs = () => {
      socket.emit('request_logs', { server_id: serverId, log_type: logType });
    };
    
    fetchLogs(); // Initial fetch
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = 0;
    }
  }, [logLines, autoScroll]);

  return (
    <Card className="col-span-full xl:col-span-2 flex flex-col h-full border-primary/20">
      <CardHeader className="py-4 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Live Log Viewer
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <input 
              type="checkbox" 
              id="autoscroll" 
              checked={autoScroll} 
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-muted border-muted-foreground/30 text-primary focus:ring-primary"
            />
            <label htmlFor="autoscroll" className="cursor-pointer select-none">Auto-scroll</label>
          </div>
        </div>
      </CardHeader>
      
      {tabs.length > 0 && (
        <div className="px-4 pt-4 overflow-x-auto no-scrollbar">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="h-auto flex-wrap justify-start bg-transparent p-0 gap-1">
              {tabs.map(tab => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs py-1.5 px-3 rounded-full border border-border bg-muted/50"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <CardContent className="flex-1 p-0 mt-4 min-h-[300px] bg-[#0a0e1a]">
        <ScrollArea className="h-full w-full" ref={scrollRef as any}>
          <div className="p-4 font-mono text-[11px] leading-relaxed text-slate-300">
            {logLines.length === 0 ? (
              <span className="text-muted-foreground">Memuat log...</span>
            ) : (
              [...logLines].reverse().map((line, i) => (
                <div key={i} className="hover:bg-white/5 break-all">{line}</div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
