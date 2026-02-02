import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LucideIcon } from "lucide-react";

interface ControlCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  isActive: boolean;
  onToggle: () => void;
  runtime?: string;
}

export function ControlCard({ title, description, icon: Icon, isActive, onToggle, runtime }: ControlCardProps) {
  return (
    <Card className={`transition-all ${isActive ? "border-blue-500 bg-blue-50/50" : ""}`}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${isActive ? "bg-blue-500 text-white" : "bg-gray-100"}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor={`switch-${title}`} className="text-sm">
              Status: <span className={isActive ? "text-blue-600 font-medium" : "text-gray-500"}>
                {isActive ? "Active" : "Inactive"}
              </span>
            </Label>
            {runtime && isActive && (
              <p className="text-xs text-muted-foreground">Runtime: {runtime}</p>
            )}
          </div>
          <Switch
            id={`switch-${title}`}
            checked={isActive}
            onCheckedChange={onToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
}
