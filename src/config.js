export const DEFAULT_CONFIG = {
  // URL de base du projet (sans slash final). Si vide, prise automatiquement depuis la page.
  // Ex. XAMPP même PC: "http://localhost/Hackaton%20projet%20Crop%20care"
  // Ex. PC sur le réseau (pour CORS si besoin): "http://192.168.1.20/Hackaton%20projet%20Crop%20care"
  apiBaseUrl: "",
  // "mock" = démo sans capteurs. "api" = données depuis l'API PHP (latest + history)
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

