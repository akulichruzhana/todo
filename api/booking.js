const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { 
    rejectUnauthorized: false  // ← Эта строка уже есть, оставляем
  }
});

module.exports = async (req, res) => {
  // Разрешаем CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, tourDate, comment } = req.body;

  // Проверка переменной окружения
  if (!process.env.POSTGRES_URL) {
    console.error('POSTGRES_URL is not set!');
    return res.status(500).json({ 
      success: false, 
      error: 'Переменная окружения не настроена.' 
    });
  }

  // Валидация
  if (!name || !phone || !email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Пожалуйста, заполните имя, телефон и email' 
    });
  }

  try {
    console.log('Connecting to database...');
    
    const result = await pool.query(
      `INSERT INTO bookings (name, phone, email, tour_date, comment, created_at, status) 
       VALUES ($1, $2, $3, $4, $5, NOW(), 'new') 
       RETURNING id`,
      [name, phone, email, tourDate || null, comment || null]
    );
    
    console.log('Insert successful, id:', result.rows[0].id);
    
    res.status(200).json({ 
      success: true, 
      message: 'Заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.' 
    });
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка базы данных: ' + err.message 
    });
  }
};
