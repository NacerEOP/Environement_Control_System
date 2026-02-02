import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, Droplets, Wind, CloudRain } from "lucide-react";

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  forecast: string;
}

interface WeatherCardProps {
  weather: WeatherData;
}

export function WeatherCard({ weather }: WeatherCardProps) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Weather Conditions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-2">
              <Cloud className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="text-lg font-semibold">{weather.temperature}°C</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-2">
              <Droplets className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Humidity</p>
              <p className="text-lg font-semibold">{weather.humidity}%</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-2">
              <Wind className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Wind Speed</p>
              <p className="text-lg font-semibold">{weather.windSpeed} km/h</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white p-2">
              <CloudRain className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Condition</p>
              <p className="text-lg font-semibold">{weather.condition}</p>
            </div>
          </div>
        </div>
        
        <div className="mt-4 rounded-lg bg-white p-3">
          <p className="text-xs text-muted-foreground mb-1">24h Forecast</p>
          <p className="text-sm">{weather.forecast}</p>
        </div>
      </CardContent>
    </Card>
  );
}
