# CropCare — IoT Crop Monitoring Dashboard (Frontend)

Frontend **sans build** (HTML/CSS/JS) compatible XAMPP.

## Lancer

1. Copie/laisser ce dossier dans `c:\xampp\htdocs\Hackaton projet Crop care`
2. Démarre Apache dans XAMPP
3. Ouvre:
   - `http://localhost/Hackaton%20projet%20Crop%20care/`

## Brancher ton backend

La dashboard supporte 2 modes:

- **Mock**: démo sans backend
- **API**: fetch sur tes endpoints

Va sur **Settings**:

- **Base URL API**: ex `http://localhost/Hackaton%20projet%20Crop%20care`
- **Mode**: `API`

### Endpoints attendus

- `GET {BASE}/api/latest`

Réponse JSON:

```json
{
  "temperature": 26.3,
  "humidity": 58,
  "soil": 41,
  "light": 6800,
  "at": "2026-02-02T12:34:56.000Z"
}
```

- `GET {BASE}/api/history?range=1h|24h|7d`

Réponse JSON (array):

```json
[
  { "temperature": 26.1, "humidity": 59, "soil": 42, "light": 7000, "at": "2026-02-02T12:30:00.000Z" }
]
```


## Backend minimal inclus (PHP/XAMPP) + ESP32

Ce projet inclut un backend **PHP** très simple (stockage fichier) compatible XAMPP :

- `POST /api/ingest` : l’ESP32 envoie les mesures
- `GET /api/latest` : dernière mesure (utilisé par le front)
- `GET /api/history?range=1h|24h|7d` : historique (utilisé par le front)

### Test rapide (sans ESP32)

Tu peux simuler l’ESP32 avec un POST JSON :

```bash
curl -X POST "http://localhost/Hackaton%20projet%20Crop%20care/api/ingest" ^
  -H "Content-Type: application/json" ^
  -d "{\"temperature\":26.3,\"humidity\":58,\"soil\":41,\"light\":6800,\"device\":\"test\"}"
```

Puis vérifie :

- `http://localhost/Hackaton%20projet%20Crop%20care/api/latest`
- `http://localhost/Hackaton%20projet%20Crop%20care/api/history?range=1h`


