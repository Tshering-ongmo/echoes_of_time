const pgp = require('pg-promise')();
require('dotenv').config();

const db = pgp({
host: process.env.DB_HOST || 'localhost', 
port: process.env.DB_PORT || 5432,
database: process.env.DB_NAME || 'echoes-of_time', 
user: process.env.DB_USER || 'postgres', 
password: process.env.DB_PASS || 'bhutanese'
});

module.exports = db;