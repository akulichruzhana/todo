const { Pool } = require('pg');

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

module.exports = async (req, res) => {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ 
      success: false, 
      error: 'Метод не поддерживается' 
    });
  }

  try {
    // Получаем ID из тела запроса (как в вашем случае с POST)
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID бронирования обязателен' 
      });
    }

    // Проверяем, существует ли бронирование
    const checkResult = await pool.query(
      'SELECT id FROM bookings WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Бронирование не найдено'
      });
    }

    // Удаляем бронирование
    const result = await pool.query(
      'DELETE FROM bookings WHERE id = $1 RETURNING id',
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Бронирование успешно отменено',
      deletedId: result.rows[0].id
    });

  } catch (err) {
    console.error('Error cancelling booking:', err);
    return res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
};
