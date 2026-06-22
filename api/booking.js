const { Pool } = require('pg');

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
    
    res.status(200).json({ 
      success: true, 
      message: 'Заявка успешно отправлена!' 
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка: ' + err.message 
    });
  }
};
