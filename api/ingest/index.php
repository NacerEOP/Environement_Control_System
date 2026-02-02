<?php
declare(strict_types=1);

require_once __DIR__ . '/../_lib.php';
cors_maybe();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  json_response(['error' => 'Method not allowed'], 405);
}

$data = parse_json_body();

// Optional auth token (simple shared secret)
$expected = getenv('CROPCARE_INGEST_TOKEN') ?: '';
if ($expected !== '') {
  $token = (string)($data['token'] ?? '');
  if (!hash_equals($expected, $token)) {
    json_response(['error' => 'Unauthorized'], 401);
  }
}

$temperature = $data['temperature'] ?? null;
$humidity = $data['humidity'] ?? null;
$soil = $data['soil'] ?? null;
$light = $data['light'] ?? null;
$device = (string)($data['device'] ?? 'esp32');

if (!is_numeric($temperature) || !is_numeric($humidity) || !is_numeric($soil) || !is_numeric($light)) {
  json_response(['error' => 'Invalid payload. Expect numeric temperature, humidity, soil, light.'], 400);
}

$reading = [
  'temperature' => clampf($temperature, -40, 85),
  'humidity' => clampf($humidity, 0, 100),
  'soil' => clampf($soil, 0, 100),
  'light' => max(0, (float)$light),
  'device' => $device,
  'at' => (string)($data['at'] ?? iso_now()),
];

try {
  $readings = load_readings();
  $readings[] = $reading;
  // Keep last 2000 readings
  if (count($readings) > 2000) {
    $readings = array_slice($readings, -2000);
  }
  save_readings($readings);
  json_response(['ok' => true]);
} catch (Throwable $e) {
  json_response(['error' => 'Storage error', 'message' => $e->getMessage()], 500);
}

