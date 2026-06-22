const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.POSTGRES_URL_NON_POOLING) {
  throw new Error('POSTGRES_URL_NON_POOLING не задана');
}

const originalUrl = process.env.POSTGRES_URL_NON_POOLING;
const url = new URL(originalUrl);
url.searchParams.set('sslmode', 'no-verify');
const connectionString = url.toString();

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Автосоздание таблицы, если её нет (на всякий случай)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usersregistr (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        surname VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Таблица usersregistr готова');
  } catch (err) {
    console.error('Ошибка создания таблицы usersregistr:', err);
  }
})();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Метод не поддерживается' });
  }

  try {
    const { name, surname, email, phone, password } = req.body;

    // Валидация
    if (!name || !surname || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    const nameRegex = /^[A-Za-zА-Яа-я\s\-]+$/;
    if (!nameRegex.test(name) || !nameRegex.test(surname)) {
      return res.status(400).json({
        success: false,
        error: 'Имя и фамилия должны содержать только буквы'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Некорректный email' });
    }

    if (phone.length < 5) {
      return res.status(400).json({ success: false, error: 'Слишком короткий телефон' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Минимум 6 символов для пароля' });
    }

    // Проверка существования email в usersregistr
    const existCheck = await pool.query(
      'SELECT id FROM usersregistr WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (existCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Пользователь с таким email уже зарегистрирован'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO usersregistr (name, surname, email, phone, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, name, surname, email, phone`,
      [name.trim(), surname.trim(), email.toLowerCase().trim(), phone.trim(), passwordHash]
    );

    const newUser = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Регистрация успешно завершена!',
      user: {
        id: newUser.id,
        name: newUser.name,
        surname: newUser.surname,
        email: newUser.email,
        phone: newUser.phone
      }
    });
  } catch (err) {
    console.error('Ошибка регистрации в usersregistr:', err);

    if (err.code === '23505') { // unique violation
      return res.status(409).json({
        success: false,
        error: 'Этот email уже используется'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера. Попробуйте позже.'
    });
  }
};
