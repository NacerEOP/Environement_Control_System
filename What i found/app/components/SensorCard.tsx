import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface SensorCardProps {
  title: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  status: "normal" | "warning" | "critical";
  min?: number;
  max?: number;
}

export function SensorCard({ title, value, unit, icon: Icon, status, min, max }: SensorCardProps) {
  const statusColors = {
    normal: "text-green-600 bg-green-50 border-green-200",
    warning: "text-yellow-600 bg-yellow-50 border-yellow-200",
    critical: "text-red-600 bg-red-50 border-red-200",
  };

  const statusDotColors = {
    normal: "bg-green-500",
    warning: "bg-yellow-500",
    critical: "bg-red-500",
  };

  return (
    <Card className={`border-2 ${statusColors[status]}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">
            {value.toFixed(1)}
          </div>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
        {(min !== undefined || max !== undefined) && (
          <div className="mt-2 text-xs text-muted-foreground">
            Range: {min?.toFixed(0)} - {max?.toFixed(0)} {unit}
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusDotColors[status]} animate-pulse`} />
          <span className="text-xs capitalize">{status}</span>
        </div>
      </CardContent>
    </Card>
  );
}
