const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL_NON_POOLING, // <-- заменил
  ssl: { rejectUnauthorized: false }
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
