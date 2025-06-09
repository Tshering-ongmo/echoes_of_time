const db = require('../config/db');

// Create stories table if not exists
const createStoryTable = async () => {
  try {
    await db.none(`
      CREATE TABLE IF NOT EXISTS stories (
        id SERIAL PRIMARY KEY,
        title VARCHAR(225) NOT NULL,
        content TEXT NOT NULL,
        images TEXT[] DEFAULT ARRAY[]::TEXT[],
        published BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add published column if it doesn't exist
    await db.none(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name='stories' AND column_name='published'
        ) THEN 
          ALTER TABLE stories ADD COLUMN published BOOLEAN DEFAULT FALSE;
        END IF;
      END $$;
    `);

    console.log("✅ Stories table ensured.");
  } catch (err) {
    console.error("❌ Error creating/updating stories table:", err);
  }
};

module.exports = { createStoryTable };
