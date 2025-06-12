const pgp = require('pg-promise')();
require('dotenv').config();

const db = pgp({
DATABASE_URL: process.env.DATABASE_URL
});

module.exports = db;

