import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DataPoint {
  time: string;
  temperature: number;
  humidity: number;
  luminosity: number;
}

interface SensorChartProps {
  data: DataPoint[];
}

export function SensorChart({ data }: SensorChartProps) {
  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Sensor Data Trends (Last 24 Hours)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="time" 
              style={{ fontSize: "12px" }}
            />
            <YAxis style={{ fontSize: "12px" }} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "white", 
                border: "1px solid #ccc",
                borderRadius: "8px"
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="temperature" 
              stroke="#ef4444" 
              strokeWidth={2}
              name="Temperature (°C)"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="humidity" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Humidity (%)"
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="luminosity" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="Luminosity (lux)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
