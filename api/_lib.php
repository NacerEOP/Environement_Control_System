<?php
declare(strict_types=1);

function json_response($data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function cors_maybe(): void {
  // Autoriser toutes les origines (pratique pour le dev Vite http://localhost:5173)
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  header('Access-Control-Allow-Headers: Content-Type');

  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
  }
}

function storage_path(): string {
  $dir = __DIR__ . DIRECTORY_SEPARATOR . 'storage';
  if (!is_dir($dir)) {
    @mkdir($dir, 0777, true);
  }
  return $dir . DIRECTORY_SEPARATOR . 'readings.json';
}

function load_readings(): array {
  $path = storage_path();
  if (!file_exists($path)) return [];
  $raw = @file_get_contents($path);
  if ($raw === false || $raw === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function save_readings(array $readings): void {
  $path = storage_path();
  $fp = @fopen($path, 'c+');
  if (!$fp) {
    throw new RuntimeException('Cannot open storage');
  }
  if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    throw new RuntimeException('Cannot lock storage');
  }
  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, json_encode($readings, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);
}

function clampf($v, float $min, float $max): float {
  $n = (float)$v;
  if ($n < $min) return $min;
  if ($n > $max) return $max;
  return $n;
}

function parse_json_body(): array {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw ?: '', true);
  return is_array($data) ? $data : [];
}

function iso_now(): string {
  return gmdate('c');
}

