const { Pool } = require('pg');

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
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Обработка preflight запроса
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ 
          success: false, 
          error: 'Email обязателен' 
        });
      }

      // Получаем бронирования по email
      const result = await pool.query(
        `SELECT id, name, phone, email, tour_date, comment, status, created_at
         FROM bookings 
         WHERE email = $1 
         ORDER BY id DESC`,
        [email.toLowerCase().trim()]
      );

      return res.status(200).json({
        success: true,
        bookings: result.rows
      });

    } catch (err) {
      console.error('Ошибка получения бронирований:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка сервера при получении бронирований' 
      });
    }
  }

  if (req.method === 'POST') {
    const { name, phone, email, tourDate, comment } = req.body;

    if (!name || !phone || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Пожалуйста, заполните имя, телефон и email' 
      });
    }

    try {
      const result = await pool.query(
        `INSERT INTO bookings (name, phone, email, tour_date, comment, created_at, status) 
         VALUES ($1, $2, $3, $4, $5, NOW(), 'new') 
         RETURNING id`,
        [name, phone, email, tourDate || null, comment || null]
      );
      
      return res.status(200).json({ 
        success: true, 
        message: 'Заявка успешно отправлена!' 
      });
    } catch (err) {
      console.error('Database error:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Ошибка: ' + err.message 
      });
    }
  }

  // Если метод не поддерживается
  return res.status(405).json({ error: 'Method not allowed' });
};
