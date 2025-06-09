const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
require('dotenv').config();
const { createUserTable } = require('./Models/userModel');
const { createStoryTable } = require('./Models/storyModel');
const { createTestimonialsTable } = require('./Models/testimonialModel');
const methodOverride = require('method-override');

const app = express();
const PORT = process.env.PORT || 2004;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secretkey',
  resave: false,
  saveUninitialized: true,
  resave: false,
  cookie: { secure: true } // Set to true if using HTTPS
}));

// Flash middleware
app.use(flash());

// Make flash messages available to all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

//to allow PUT and DELETE methods in forms
app.use(methodOverride('_method'));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/user', userRoutes);

// Schema creation
createUserTable(); 

createStoryTable();

createTestimonialsTable();

// Server
app.listen(PORT, () => {
  //console.log(`Server running at http://localhost:${PORT}`);
  console.log(`✅ Server running on port ${PORT}`);

});
