const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Берём оригинальную строку подключения из переменной Vercel
const originalUrl = process.env.POSTGRES_URL_NON_POOLING;

// Разбираем строку подключения и меняем sslmode на 'no-verify'
// Это исправляет ошибку "self-signed certificate in certificate chain"
const url = new URL(originalUrl);
url.searchParams.set('sslmode', 'no-verify');
const connectionString = url.toString();

const pool = new Pool({
  connectionString: connectionString,    // используем исправленную строку
  ssl: { rejectUnauthorized: false }     // дополнительная страховка
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, surname, phone } = req.body;

  // Валидация обязательных полей
  if (!email || !password || !name || !surname) {
    return res.status(400).json({ 
      success: false, 
      error: 'Пожалуйста, заполните все обязательные поля' 
    });
  }

  // Валидация email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Введите корректный email'
    });
  }

  // Валидация пароля (минимум 6 символов)
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Пароль должен содержать минимум 6 символов'
    });
  }

  try {
    // Проверяем, существует ли пользователь с таким email
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Пользователь с таким email уже зарегистрирован'
      });
    }

    // Хешируем пароль
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Создаём пользователя в базе данных
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, surname, phone, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING id, email, name, surname, phone`,
      [email.toLowerCase(), passwordHash, name, surname, phone || null]
    );

    const newUser = result.rows[0];

    // Отправляем успешный ответ с данными пользователя
    res.status(200).json({
      success: true,
      message: 'Регистрация успешно завершена!',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        surname: newUser.surname,
        phone: newUser.phone
      }
    });

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({
      success: false,
      error: 'Ошибка сервера. Попробуйте позже.'
    });
  }
};
