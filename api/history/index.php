<?php
declare(strict_types=1);

require_once __DIR__ . '/../_lib.php';
cors_maybe();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
  json_response(['error' => 'Method not allowed'], 405);
}

$range = (string)($_GET['range'] ?? '1h');
// Return up to 36 points to match frontend charts nicely
$maxPoints = 36;

// Parse range into seconds
$seconds = 3600;
if ($range === '24h') $seconds = 24 * 3600;
if ($range === '7d') $seconds = 7 * 24 * 3600;

$since = time() - $seconds;

$readings = load_readings();
if (!$readings) json_response([]);

// Filter by time if possible, else just take last N
$filtered = [];
foreach ($readings as $r) {
  $at = (string)($r['at'] ?? '');
  $ts = strtotime($at);
  if ($ts === false) continue;
  if ($ts >= $since) $filtered[] = $r;
}

if (!$filtered) {
  $filtered = array_slice($readings, -$maxPoints);
}

// Downsample to maxPoints
$n = count($filtered);
if ($n > $maxPoints) {
  $step = max(1, (int)floor($n / $maxPoints));
  $down = [];
  for ($i = 0; $i < $n; $i += $step) $down[] = $filtered[$i];
  $filtered = array_slice($down, -$maxPoints);
}

$out = [];
foreach ($filtered as $r) {
  $out[] = [
    'temperature' => $r['temperature'] ?? null,
    'humidity' => $r['humidity'] ?? null,
    'soil' => $r['soil'] ?? null,
    'light' => $r['light'] ?? null,
    'at' => $r['at'] ?? null,
  ];
}

json_response($out);

