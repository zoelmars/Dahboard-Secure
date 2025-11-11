import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LBStats as LBStatsType } from "@/types/server";
import { Network } from 'lucide-react';

export const LBStats: React.FC<{ stats: LBStatsType | null }> = ({ stats }) => {
  return (
    <Card className="col-span-full border-primary/20">
      <CardHeader className="py-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Network className="h-5 w-5 text-primary" />
          Load Balancer Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!stats ? (
          <div className="text-muted-foreground text-sm py-4 text-center">Menunggu data load balancer...</div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Total Requests: <strong className="text-foreground">{stats.total.toLocaleString()}</strong></span>
              <span className="text-xs">Update real-time</span>
            </div>
            
            <div className="grid grid-cols-2 gap-8 relative">
              {/* Web1 */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="font-semibold text-lg text-primary">Web Server 1</div>
                    <div className="text-xs text-muted-foreground">{stats.web1_count.toLocaleString()} reqs</div>
                  </div>
                  <div className="text-2xl font-bold font-mono">{stats.web1_pct}%</div>
                </div>
                <Progress value={stats.web1_pct} className="h-3" />
              </div>

              {/* Web2 */}
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="font-semibold text-lg text-emerald-500">Web Server 2</div>
                    <div className="text-xs text-muted-foreground">{stats.web2_count.toLocaleString()} reqs</div>
                  </div>
                  <div className="text-2xl font-bold font-mono">{stats.web2_pct}%</div>
                </div>
                <Progress value={stats.web2_pct} className="h-3" indicatorClassName="bg-emerald-500" />
              </div>

              {/* VS Divider */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-full p-2 text-xs font-bold text-muted-foreground z-10">
                VS
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
