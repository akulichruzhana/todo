const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.VANDRA_POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = async (req, res) => {
  // Разрешаем только POST запросы
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, tourDate, comment } = req.body;

  // Валидация
  if (!name || !phone || !email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Пожалуйста, заполните имя, телефон и email' 
    });
  }

  if (!tourDate) {
    return res.status(400).json({ 
      success: false, 
      error: 'Пожалуйста, выберите дату тура' 
    });
  }

  try {
    await pool.query(
      `INSERT INTO bookings (name, phone, email, tour_date, comment, created_at, status) 
       VALUES ($1, $2, $3, $4, $5, NOW(), 'new')`,
      [name, phone, email, tourDate, comment || null]
    );

    res.status(200).json({ 
      success: true, 
      message: 'Заявка на тур успешно отправлена! Мы свяжемся с вами в ближайшее время.' 
    });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера. Пожалуйста, попробуйте позже или свяжитесь с нами по телефону.' 
    });
  }
};
