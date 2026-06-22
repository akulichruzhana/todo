const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Берём оригинальную строку подключения из переменной Vercel
const originalUrl = process.env.POSTGRES_URL_NON_POOLING;

// Разбираем строку подключения и меняем sslmode на 'no-verify'
const url = new URL(originalUrl);
url.searchParams.set('sslmode', 'no-verify');
const connectionString = url.toString();

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Заполните email и пароль' 
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, surname, email, phone, password_hash FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Неверный email или пароль' 
      });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Неверный email или пароль' 
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера. Попробуйте позже.' 
    });
  }
};
