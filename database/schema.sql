-- Ledger app database schema
-- In phpMyAdmin: create a database (e.g. "ledger_app"), select it, open the "SQL" tab,
-- paste this whole file in, and click Go.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS months (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  month_key VARCHAR(7) NOT NULL,        -- e.g. "2026-08"
  start_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  UNIQUE KEY user_month (user_id, month_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  month_id INT NOT NULL,
  user_id INT NOT NULL,
  type ENUM('income','expense') NOT NULL,
  category VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  note VARCHAR(80) DEFAULT '',
  tx_date DATE NOT NULL,
  ts DATETIME NOT NULL,
  time_label VARCHAR(20) DEFAULT '',
  FOREIGN KEY (month_id) REFERENCES months(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
