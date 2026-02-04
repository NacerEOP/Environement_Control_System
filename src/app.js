import { DEFAULT_CONFIG, STORAGE_KEY } from "./config.js";
import { getWeatherIconSvg } from "./weather-icons.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(d) {
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nowIso() {
  return new Date().toISOString();
}

function safeNumber(x, fallback = null) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(cfg) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function fmtDay(isoDate) {
  // iso: YYYY-MM-DD
  try {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
  } catch {
    return isoDate;
  }
}

function toKmh(ms) {
  if (ms == null) return null;
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return n * 3.6;
}

function weatherCodeLabel(code) {
  // Open-Meteo WMO weather interpretation codes (simplified)
  const c = Number(code);
  if (!Number.isFinite(c)) return "—";
  if (c === 0) return "Ciel clair";
  if (c === 1) return "Plutôt clair";
  if (c === 2) return "Partiellement nuageux";
  if (c === 3) return "Couvert";
  if (c === 45 || c === 48) return "Brouillard";
  if ([51, 53, 55].includes(c)) return "Bruine";
  if ([56, 57].includes(c)) return "Bruine verglaçante";
  if ([61, 63, 65].includes(c)) return "Pluie";
  if ([66, 67].includes(c)) return "Pluie verglaçante";
  if ([71, 73, 75].includes(c)) return "Neige";
  if (c === 77) return "Grains de neige";
  if ([80, 81, 82].includes(c)) return "Averses";
  if ([85, 86].includes(c)) return "Averses de neige";
  if (c === 95) return "Orage";
  if ([96, 99].includes(c)) return "Orage + grêle";
  return `Météo (${c})`;
}

