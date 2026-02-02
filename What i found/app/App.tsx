import { useEffect, useMemo, useState } from "react";
import { Thermometer, Droplets, Sun, Lightbulb, Droplet, Sprout } from "lucide-react";
import { SensorCard } from "@/components/SensorCard";
import { ControlCard } from "@/components/ControlCard";
import { WeatherCard } from "@/components/WeatherCard";
import { SensorChart } from "@/components/SensorChart";
import { SystemStatus } from "@/components/SystemStatus";

interface SensorData {
  temperature: number | null;
  humidity: number | null;
  luminosity: number | null;
}

interface HistoryPoint {
  time: string;
  temperature: number;
  humidity: number;
  luminosity: number;
}

// Base URL de ton backend PHP/XAMPP (chemin absolu HTTP).
// On laisse l'hôte vide pour que:
// - en dev: Vite (/Hackaton%20projet%20Crop%20Care/api/...) proxie vers Apache (port 80)
// - en prod (servi par Apache): le chemin absolu reste valide.
const API_BASE = "/Hackaton%20projet%20Crop%20Care/api";

async function fetchLatest() {
  const res = await fetch(`${API_BASE}/latest`, { cache: "no-store" });
  if (!res.ok) throw new Error(`latest HTTP ${res.status}`);
  const json = await res.json();
  return {
    temperature: typeof json.temperature === "number" ? json.temperature : null,
    humidity: typeof json.humidity === "number" ? json.humidity : null,
    soil: typeof json.soil === "number" ? json.soil : null,
    light: typeof json.light === "number" ? json.light : null,
    at: typeof json.at === "string" ? json.at : null,
  };
}

async function fetchHistory(range: "1h" | "24h" | "7d" = "24h"): Promise<HistoryPoint[]> {
  const res = await fetch(`${API_BASE}/history?range=${range}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`history HTTP ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json)) return [];
  return json
    .map((p: any) => {
      const at = typeof p.at === "string" ? p.at : null;
      const date = at ? new Date(at) : null;
      const label = date
        ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";
      return {
        time: label,
        temperature: typeof p.temperature === "number" ? p.temperature : NaN,
        humidity: typeof p.humidity === "number" ? p.humidity : NaN,
        luminosity: typeof p.light === "number" ? p.light : NaN,
      };
    })
    .filter((p) => !Number.isNaN(p.temperature) && !Number.isNaN(p.humidity) && !Number.isNaN(p.luminosity));
}

