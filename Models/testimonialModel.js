const db = require('../config/db');

const createTestimonialsTable = async () => {
  try {
    await db.none(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        user_email VARCHAR(100),
        content TEXT NOT NULL,
        rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_approved BOOLEAN DEFAULT false
      )
    `);
    console.log("✅ Testimonials table created successfully");
  } catch (err) {
    console.error("❌ Error creating testimonials table:", err);
  }
};

module.exports = {
  createTestimonialsTable
};