async function geocodeCityAlgeria(city) {
  // 1) try geocoding with DZ filter (most reliable)
  const params = new URLSearchParams({
    name: String(city || "").trim(),
    count: "1",
    language: "fr",
    format: "json",
    country_code: "DZ",
  });
  const url = `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (res.ok) {
    const json = await res.json();
    const r = json?.results?.[0];
    if (r) return { name: r.name, lat: r.latitude, lon: r.longitude };
  }

  // 2) fallback: hardcoded coords for common Algerian cities (works even if geocoding is blocked)
  const fallback = {
    Alger: { name: "Alger", lat: 36.73225, lon: 3.08746 },
    Oran: { name: "Oran", lat: 35.69707, lon: -0.6308 },
    Constantine: { name: "Constantine", lat: 36.365, lon: 6.6147 },
    Annaba: { name: "Annaba", lat: 36.9, lon: 7.7667 },
    Blida: { name: "Blida", lat: 36.47, lon: 2.83 },
    Setif: { name: "Sétif", lat: 36.19, lon: 5.41 },
    Tlemcen: { name: "Tlemcen", lat: 34.8783, lon: -1.315 },
  };
  const key = String(city || "").trim();
  if (fallback[key]) return fallback[key];

  throw new Error("Ville introuvable");
}

async function fetchWeeklyWeather({ lat, lon }) {
  // daily: 7-day forecast
  // current: current conditions
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: "Africa/Algiers",
    current: "temperature_2m,weather_code,wind_speed_10m,precipitation",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,weather_code",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
  return await res.json();
}

function computeWeatherAlerts(daily, thresholds) {
  const t = thresholds || {};
  const heatC = Number.isFinite(t.heatC) ? t.heatC : 40;
  const rainMm = Number.isFinite(t.rainMm) ? t.rainMm : 20;
  const windKmh = Number.isFinite(t.windKmh) ? t.windKmh : 50;

  const alerts = [];
  if (!daily?.time?.length) return alerts;

  for (let i = 0; i < daily.time.length; i++) {
    const day = daily.time[i];
    const tmax = safeNumber(daily.temperature_2m_max?.[i]);
    const rain = safeNumber(daily.precipitation_sum?.[i]);
    const gust = safeNumber(daily.wind_gusts_10m_max?.[i]); // km/h from API

    if (tmax != null && tmax >= heatC) {
      alerts.push({
        title: `Risque canicule (${tmax.toFixed(0)}°C)`,
        time: fmtDay(day),
        level: "danger",
      });
    }
    if (rain != null && rain >= rainMm) {
      alerts.push({
        title: `Fortes pluies (${rain.toFixed(0)} mm)`,
        time: fmtDay(day),
        level: "warn",
      });
    }
    if (gust != null && gust >= windKmh) {
      alerts.push({
        title: `Vent fort (rafales ${gust.toFixed(0)} km/h)`,
        time: fmtDay(day),
        level: "warn",
      });
    }
  }

  return alerts.slice(0, 8);
}

function renderWeatherTable(daily) {
  const tbody = $("#weatherTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const n = daily?.time?.length || 0;
  for (let i = 0; i < n; i++) {
    const tr = document.createElement("tr");
    const day = daily.time[i];
    const tmin = safeNumber(daily.temperature_2m_min?.[i]);
    const tmax = safeNumber(daily.temperature_2m_max?.[i]);
    const rain = safeNumber(daily.precipitation_sum?.[i]);
    const wind = safeNumber(daily.wind_speed_10m_max?.[i]);
    const gust = safeNumber(daily.wind_gusts_10m_max?.[i]);
    tr.innerHTML = `
      <td>${fmtDay(day)}</td>
      <td>${tmin != null ? tmin.toFixed(0) : "—"}</td>
      <td>${tmax != null ? tmax.toFixed(0) : "—"}</td>
      <td>${rain != null ? rain.toFixed(0) : "—"}</td>
      <td>${wind != null ? wind.toFixed(0) : "—"}</td>
      <td>${gust != null ? gust.toFixed(0) : "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderWeatherAlerts(alerts) {
  const ul = $("#weatherAlertsList");
  const count = $("#weatherAlertsCount");
  if (!ul) return;
  ul.innerHTML = "";
  const list = alerts || [];
  if (count) count.textContent = String(list.length);

  if (!list.length) {
    const li = document.createElement("li");
    li.className = "alertItem";
    li.innerHTML = `
      <div class="alertItem__left">
        <div class="alertItem__title">Aucune alerte météo</div>
        <div class="alertItem__meta">Prévisions calmes cette semaine.</div>
      </div>
      <div class="alertItem__tag" style="border-color: rgba(54,211,153,.35); background: rgba(54,211,153,.12)">OK</div>
    `;
    ul.appendChild(li);
    return;
  }

  for (const a of list) {
    const li = document.createElement("li");
    li.className = "alertItem";
    li.innerHTML = `
      <div class="alertItem__left">
        <div class="alertItem__title">${a.title}</div>
        <div class="alertItem__meta">${a.time}</div>
      </div>
      <div class="alertItem__tag">${String(a.level || "warn").toUpperCase()}</div>
    `;
    ul.appendChild(li);
  }
}

function computeState(metric, value) {
  // Thresholds (modifiable)
  if (value == null) return { label: "—", level: "neutral" };
  if (metric === "temperature") {
    if (value < 15) return { label: "Froid", level: "warn" };
    if (value > 34) return { label: "Chaud", level: "bad" };
    return { label: "OK", level: "ok" };
  }
  if (metric === "humidity") {
    if (value < 35) return { label: "Sec", level: "warn" };
    if (value > 80) return { label: "Humide", level: "warn" };
    return { label: "OK", level: "ok" };
  }
  if (metric === "soil") {
    if (value < 30) return { label: "À arroser", level: "bad" };
    if (value < 45) return { label: "Bas", level: "warn" };
    return { label: "OK", level: "ok" };
  }
  if (metric === "light") {
    if (value < 120) return { label: "Faible", level: "warn" };
    if (value > 18000) return { label: "Fort", level: "warn" };
    return { label: "OK", level: "ok" };
  }
  return { label: "—", level: "neutral" };
}

function deltaFromSeries(series) {
  if (!series || series.length < 2) return null;
  const a = series[series.length - 2];
  const b = series[series.length - 1];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = b - a;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return `${sign}${Math.abs(diff).toFixed(1)}`;
}

function soilAdvice(value) {
  if (value == null) return "—";
  if (value < 30) return "Arroser maintenant";
  if (value < 45) return "Arrosage bientôt";
  return "Rien à signaler";
}

function setBackendStatus(ok, text) {
  const dot = $("#backendDot");
  const label = $("#backendText");
  if (!dot || !label) return;
  dot.style.background = ok ? "rgba(54,211,153,.9)" : "rgba(255,255,255,.25)";
  dot.style.boxShadow = ok
    ? "0 0 0 4px rgba(54,211,153,.14)"
    : "0 0 0 4px rgba(255,255,255,.06)";
  label.textContent = text;
}

function setBadge(el, state) {
  if (!el) return;
  el.textContent = state.label;
}

function renderAlerts(alerts) {
  const ul = $("#alertsList");
  if (!ul) return;
  ul.innerHTML = "";
  if (!alerts.length) {
    const li = document.createElement("li");
    li.className = "alertItem";
    li.innerHTML = `
      <div class="alertItem__left">
        <div class="alertItem__title">Aucune alerte</div>
        <div class="alertItem__meta">Tout est stable.</div>
      </div>
      <div class="alertItem__tag" style="border-color: rgba(54,211,153,.35); background: rgba(54,211,153,.12)">OK</div>
    `;
    ul.appendChild(li);
    return;
  }
  for (const a of alerts.slice(0, 5)) {
    const li = document.createElement("li");
    li.className = "alertItem";
    li.innerHTML = `
      <div class="alertItem__left">
        <div class="alertItem__title">${a.title}</div>
        <div class="alertItem__meta">${a.time}</div>
      </div>
      <div class="alertItem__tag">${a.level.toUpperCase()}</div>
    `;
    ul.appendChild(li);
  }
}

function renderTable(readings) {
  const tbody = $("#readingsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  for (const r of readings.slice().reverse().slice(0, 12)) {
    const tr = document.createElement("tr");
    const state = r.state || "OK";
    const tagClass =
      state === "OK" ? "tagOk" : state === "WARN" ? "tagWarn" : "tagBad";
    tr.innerHTML = `
      <td>${r.time}</td>
      <td>${r.temperature?.toFixed?.(1) ?? "—"}</td>
      <td>${r.humidity?.toFixed?.(0) ?? "—"}</td>
      <td>${r.soil?.toFixed?.(0) ?? "—"}</td>
      <td>${r.light?.toFixed?.(0) ?? "—"}</td>
      <td><span class="${tagClass}">${state}</span></td>
    `;
    tbody.appendChild(tr);
  }
}

function makeMockPoint(prev) {
  const baseT = prev?.temperature ?? 27;
  const baseH = prev?.humidity ?? 58;
  const baseS = prev?.soil ?? 41;
  const baseL = prev?.light ?? 6800;

  const temperature = clamp(baseT + (Math.random() - 0.5) * 0.7, 12, 38);
  const humidity = clamp(baseH + (Math.random() - 0.5) * 2.2, 20, 95);
  const soil = clamp(baseS + (Math.random() - 0.5) * 2.5, 10, 85);
  const light = clamp(baseL + (Math.random() - 0.5) * 550, 50, 25000);

  return { temperature, humidity, soil, light, at: new Date() };
}

function evaluateOverallState(p) {
  const levels = [
    computeState("temperature", p.temperature).level,
    computeState("humidity", p.humidity).level,
    computeState("soil", p.soil).level,
    computeState("light", p.light).level,
  ];
  if (levels.includes("bad")) return "BAD";
  if (levels.includes("warn")) return "WARN";
  return "OK";
}

function seriesLabels(points) {
  return points.map((p) => formatTime(p.at));
}

function seriesValues(points, key) {
  return points.map((p) => p[key]);
}

function createSparkline(canvas, color) {
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "spark",
          data: [],
          borderColor: color,
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false },
      },
      elements: { line: { capBezierPoints: true } },
    },
  });
}

