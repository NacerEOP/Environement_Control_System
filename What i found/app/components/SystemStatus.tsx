import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertCircle, CheckCircle2, Wifi } from "lucide-react";

interface SystemStatusProps {
  isOnline: boolean;
  lastUpdate: string;
  alerts: number;
}

export function SystemStatus({ isOnline, lastUpdate, alerts }: SystemStatusProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Connection</span>
          <div className="flex items-center gap-2">
            <Wifi className={`h-4 w-4 ${isOnline ? "text-green-600" : "text-red-600"}`} />
            <span className={`text-sm font-medium ${isOnline ? "text-green-600" : "text-red-600"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Last Update</span>
          <span className="text-sm font-medium">{lastUpdate}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Active Alerts</span>
          <div className="flex items-center gap-2">
            {alerts > 0 ? (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-600">{alerts}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">None</span>
              </>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            All systems operational
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
