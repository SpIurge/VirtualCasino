import express from 'express';
import mysql from 'mysql2/promise';
import 'dotenv/config';
import session from 'express-session';

const app = express();

// Session configuration
app.set('trust proxy', 1); // trust first proxy
app.use(session({
  secret: 'cst336 csumb',
  resave: false,
  saveUninitialized: true,
  // cookie: { secure: true } // Only works in real HTTPS deployments
}));

app.set('view engine', 'ejs');
app.use(express.static('public'));

// For Express to get values using POST (form + JSON)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Setting up database connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DATABASE,
  connectionLimit: 10,
  waitForConnections: true
});

// Expose logged-in user to all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// Simple middleware to protect routes
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// ROUTES 

// Redirect root to login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// AUTH ROUTES

// Show registration form
app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// Handle registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('register', { error: 'Username and password are required.' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      return res.render('register', { error: 'That username is already taken.' });
    }

    // New users start with a default wallet
    const [result] = await pool.query(
      'INSERT INTO users (username, password, wallet, total_wins, total_profit, total_invested) VALUES (?, ?, 100.00, 0, 0.00, 0.00)',
      [username, password]
    );

    // Log them in immediately
    req.session.user = {
      id: result.insertId,
      username
    };

    res.redirect('/account');
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).send('Server error while registering.');
  }
});

// Show login form
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// Handle login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT id, username, password FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0 || rows[0].password !== password) {
      return res.render('login', { error: 'Invalid username or password.' });
    }

    req.session.user = {
      id: rows[0].id,
      username: rows[0].username
    };

    res.redirect('/account');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).send('Server error while logging in.');
  }
});

// Handle logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// ACCOUNT & GAME ROUTES 

// Account overview page
app.get('/account', requireLogin, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [[userRow]] = await pool.query(
      'SELECT username, wallet, total_wins, total_profit, total_invested FROM users WHERE id = ?',
      [userId]
    );

    const [historyRows] = await pool.query(
      `SELECT h.played_at, h.result, h.bet_amount, h.profit_change, d.name AS dealer_name
       FROM history h
       LEFT JOIN dealers d ON h.dealer_id = d.id
       WHERE h.user_id = ?
       ORDER BY h.played_at DESC
       LIMIT 10`,
      [userId]
    );

    const [dealers] = await pool.query(
      'SELECT id, name, difficulty FROM dealers WHERE is_active = 1 ORDER BY difficulty'
    );

    res.render('account', {
      user: userRow,
      history: historyRows,
      dealers
    });
  } catch (err) {
    console.error('Error loading account page:', err);
    res.status(500).send('Server error loading account.');
  }
});

// Choose dealer and go to blackjack table
app.post('/chooseDealer', requireLogin, async (req, res) => {
  const { dealerId } = req.body;
  req.session.currentDealerId = dealerId || null;
  res.redirect('/blackjack');
});

// Blackjack game view (protected)
app.get('/blackjack', requireLogin, async (req, res) => {
  let dealer = null;

  try {
    if (req.session.currentDealerId) {
      const [rows] = await pool.query(
        'SELECT id, name, difficulty FROM dealers WHERE id = ?',
        [req.session.currentDealerId]
      );
      if (rows.length > 0) {
        dealer = rows[0];
      }
    }

    res.render('blackjack', { dealer });
  } catch (err) {
    console.error('Error loading blackjack view:', err);
    res.status(500).send('Server error loading blackjack.');
  }
});

// CPU ROUTES
app.get('/cpus', requireLogin, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [rows] = await pool.query(
      'SELECT cpuld, name, confidence, risk, surrenderRate, image FROM cpus WHERE userId = ?',
      [userId]
    );

    res.render('cpus', {
      cpus: rows,
      error: null
    });
  } catch (err) {
    console.error('Error loading CPUs:', err);
    res.status(500).send('Server error loading CPUs.');
  }
});

// Handles the form submission to create a new CPU
app.post('/cpus', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { name, confidence, risk, surrenderRate, image } = req.body;

  if (!name || confidence === undefined || risk === undefined || surrenderRate === undefined) {
    const [rows] = await pool.query(
      'SELECT cpuld, name, confidence, risk, surrenderRate, image FROM cpus WHERE userId = ?',
      [userId]
    );
    return res.render('cpus', {
      cpus: rows,
      error: 'Name, confidence, risk, and surrender rate are required.'
    });
  }

const conf = parseFloat(confidence);
const r = parseFloat(risk);
const surr = parseFloat(surrenderRate);

if (
  isNaN(conf) || conf < 0.01 || conf > 1 ||
  isNaN(r)    || r    < 0.01 || r    > 1 ||
  isNaN(surr) || surr < 0.01 || surr > 1
) {
  const [rows] = await pool.query(
    'SELECT cpuld, name, confidence, risk, surrenderRate, image FROM cpus WHERE userId = ?',
    [userId]
  );
  return res.render('cpus', {
    cpus: rows,
    error: 'All sliders must be between 0.01 and 1.'
  });
}


  try {
    await pool.query(
      `INSERT INTO cpus (name, confidence, risk, surrenderRate, image, userId)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, conf, r, surr, image || null, userId]
    );

    res.redirect('/cpus');
  } catch (err) {
    console.error('Error creating CPU:', err);
    res.status(500).send('Server error creating CPU.');
  }
});

// for History + stats
app.post('/api/roundResult', requireLogin, async (req, res) => {
  const userId = req.session.user.id;
  const { dealerId, result, betAmount, profitChange } = req.body;

  if (!betAmount || !result) {
    return res.status(400).json({ success: false, message: 'Missing result or bet.' });
  }

  const bet = parseFloat(betAmount);
  const profit = parseFloat(profitChange || 0);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Insert into History table
    await connection.query(
      'INSERT INTO history (user_id, dealer_id, result, bet_amount, profit_change) VALUES (?, ?, ?, ?, ?)',
      [userId, dealerId || null, result, bet, profit]
    );

    // Update user stats (updates at least 3 fieldsd just for the rubric requiremtn)
    await connection.query(
      `UPDATE users
       SET wallet = wallet + ?,
           total_profit = total_profit + ?,
           total_invested = total_invested + ?,
           total_wins = total_wins + (? = 'win')
       WHERE id = ?`,
      [profit, profit, bet, result, userId]
    );

    await connection.commit();

    res.json({ success: true });
  } catch (err) {
    await connection.rollback();
    console.error('Error saving round result:', err);
    res.status(500).json({ success: false });
  } finally {
    connection.release();
  }
});

app.get('/dbTest', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT CURDATE()');
    res.send(rows);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Database error!');
  }
});

app.listen(3000, () => {
  console.log('Express server running on http://localhost:3000');
});