function createMainChart(canvas) {
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Temp (°C)",
          data: [],
          borderColor: "rgba(251,146,60,.95)",
          backgroundColor: "rgba(251,146,60,.15)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: "Humidité (%)",
          data: [],
          borderColor: "rgba(78,163,255,.95)",
          backgroundColor: "rgba(78,163,255,.10)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: "Lumière (lx)",
          data: [],
          borderColor: "rgba(167,139,250,.95)",
          backgroundColor: "rgba(167,139,250,.08)",
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          borderWidth: 2,
          yAxisID: "y2",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "rgba(255,255,255,.78)", boxWidth: 10, boxHeight: 10 },
        },
        tooltip: { mode: "index", intersect: false },
      },
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid: { color: "rgba(255,255,255,.06)" },
          ticks: { color: "rgba(255,255,255,.60)" },
        },
        y: {
          grid: { color: "rgba(255,255,255,.06)" },
          ticks: { color: "rgba(255,255,255,.60)" },
        },
        y2: {
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: { color: "rgba(255,255,255,.60)" },
        },
      },
    },
  });
}

function getApiBase(cfg) {
  let base = (cfg.apiBaseUrl || "").trim().replace(/\/$/, "");
  if (base) return base;
  // Si vide: même origine que la page (quand le dashboard est servi depuis le même Apache)
  if (typeof window !== "undefined" && window.location) {
    const origin = window.location.origin;
    const path = window.location.pathname.replace(/\/[^/]*$/, "");
    return path ? origin + path : origin;
  }
  throw new Error("API base URL manquante. Renseigne apiBaseUrl dans config.js ou Paramètres.");
}