export default function App() {
  const [sensorData, setSensorData] = useState<SensorData>({
    temperature: null,
    humidity: null,
    luminosity: null,
  });

  const [historicalData, setHistoricalData] = useState<HistoryPoint[]>([]);
  const [online, setOnline] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<string>("—");

  const [uvLightActive, setUvLightActive] = useState(false);
  const [pumpActive, setPumpActive] = useState(false);
  const [uvRuntime, setUvRuntime] = useState(0);
  const [pumpRuntime, setPumpRuntime] = useState(0);

  const [weatherData, setWeatherData] = useState({
    temperature: 0,
    humidity: 0,
    windSpeed: 0,
    condition: "—",
    forecast: "Loading weather forecast...",
  });

  // Fetch historique au chargement
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchHistory("24h");
        if (!cancelled) setHistoricalData(data);
      } catch (e) {
        console.error("[CropCare] history error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Polling temps réel capteurs
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const latest = await fetchLatest();
        if (cancelled) return;
        setSensorData({
          temperature: latest.temperature,
          humidity: latest.humidity,
          luminosity: latest.light,
        });
        setLastUpdate(
          latest.at
            ? new Date(latest.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : new Date().toLocaleTimeString()
        );
        setOnline(true);
      } catch (e) {
        console.error("[CropCare] latest error", e);
        if (!cancelled) setOnline(false);
      }
    };

    // premier fetch immédiat
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Weather (Open‑Meteo simple, Alger par défaut)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=36.73225&longitude=3.08746&timezone=Africa%2FAlgiers&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code";
        const res = await fetch(url);
        if (!res.ok) throw new Error(`weather HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const cur = json.current || {};
        setWeatherData({
          temperature: typeof cur.temperature_2m === "number" ? cur.temperature_2m : 0,
          humidity: typeof cur.relative_humidity_2m === "number" ? cur.relative_humidity_2m : 0,
          windSpeed: typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : 0,
          condition: "Current conditions",
          forecast: "Live data fetched from Open‑Meteo for Alger, updated frequently.",
        });
      } catch (e) {
        console.error("[CropCare] weather error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Runtime UV
  useEffect(() => {
    if (!uvLightActive) {
      setUvRuntime(0);
      return;
    }
    const id = setInterval(() => setUvRuntime((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [uvLightActive]);

  // Runtime pompe
  useEffect(() => {
    if (!pumpActive) {
      setPumpRuntime(0);
      return;
    }
    const id = setInterval(() => setPumpRuntime((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [pumpActive]);

  const formatRuntime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getTemperatureStatus = (temp: number | null) => {
    if (temp == null) return "normal";
    if (temp < 18 || temp > 30) return "critical";
    if (temp < 20 || temp > 28) return "warning";
    return "normal";
  };

  const getHumidityStatus = (humidity: number | null) => {
    if (humidity == null) return "normal";
    if (humidity < 40 || humidity > 85) return "critical";
    if (humidity < 50 || humidity > 75) return "warning";
    return "normal";
  };

  const getLuminosityStatus = (lux: number | null) => {
    if (lux == null) return "normal";
    if (lux < 6000 || lux > 11000) return "critical";
    if (lux < 7000 || lux > 10000) return "warning";
    return "normal";
  };

  const activeAlerts = useMemo(
    () =>
      [
        getTemperatureStatus(sensorData.temperature),
        getHumidityStatus(sensorData.humidity),
        getLuminosityStatus(sensorData.luminosity),
      ].filter((status) => status !== "normal").length,
    [sensorData]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="rounded-lg bg-green-600 p-3">
            <Sprout className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Crop Monitoring Dashboard</h1>
            <p className="text-gray-600">IoT Environmental Control System (ESP32 + PHP API)</p>
          </div>
        </div>

        {/* Sensor Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SensorCard
            title="Temperature"
            value={sensorData.temperature ?? 0}
            unit="°C"
            icon={Thermometer}
            status={getTemperatureStatus(sensorData.temperature) as any}
            min={20}
            max={28}
          />
          <SensorCard
            title="Humidity"
            value={sensorData.humidity ?? 0}
            unit="%"
            icon={Droplets}
            status={getHumidityStatus(sensorData.humidity) as any}
            min={50}
            max={75}
          />
          <SensorCard
            title="Luminosity"
            value={sensorData.luminosity ?? 0}
            unit="lux"
            icon={Sun}
            status={getLuminosityStatus(sensorData.luminosity) as any}
            min={7000}
            max={10000}
          />
        </div>

        {/* Chart and System Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <SensorChart data={historicalData} />
          </div>
          <div className="space-y-4">
            <SystemStatus isOnline={online} lastUpdate={lastUpdate} alerts={activeAlerts} />
            <WeatherCard weather={weatherData} />
          </div>
        </div>

        {/* Equipment Controls (toujours locaux côté UI) */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">Equipment Control</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ControlCard
              title="UV Light"
              description="Growth-enhancing ultraviolet lighting"
              icon={Lightbulb}
              isActive={uvLightActive}
              onToggle={() => setUvLightActive((v) => !v)}
              runtime={uvLightActive ? formatRuntime(uvRuntime) : undefined}
            />
            <ControlCard
              title="Water Pump"
              description="Automated irrigation system"
              icon={Droplet}
              isActive={pumpActive}
              onToggle={() => setPumpActive((v) => !v)}
              runtime={pumpActive ? formatRuntime(pumpRuntime) : undefined}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex flex-wrap gap-6 text-sm text-gray-600">
            <div>
              <span className="font-medium">Optimal Temperature:</span> 20-28°C
            </div>
            <div>
              <span className="font-medium">Optimal Humidity:</span> 50-75%
            </div>
            <div>
              <span className="font-medium">Optimal Light:</span> 7000-10000 lux
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
