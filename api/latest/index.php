<?php
declare(strict_types=1);

require_once __DIR__ . '/../_lib.php';
cors_maybe();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
  json_response(['error' => 'Method not allowed'], 405);
}

$readings = load_readings();
if (!$readings) {
  json_response([
    'temperature' => null,
    'humidity' => null,
    'soil' => null,
    'light' => null,
    'at' => null,
  ]);
}

$last = $readings[count($readings) - 1];
json_response([
  'temperature' => $last['temperature'] ?? null,
  'humidity' => $last['humidity'] ?? null,
  'soil' => $last['soil'] ?? null,
  'light' => $last['light'] ?? null,
  'at' => $last['at'] ?? null,
]);