async function fetchLatestFromApi(cfg) {
  const base = getApiBase(cfg);
  const res = await fetch(`${base}/api/latest/`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // expected keys: temperature, humidity, soil, light, at (optional)
  return {
    temperature: safeNumber(json.temperature),
    humidity: safeNumber(json.humidity),
    soil: safeNumber(json.soil),
    light: safeNumber(json.light),
    at: json.at ? new Date(json.at) : new Date(),
  };
}

async function fetchHistoryFromApi(cfg, range) {
  const base = getApiBase(cfg);
  const res = await fetch(`${base}/api/history/?range=${encodeURIComponent(range)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // expected array of points: [{temperature, humidity, soil, light, at}]
  if (!Array.isArray(json)) return [];
  return json
    .map((p) => ({
      temperature: safeNumber(p.temperature),
      humidity: safeNumber(p.humidity),
      soil: safeNumber(p.soil),
      light: safeNumber(p.light),
      at: p.at ? new Date(p.at) : new Date(),
    }))
    .filter((p) => p.at instanceof Date && !Number.isNaN(p.at.valueOf()));
}

function setRoute(route) {
  $$(".route").forEach((r) => r.classList.toggle("route--active", r.dataset.route === route));
  $$(".navItem").forEach((b) => b.classList.toggle("navItem--active", b.dataset.route === route));

  const title = $("#pageTitle");
  const subtitle = $("#pageSubtitle");
  if (!title || !subtitle) return;
  if (route === "dashboard") {
    title.textContent = "Dashboard";
    subtitle.textContent = "Suivi en temps réel: température, humidité et luminosité";
  } else if (route === "analytics") {
    title.textContent = "Analytics";
    subtitle.textContent = "Statistiques et tendances";
  } else if (route === "devices") {
    title.textContent = "Devices";
    subtitle.textContent = "Capteurs et état de la passerelle";
  } else if (route === "settings") {
    title.textContent = "Settings";
    subtitle.textContent = "Configuration de la source de données";
  }
}

function closeMobileMenu() {
  const app = $("#app");
  const burger = $("#burgerBtn");
  const overlay = $("#sidebarOverlay");
  if (app) app.classList.remove("menu-open");
  if (burger) burger.setAttribute("aria-expanded", "false");
  if (overlay) overlay.setAttribute("aria-hidden", "true");
}

function openMobileMenu() {
  const app = $("#app");
  const burger = $("#burgerBtn");
  const overlay = $("#sidebarOverlay");
  if (app) app.classList.add("menu-open");
  if (burger) burger.setAttribute("aria-expanded", "true");
  if (overlay) overlay.setAttribute("aria-hidden", "false");
}

function wireNavigation() {
  $$(".navItem").forEach((b) => {
    b.addEventListener("click", () => {
      setRoute(b.dataset.route);
      closeMobileMenu();
    });
  });

  const burger = $("#burgerBtn");
  const overlay = $("#sidebarOverlay");
  if (burger) {
    burger.addEventListener("click", () => {
      const open = burger.getAttribute("aria-expanded") === "true";
      if (open) closeMobileMenu();
      else openMobileMenu();
    });
  }
  if (overlay) {
    overlay.addEventListener("click", closeMobileMenu);
  }
  const mobileLogo = $("#mobileLogoLink");
  if (mobileLogo) {
    mobileLogo.addEventListener("click", (e) => {
      e.preventDefault();
    });
  }
}

function wireSettings(cfg, onChange) {
  const form = $("#settingsForm");
  const apiBaseInput = $("#apiBaseInput");
  const pollMsInput = $("#pollMsInput");
  const dataModeSelect = $("#dataModeSelect");
  const weatherEnabledSelect = $("#weatherEnabledSelect");
  const weatherCitySelect = $("#weatherCitySelect");
  const resetBtn = $("#resetSettingsBtn");
  const apiLabel = $("#apiBaseLabel");

  if (apiBaseInput) apiBaseInput.value = cfg.apiBaseUrl || "";
  if (pollMsInput) pollMsInput.value = String(cfg.pollMs ?? 5000);
  if (dataModeSelect) dataModeSelect.value = cfg.dataMode || "mock";
  if (weatherEnabledSelect) weatherEnabledSelect.value = String(cfg.weatherEnabled ?? true);
  if (weatherCitySelect) weatherCitySelect.value = cfg.weatherCity || "Alger";
  if (apiLabel) apiLabel.textContent = cfg.apiBaseUrl ? cfg.apiBaseUrl : "(mock)";

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const next = {
      ...cfg,
      apiBaseUrl: (apiBaseInput?.value || "").trim(),
      pollMs: clamp(Number(pollMsInput?.value || cfg.pollMs), 1000, 600000),
      dataMode: dataModeSelect?.value === "api" ? "api" : "mock",
      weatherEnabled: weatherEnabledSelect?.value !== "false",
      weatherCity: weatherCitySelect?.value || cfg.weatherCity || "Alger",
    };
    saveConfig(next);
    if (apiLabel) apiLabel.textContent = next.apiBaseUrl ? next.apiBaseUrl : "(mock)";
    onChange(next);
    setRoute("dashboard");
  });

  resetBtn?.addEventListener("click", () => {
    saveConfig({ ...DEFAULT_CONFIG });
    window.location.reload();
  });
}

function init() {
  let cfg = loadConfig();
  const apiLabel = $("#apiBaseLabel");
  if (apiLabel) apiLabel.textContent = cfg.apiBaseUrl ? cfg.apiBaseUrl : "(mock)";

  wireNavigation();

  const charts = {
    tempSpark: createSparkline($("#tempSpark"), "rgba(251,146,60,.95)"),
    humSpark: createSparkline($("#humSpark"), "rgba(78,163,255,.95)"),
    soilSpark: createSparkline($("#soilSpark"), "rgba(54,211,153,.95)"),
    lightSpark: createSparkline($("#lightSpark"), "rgba(167,139,250,.95)"),
    main: createMainChart($("#mainChart")),
  };

  const stateEls = {
    temp: $("#tempState"),
    hum: $("#humState"),
    soil: $("#soilState"),
    light: $("#lightState"),
  };

  const valueEls = {
    temperature: $("#temperatureValue"),
    humidity: $("#humidityValue"),
    soil: $("#soilValue"),
    light: $("#lightValue"),
  };

  const deltaEls = {
    temperature: $("#temperatureDelta"),
    humidity: $("#humidityDelta"),
    light: $("#lightDelta"),
  };

  const soilAdviceEl = $("#soilAdvice");
  const lastUpdatedEl = $("#lastUpdated");
  const lastPacketEl = $("#lastPacket");
  const sampleRateEl = $("#sampleRate");
  const alertsCountEl = $("#alertsCount");

  const segmentedBtns = $$(".segmented__btn");
  let range = "1h";
  segmentedBtns.forEach((b) => {
    b.addEventListener("click", async () => {
      segmentedBtns.forEach((x) => x.classList.toggle("segmented__btn--active", x === b));
      range = b.dataset.range || "1h";
      await refresh({ forceHistory: true });
    });
  });

  let points = [];
  let readings = [];
  let lastWeather = null;
  let lastWeatherAt = 0;

  function pushPoint(p) {
    points.push(p);
    if (points.length > 36) points = points.slice(-36);
    const state = evaluateOverallState(p);
    readings.push({
      time: formatTime(p.at),
      temperature: p.temperature,
      humidity: p.humidity,
      soil: p.soil,
      light: p.light,
      state,
    });
    if (readings.length > 100) readings = readings.slice(-100);
  }

  function formatSensorValue(v, decimals = 0) {
    if (v == null || !Number.isFinite(v)) return "—";
    return decimals === 0 ? String(Math.round(v)) : v.toFixed(decimals);
  }

  function updateUi() {
    const last = points[points.length - 1];
    const hasSensorData = last && (
      (last.temperature != null && Number.isFinite(last.temperature)) ||
      (last.humidity != null && Number.isFinite(last.humidity)) ||
      (last.soil != null && Number.isFinite(last.soil)) ||
      (last.light != null && Number.isFinite(last.light))
    );

    if (!hasSensorData) {
      valueEls.temperature.textContent = "—";
      valueEls.humidity.textContent = "—";
      valueEls.soil.textContent = "—";
      valueEls.light.textContent = "—";
      setBadge(stateEls.temp, { label: "—", level: "neutral" });
      setBadge(stateEls.hum, { label: "—", level: "neutral" });
      setBadge(stateEls.soil, { label: "—", level: "neutral" });
      setBadge(stateEls.light, { label: "—", level: "neutral" });
      deltaEls.temperature.textContent = "—";
      deltaEls.humidity.textContent = "—";
      deltaEls.light.textContent = "—";
      if (soilAdviceEl) soilAdviceEl.textContent = "—";
      if (lastUpdatedEl) lastUpdatedEl.textContent = "Aucune donnée capteur";
      if (lastPacketEl) lastPacketEl.textContent = "—";
      if (sampleRateEl) sampleRateEl.textContent = String(Math.round((cfg.pollMs ?? 5000) / 1000));
      charts.tempSpark.data.labels = [];
      charts.tempSpark.data.datasets[0].data = [];
      charts.tempSpark.update("none");
      charts.humSpark.data.labels = [];
      charts.humSpark.data.datasets[0].data = [];
      charts.humSpark.update("none");
      charts.soilSpark.data.labels = [];
      charts.soilSpark.data.datasets[0].data = [];
      charts.soilSpark.update("none");
      charts.lightSpark.data.labels = [];
      charts.lightSpark.data.datasets[0].data = [];
      charts.lightSpark.update("none");
      charts.main.data.labels = [];
      charts.main.data.datasets[0].data = [];
      charts.main.data.datasets[1].data = [];
      charts.main.data.datasets[2].data = [];
      charts.main.update("none");
      renderAlerts([{ title: "Aucune donnée capteur reçue", time: "—", level: "info" }]);
      if (alertsCountEl) alertsCountEl.textContent = "0";
      renderTable(readings);
      return;
    }

    valueEls.temperature.textContent = formatSensorValue(last.temperature, 1);
    valueEls.humidity.textContent = formatSensorValue(last.humidity, 0);
    valueEls.soil.textContent = formatSensorValue(last.soil, 0);
    valueEls.light.textContent = formatSensorValue(last.light, 0);

    const tState = computeState("temperature", last.temperature);
    const hState = computeState("humidity", last.humidity);
    const sState = computeState("soil", last.soil);
    const lState = computeState("light", last.light);
    setBadge(stateEls.temp, tState);
    setBadge(stateEls.hum, hState);
    setBadge(stateEls.soil, sState);
    setBadge(stateEls.light, lState);

    deltaEls.temperature.textContent = deltaFromSeries(seriesValues(points, "temperature")) ?? "—";
    deltaEls.humidity.textContent = deltaFromSeries(seriesValues(points, "humidity")) ?? "—";
    deltaEls.light.textContent = deltaFromSeries(seriesValues(points, "light")) ?? "—";

    if (soilAdviceEl) soilAdviceEl.textContent = soilAdvice(last.soil);
    if (lastUpdatedEl) lastUpdatedEl.textContent = last.at ? `Dernière mise à jour: ${formatTime(last.at)}` : "—";
    if (lastPacketEl) lastPacketEl.textContent = last.at ? formatTime(last.at) : "—";
    if (sampleRateEl) sampleRateEl.textContent = String(Math.round((cfg.pollMs ?? 5000) / 1000));

    charts.tempSpark.data.labels = seriesLabels(points);
    charts.tempSpark.data.datasets[0].data = seriesValues(points, "temperature");
    charts.tempSpark.update("none");
    charts.humSpark.data.labels = seriesLabels(points);
    charts.humSpark.data.datasets[0].data = seriesValues(points, "humidity");
    charts.humSpark.update("none");
    charts.soilSpark.data.labels = seriesLabels(points);
    charts.soilSpark.data.datasets[0].data = seriesValues(points, "soil");
    charts.soilSpark.update("none");
    charts.lightSpark.data.labels = seriesLabels(points);
    charts.lightSpark.data.datasets[0].data = seriesValues(points, "light");
    charts.lightSpark.update("none");
    charts.main.data.labels = seriesLabels(points);
    charts.main.data.datasets[0].data = seriesValues(points, "temperature");
    charts.main.data.datasets[1].data = seriesValues(points, "humidity");
    charts.main.data.datasets[2].data = seriesValues(points, "light");
    charts.main.update("none");

    const alerts = [];
    if (tState.level === "bad") alerts.push({ title: "Température trop élevée", time: last.at ? formatTime(last.at) : "—", level: "danger" });
    if (sState.level === "bad") alerts.push({ title: "Sol trop sec", time: last.at ? formatTime(last.at) : "—", level: "danger" });
    if (hState.level === "warn") alerts.push({ title: "Humidité hors plage", time: last.at ? formatTime(last.at) : "—", level: "warn" });
    if (lState.level === "warn") alerts.push({ title: "Luminosité atypique", time: last.at ? formatTime(last.at) : "—", level: "warn" });
    renderAlerts(alerts);
    if (alertsCountEl) alertsCountEl.textContent = String(alerts.length);
    renderTable(readings);
  }

  async function refreshWeather({ force = false } = {}) {
    const enabled = cfg.weatherEnabled !== false;
    const cityLabel = $("#weatherCityLabel");
    const updated = $("#weatherUpdated");
    const nowTemp = $("#weatherNowTemp");
    const nowWind = $("#weatherNowWind");
    const nowRain = $("#weatherNowRain");
    const nowLabel = $("#weatherNowLabel");
    const icon = $("#weatherIcon");

    if (!enabled) {
      if (cityLabel) cityLabel.textContent = "désactivée";
      if (updated) updated.textContent = "Météo: off";
      renderWeatherAlerts([]);
      const tbody = $("#weatherTableBody");
      if (tbody) tbody.innerHTML = "";
      return;
    }

    const cacheMs = 15 * 60_000; // 15min
    if (!force && lastWeather && Date.now() - lastWeatherAt < cacheMs) return;

    try {
      const city = cfg.weatherCity || "Algiers";
      const geo = await geocodeCityAlgeria(city);
      if (cityLabel) cityLabel.textContent = geo.name;

      const data = await fetchWeeklyWeather(geo);
      lastWeather = data;
      lastWeatherAt = Date.now();

      const cur = data?.current || {};
      if (updated) updated.textContent = `Maj: ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      if (nowTemp) nowTemp.textContent = cur.temperature_2m != null ? Number(cur.temperature_2m).toFixed(0) : "—";
      if (nowWind) nowWind.textContent = cur.wind_speed_10m != null ? `${toKmh(cur.wind_speed_10m).toFixed(0)} km/h` : "—";
      if (nowRain) nowRain.textContent = cur.precipitation != null ? `${Number(cur.precipitation).toFixed(1)} mm` : "—";
      if (nowLabel) nowLabel.textContent = weatherCodeLabel(cur.weather_code);
      if (icon) icon.innerHTML = getWeatherIconSvg(cur.weather_code);

      const daily = data?.daily;
      renderWeatherTable(daily);
      const alerts = computeWeatherAlerts(daily, cfg.weatherThresholds);
      renderWeatherAlerts(alerts);
    } catch (e) {
      if (updated) updated.textContent = `Erreur météo: ${String(e?.message || e)}`;
      renderWeatherAlerts([]);
    }
  }

  function hasAnySensorValue(point) {
    if (!point) return false;
    return (
      (point.temperature != null && Number.isFinite(point.temperature)) ||
      (point.humidity != null && Number.isFinite(point.humidity)) ||
      (point.soil != null && Number.isFinite(point.soil)) ||
      (point.light != null && Number.isFinite(point.light))
    );
  }

  async function refresh({ forceHistory = false } = {}) {
    try {
      if (cfg.dataMode === "api") {
        setBackendStatus(false, "Backend: connexion…");
        const latest = await fetchLatestFromApi(cfg);
        if (hasAnySensorValue(latest)) {
          pushPoint(latest);
        }

        if (forceHistory && points.length < 6) {
          const hist = await fetchHistoryFromApi(cfg, range);
          if (hist.length) {
            points = hist.filter(hasAnySensorValue).slice(-36);
            readings = [];
            for (const p of points) {
              readings.push({
                time: formatTime(p.at),
                temperature: p.temperature,
                humidity: p.humidity,
                soil: p.soil,
                light: p.light,
                state: evaluateOverallState(p),
              });
            }
          }
        }

        setBackendStatus(true, "Backend: connecté");
      } else {
        setBackendStatus(false, "Backend: non connecté (mock)");
        const p = makeMockPoint(points[points.length - 1]);
        pushPoint(p);
      }
      updateUi();
      await refreshWeather();
    } catch (e) {
      setBackendStatus(false, `Backend: erreur (${String(e?.message || e)})`);
      if (cfg.dataMode === "api") {
        updateUi();
      }
      await refreshWeather();
    }
  }

  if (cfg.dataMode === "mock") {
    for (let i = 0; i < 14; i++) {
      const p = makeMockPoint(points[points.length - 1]);
      p.at = new Date(Date.now() - (14 - i) * 60_000);
      pushPoint(p);
    }
  }
  updateUi();
  refreshWeather({ force: true });
  if (cfg.dataMode === "api") {
    refresh({ forceHistory: true });
  }

  $("#refreshBtn")?.addEventListener("click", () => refresh({ forceHistory: true }));

  wireSettings(cfg, (next) => {
    cfg = next;
    $("#apiBaseLabel").textContent = cfg.apiBaseUrl ? cfg.apiBaseUrl : "(mock)";
    refreshWeather({ force: true });
    refresh({ forceHistory: true });
    restartPolling();
  });

  let pollTimer = null;
  function restartPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => refresh(), clamp(cfg.pollMs ?? 5000, 1000, 600000));
  }
  restartPolling();

  // Show API expectation in console for backend hookup
  console.log("[CropCare] Expect API endpoints:", {
    latest: "/api/latest",
    history: "/api/history?range=1h|24h|7d",
    sampleLatestResponse: {
      temperature: 26.3,
      humidity: 58,
      soil: 41,
      light: 6800,
      at: nowIso(),
    },
    sampleHistoryResponse: [
      { temperature: 26.1, humidity: 59, soil: 42, light: 7000, at: nowIso() },
    ],
  });
}

init();

