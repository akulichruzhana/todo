const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Проверяем переменную окружения
if (!process.env.POSTGRES_URL_NON_POOLING) {
  throw new Error('POSTGRES_URL_NON_POOLING не задана');
}

// Исправляем sslmode для Neon
const originalUrl = process.env.POSTGRES_URL_NON_POOLING;
const url = new URL(originalUrl);
url.searchParams.set('sslmode', 'no-verify');
const connectionString = url.toString();

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

// Автосоздание таблицы, если её нет
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
    console.error('Ошибка создания таблицы:', err);
  }
})();

module.exports = async (req, res) => {
  // Настройка CORS
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
    const { email, password } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Пожалуйста, заполните email и пароль' 
      });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Некорректный email' 
      });
    }

    // Проверка пароля (минимум 6 символов)
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Пароль должен содержать минимум 6 символов' 
      });
    }

    // Ищем пользователя по email
    const result = await pool.query(
      `SELECT id, name, surname, email, phone, password_hash 
       FROM usersregistr 
       WHERE email = $1`,
      [email.toLowerCase().trim()]
    );

    // Если пользователь не найден
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Неверный email или пароль' 
      });
    }

    const user = result.rows[0];

    // Проверяем пароль
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Неверный email или пароль' 
      });
    }

    // Отправляем данные пользователя (без пароля)
    return res.status(200).json({
      success: true,
      message: 'Вход выполнен успешно!',
      user: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        phone: user.phone
      }
    });

  } catch (err) {
    console.error('Ошибка входа:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера. Попробуйте позже.' 
    });
  }
};
