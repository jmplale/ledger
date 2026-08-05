<?php
require __DIR__ . '/config.php';

function respond($data) {
    echo json_encode($data);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? ($input['action'] ?? '');

switch ($action) {

    case 'signup':
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';

        if (strlen($username) < 3 || strlen($username) > 30 || !preg_match('/^[a-zA-Z0-9_.-]+$/', $username)) {
            respond(['ok' => false, 'error' => 'Username must be 3-30 characters (letters, numbers, _ . -)']);
        }
        if (strlen($password) < 6) {
            respond(['ok' => false, 'error' => 'Password must be at least 6 characters']);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        if ($stmt->fetch()) {
            respond(['ok' => false, 'error' => 'That username is already taken']);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW())');
        $stmt->execute([$username, $hash]);

        $_SESSION['user_id'] = $pdo->lastInsertId();
        $_SESSION['username'] = $username;
        respond(['ok' => true, 'username' => $username]);
        break;

    case 'login':
        $username = trim($input['username'] ?? '');
        $password = $input['password'] ?? '';

        $stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            respond(['ok' => false, 'error' => 'Incorrect username or password']);
        }

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $username;
        respond(['ok' => true, 'username' => $username]);
        break;

    case 'logout':
        $_SESSION = [];
        session_destroy();
        respond(['ok' => true]);
        break;

    case 'me':
        if (!empty($_SESSION['user_id'])) {
            respond(['loggedIn' => true, 'username' => $_SESSION['username']]);
        }
        respond(['loggedIn' => false]);
        break;

    default:
        respond(['ok' => false, 'error' => 'Unknown action']);
}
