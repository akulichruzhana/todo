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

  // Получаем все поля из формы регистрации
  const { name, surname, email, phone, password } = req.body;

  // Валидация обязательных полей
  if (!name || !surname || !email || !phone || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Пожалуйста, заполните все поля: имя, фамилию, email, телефон и пароль' 
    });
  }

  // Валидация имени (только буквы, пробелы, дефисы)
  const nameRegex = /^[A-Za-zА-Яа-я\s\-]+$/;
  if (!nameRegex.test(name) || !nameRegex.test(surname)) {
    return res.status(400).json({
      success: false,
      error: 'Имя и фамилия должны содержать только буквы'
    });
  }

  // Валидация email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      error: 'Введите корректный email (например: user@example.com)'
    });
  }

  // Валидация телефона (минимальная длина 5 символов)
  if (phone.length < 5) {
    return res.status(400).json({
      success: false,
      error: 'Введите корректный номер телефона'
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
      `INSERT INTO users (name, surname, email, phone, password_hash, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW()) 
       RETURNING id, name, surname, email, phone`,
      [name.trim(), surname.trim(), email.toLowerCase(), phone.trim(), passwordHash]
    );

    const newUser = result.rows[0];

    // Отправляем успешный ответ с данными пользователя (без пароля)
    res.status(200).json({
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
    console.error('Registration error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера. Попробуйте позже.' 
    });
  }
};
