const bcrypt = require('bcrypt');
const db = require('../config/db');
require('dotenv').config();

async function seedAdmin() {
  try {
    // Check if required environment variables are set
    if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
      return;
    }

    console.log('👉 Checking if admin exists...');
    
    // Check if admin already exists
    const adminExists = await db.oneOrNone(
      'SELECT * FROM users WHERE email = $1',
      [process.env.ADMIN_EMAIL.toLowerCase().trim()]
    );

    if (adminExists) {
      console.log('ℹ️ Admin user already exists');
      
      // If admin exists but isn't properly set up, update it
      if (!adminExists.is_verified || adminExists.role !== 'admin') {
        await db.none(
          'UPDATE users SET role = $1, is_verified = true, verification_token = NULL WHERE email = $2',
          ['admin', process.env.ADMIN_EMAIL.toLowerCase().trim()]
        );
        console.log('✅ Updated existing user to admin role and verified status');
      }
      return;
    }

    console.log('👉 Creating new admin user...');

    // Create admin user
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    
    await db.none(
      `INSERT INTO users (
        name, 
        email, 
        password, 
        role, 
        is_verified,
        verification_token
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'Admin',
        process.env.ADMIN_EMAIL.toLowerCase().trim(),
        hashedPassword,
        'admin',
        true,
        null
      ]
    );

    console.log('✅ Admin user created successfully');
    console.log('📧 Admin email:', process.env.ADMIN_EMAIL);
    console.log('🔑 Use your admin password to login');
    console.log('✅ Account is pre-verified, no email verification needed');
    
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    console.error(error.stack);
  } finally {
    process.exit();
  }
}

// Create tables if they don't exist
async function ensureTables() {
  try {
    await db.none(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(10) DEFAULT 'user',
        is_verified BOOLEAN DEFAULT false,
        verification_token TEXT,
        reset_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Database tables ensured");
  } catch (err) {
    console.error("❌ Error creating tables:", err);
    process.exit(1);
  }
}

// Run the script
console.log('🚀 Starting admin setup...');
ensureTables().then(() => seedAdmin());