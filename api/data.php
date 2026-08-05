<?php
require __DIR__ . '/config.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Not logged in']);
    exit;
}
$userId = $_SESSION['user_id'];

function respond($data) {
    echo json_encode($data);
    exit;
}

function nextMonthKey($key) {
    $dt = DateTime::createFromFormat('Y-m-d', $key . '-01');
    $dt->modify('+1 month');
    return $dt->format('Y-m');
}

function getOrCreateMonth($pdo, $userId, $monthKey, $startBalance = 0) {
    $stmt = $pdo->prepare('SELECT id, start_balance FROM months WHERE user_id = ? AND month_key = ?');
    $stmt->execute([$userId, $monthKey]);
    $row = $stmt->fetch();
    if ($row) return $row;

    $stmt = $pdo->prepare('INSERT INTO months (user_id, month_key, start_balance) VALUES (?, ?, ?)');
    $stmt->execute([$userId, $monthKey, $startBalance]);
    return ['id' => $pdo->lastInsertId(), 'start_balance' => $startBalance];
}

function endingBalance($pdo, $monthId, $startBalance) {
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END), 0) AS net
         FROM transactions WHERE month_id = ?"
    );
    $stmt->execute([$monthId]);
    return round($startBalance + (float)$stmt->fetch()['net'], 2);
}

// Fills in any months between the user's last known month and the real current
// month, carrying the ending balance forward — same behavior the old client-side
// version had.
function ensureMonthsUpToNow($pdo, $userId) {
    $currentKey = date('Y-m');
    $stmt = $pdo->prepare('SELECT month_key FROM months WHERE user_id = ? ORDER BY month_key ASC');
    $stmt->execute([$userId]);
    $keys = array_column($stmt->fetchAll(), 'month_key');

    if (empty($keys)) {
        getOrCreateMonth($pdo, $userId, $currentKey, 0);
        return;
    }

    $lastKey = end($keys);
    while ($lastKey !== $currentKey) {
        $stmt = $pdo->prepare('SELECT id, start_balance FROM months WHERE user_id = ? AND month_key = ?');
        $stmt->execute([$userId, $lastKey]);
        $rec = $stmt->fetch();
        $bal = endingBalance($pdo, $rec['id'], $rec['start_balance']);
        $nextKey = nextMonthKey($lastKey);
        getOrCreateMonth($pdo, $userId, $nextKey, $bal);
        $lastKey = $nextKey;
    }
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? ($input['action'] ?? 'get_data');

switch ($action) {

    case 'get_data':
        ensureMonthsUpToNow($pdo, $userId);

        $stmt = $pdo->prepare('SELECT id, month_key, start_balance FROM months WHERE user_id = ? ORDER BY month_key ASC');
        $stmt->execute([$userId]);
        $months = $stmt->fetchAll();

        $result = [];
        foreach ($months as $m) {
            $stmt = $pdo->prepare(
                'SELECT id, type, category, amount, note, tx_date AS date, ts, time_label AS timeLabel
                 FROM transactions WHERE month_id = ? ORDER BY ts ASC'
            );
            $stmt->execute([$m['id']]);
            $txs = $stmt->fetchAll();
            foreach ($txs as &$t) {
                $t['id'] = (string)$t['id'];
                $t['amount'] = (float)$t['amount'];
            }
            $result[$m['month_key']] = [
                'startBalance' => (float)$m['start_balance'],
                'transactions' => $txs,
            ];
        }

        respond(['ok' => true, 'currentMonthKey' => date('Y-m'), 'months' => $result]);
        break;

    case 'add_tx':
        ensureMonthsUpToNow($pdo, $userId);
        $currentKey = date('Y-m');
        $month = getOrCreateMonth($pdo, $userId, $currentKey, 0);

        $type = ($input['type'] ?? '') === 'income' ? 'income' : 'expense';
        $amount = (float)($input['amount'] ?? 0);
        $category = substr(trim($input['category'] ?? ''), 0, 50);
        $note = substr(trim($input['note'] ?? ''), 0, 80);

        if ($amount <= 0 || $category === '') {
            respond(['ok' => false, 'error' => 'Invalid entry']);
        }

        $now = new DateTime();
        $stmt = $pdo->prepare(
            'INSERT INTO transactions (month_id, user_id, type, category, amount, note, tx_date, ts, time_label)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $month['id'], $userId, $type, $category, $amount, $note,
            $now->format('Y-m-d'), $now->format('Y-m-d H:i:s'), $now->format('h:i A'),
        ]);
        respond(['ok' => true]);
        break;

    case 'delete_tx':
        $id = (int)($input['id'] ?? 0);
        $stmt = $pdo->prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?');
        $stmt->execute([$id, $userId]);
        respond(['ok' => true]);
        break;

    case 'correct_balance':
        ensureMonthsUpToNow($pdo, $userId);
        $currentKey = date('Y-m');
        $month = getOrCreateMonth($pdo, $userId, $currentKey, 0);
        $liveBal = endingBalance($pdo, $month['id'], $month['start_balance']);
        $newBal = (float)($input['newBalance'] ?? $liveBal);
        $diff = round($newBal - $liveBal, 2);

        if ($diff == 0) respond(['ok' => true]);

        $now = new DateTime();
        $type = $diff > 0 ? 'income' : 'expense';
        $stmt = $pdo->prepare(
            'INSERT INTO transactions (month_id, user_id, type, category, amount, note, tx_date, ts, time_label)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $month['id'], $userId, $type, 'Balance correction', abs($diff), 'Manual balance correction',
            $now->format('Y-m-d'), $now->format('Y-m-d H:i:s'), $now->format('h:i A'),
        ]);
        respond(['ok' => true]);
        break;

    default:
        respond(['ok' => false, 'error' => 'Unknown action']);
}
