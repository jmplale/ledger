# Ledger — multi-user setup guide

This turns your Ledger app into a real multi-user site: people sign up with a
username/password, log in, and their entries are saved in a MySQL database
under their own account.

## What's in this folder

```
ledger-app/
├── database/
│   └── schema.sql        ← run this once in phpMyAdmin to create the tables
├── api/
│   ├── config.php         ← your database connection settings
│   ├── auth.php           ← signup / login / logout
│   └── data.php           ← reading/writing ledger entries
└── public/                ← this is the folder people actually visit in a browser
    ├── login.html
    ├── login.css
    ├── auth.js
    ├── app.html            (was your index.html)
    ├── style.css
    └── script.js
```

The `public` folder is your website. `api` and `database` are the backend —
`api` needs to sit right next to `public` (both inside a folder your server
can see), because the frontend calls `api/auth.php` and `api/data.php` as
relative paths.

## Part 1 — Run it on your own computer first (XAMPP)

This is the easiest way to test everything before putting it on a real host,
and it needs zero coding knowledge beyond what you already have.

1. **Install XAMPP** — download from https://www.apachefriends.org and
   install it (Windows/Mac/Linux all supported). It bundles Apache (the web
   server), MySQL, and PHP together.
2. **Start Apache and MySQL** — open the XAMPP Control Panel and click
   "Start" next to both Apache and MySQL.
3. **Copy your files in** — find XAMPP's `htdocs` folder
   (Windows: `C:\xampp\htdocs`, Mac: `/Applications/XAMPP/htdocs`). Copy the
   whole `ledger-app` folder into it, so you end up with
   `.../htdocs/ledger-app/public/app.html` etc.
4. **Create the database** — open http://localhost/phpmyadmin in your
   browser. Click "New" in the left sidebar, name the database
   `ledger_app`, and click Create.
5. **Import the schema** — with `ledger_app` selected, click the "SQL" tab
   at the top, open `database/schema.sql` from this folder in a text editor,
   copy all of it, paste it into the SQL box in phpMyAdmin, and click "Go".
   You should now see three tables: `users`, `months`, `transactions`.
6. **Check `api/config.php`** — the defaults (`localhost`, `ledger_app`,
   user `root`, empty password) match a fresh XAMPP install, so you
   shouldn't need to change anything.
7. **Open the app** — go to
   `http://localhost/ledger-app/public/login.html`. Sign up for an account,
   and you're in. Open it in a different browser (or an incognito window)
   and sign up with a second username to prove two people get separate data.

## Part 2 — Putting it on the internet for real

Once you're happy with it locally, you need actual web hosting — a service
that keeps a server running all the time so other people can reach it. XAMPP
on your own laptop won't be reachable by anyone else once you close your
laptop or turn off Wi-Fi.

Any host that gives you **PHP + MySQL + phpMyAdmin** works — this is an
extremely common combo (Hostinger, Hostgator, SiteGround, InfinityFree for
free testing, etc.). Once you have one:

1. Use their **phpMyAdmin** (or MySQL setup screen) to create a database and
   a database user, same as step 4–5 above — import `database/schema.sql`.
2. The host will give you a hostname, database name, username, and password
   for MySQL — put those into `api/config.php` in place of the XAMPP
   defaults.
3. Upload the whole `ledger-app` folder via the host's File Manager or FTP
   (most hosts give you both).
4. Visit `https://yourdomain.com/ledger-app/public/login.html`.

That's genuinely it — the code doesn't change between local and live, only
the four values in `config.php`.

## How the pieces fit together (so future changes make sense)

- **`api/config.php`** opens the MySQL connection and starts a PHP session
  (this is what remembers "you're logged in" between page loads, via a
  cookie).
- **`api/auth.php`** handles `signup`, `login`, `logout`, and `me` (checking
  who's currently logged in). Passwords are hashed with PHP's
  `password_hash()` — never stored as plain text.
- **`api/data.php`** is guarded — every action first checks there's a logged
  in session, then only ever reads/writes rows belonging to that
  `user_id`. It replicates the "carry the balance forward into new months"
  logic your original JS did, just on the server now.
- **`public/script.js`** no longer uses `window.storage`. Instead it calls
  `fetch("api/data.php...")` for everything — add an entry, delete one,
  correct the balance, or load the full ledger. All the rendering code
  (charts, tabs, receipt list) is untouched from your original version.
- **`public/login.html` + `auth.js`** is the new signup/login screen. On
  success it redirects to `app.html`. If someone opens `app.html` directly
  without being logged in, `script.js` detects that and bounces them back to
  `login.html`.

## Notes / things worth knowing

- Each user's balance history, months, and transactions are completely
  separate — the database enforces this at the query level (every query is
  scoped to `user_id`).
- Sessions are cookie-based, so people stay logged in across visits until
  they click "Log out" or clear cookies.
- If you ever want to reset everything, just re-run `schema.sql` after
  dropping the database — no other files need touching.
