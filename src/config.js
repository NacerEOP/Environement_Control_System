export const DEFAULT_CONFIG = {
  // URL de base de l'API (sans slash final).
  // — Serveur sur ESP32 : mets l'IP de l'ESP (ex. "http://192.168.1.100"). Le dashboard appelle /api/latest et /api/history sur l'ESP.
  // — Page servie par le même Apache (XAMPP) : laisse vide pour détection auto.
  apiBaseUrl: "",
  // "mock" = démo sans capteurs. "api" = données depuis l'API (ESP32 ou PHP)
  dataMode: "api",
  // polling en ms
  pollMs: 5000,
  // météo (Open-Meteo, sans clé)
  weatherEnabled: true,
  // Ville par défaut en Algérie (utilisé pour géocoder -> lat/lon)
  weatherCity: "Alger",
  // seuils d'alertes (peuvent être ajustés)
  weatherThresholds: {
    heatC: 40, // canicule si Tmax >=
    rainMm: 20, // fortes pluies si précip >=
    windKmh: 50, // vent fort si rafales >=
  },
};

export const STORAGE_KEY = "cropcare_dashboard_config_v1";

