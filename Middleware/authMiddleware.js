const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Protects routes for users with 'admin' role
exports.isAdmin = async (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.redirect('/user/dashboard');
    
    // Fetch full user data from database
    const user = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (!user) return res.redirect('/login');
    
    // Set full user data in request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (err) {
    return res.redirect('/login');
  }
};

// Protects routes for users (admin or user)
exports.isAuthenticated = async (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Fetch full user data from database
    const user = await db.oneOrNone('SELECT * FROM users WHERE id = $1', [decoded.userId]);
    if (!user) return res.redirect('/login');
    
    // Set full user data in request
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    
    next();
  } catch (err) {
    return res.redirect('/login');
  }
};