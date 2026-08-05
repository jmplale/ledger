<?php
// config.php — database connection settings.
// Update these 4 values to match your setup (XAMPP defaults are already filled in).

$DB_HOST = 'localhost';
$DB_NAME = 'ledger_app';
$DB_USER = 'root';
$DB_PASS = '';           // XAMPP's default MySQL root password is empty. Real hosts will give you one.

try {
    $pdo = new PDO(
        "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
        $DB_USER,
        $DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode(['ok' => false, 'error' => 'Database connection failed. Check config.php.']));
}

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
]);

header('Content-Type: application/json');
