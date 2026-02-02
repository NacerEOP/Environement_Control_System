export const DEFAULT_CONFIG = {
  // Mets ici l'URL de ton backend (ex: "http://localhost/cropcare-api" ou "http://localhost:8000")
  apiBaseUrl: "",
  // "mock" pour afficher une démo sans backend, "api" pour fetch depuis ton API
  dataMode: "mock",
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

