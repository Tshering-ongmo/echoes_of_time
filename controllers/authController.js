const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Constants
const saltRounds = 10;

// Validate environment variables
if (!process.env.JWT_SECRET) throw new Error('❌ JWT_SECRET is required');
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️ Email credentials not configured');
}

// Validate and set BASE_URL
const BASE_URL = process.env.BASE_URL || `http://localhost:${process.env.PORT || 2004}`;
if (!BASE_URL.startsWith('http')) {
  throw new Error('❌ BASE_URL must start with http:// or https://');
}
console.log(`ℹ️ Using BASE_URL: ${BASE_URL}`);

// Helper functions
const isPasswordComplex = (password) => {
  const minLength = 8;
  const hasNumber = /\d/;
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/;
  const hasUpper = /[A-Z]/;
  const hasLower = /[a-z]/;
  
  return password.length >= minLength && 
         hasNumber.test(password) && 
         hasSpecialChar.test(password) &&
         hasUpper.test(password) &&
         hasLower.test(password);
};

const normalizeEmail = (email) => email.toLowerCase().trim();

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false } // For development only
});

const sendEmail = async (mailOptions, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await transporter.sendMail(mailOptions);
      return;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
};

// Controllers
const getLogin = (req, res) => {
  res.render('pages/login', { message: null });
};

const postLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]);
    if (!user) {
      return res.render('pages/login', { message: 'Invalid credentials' });
    }

    if (!user.is_verified) {
      return res.render('pages/login', { 
        message: 'Please verify your email first. Check your inbox or <a href="/resend-verification">resend verification email</a>.' 
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('pages/login', { message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
    res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('pages/login', { message: 'An error occurred. Please try again.' });
  }
};

const getSignup = (req, res) => {
  res.render('pages/signup', { message: null });
};

const postSignup = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.render('pages/signup', { message: 'All fields are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.render('pages/signup', { message: 'Invalid email format' });
    }

    if (!isPasswordComplex(password)) {
      return res.render('pages/signup', { 
        message: 'Password must be 8+ chars with uppercase, lowercase, number, and special character' 
      });
    }

    const existingUser = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]);
    if (existingUser) {
      return res.render('pages/signup', { message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await db.none(
      `INSERT INTO users (name, email, password, verification_token) 
       VALUES ($1, $2, $3, $4)`,
      [name, normalizeEmail(email), hashedPassword, verificationToken]
    );

    const verificationLink = `${BASE_URL}/verify-email?token=${verificationToken}`;
    console.log('Debug - Verification Link:', verificationLink);
    await sendEmail({
      from: `"Echoes of Time" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Welcome to Echoes of Time!</h2>
          <p>Click below to verify your email:</p>
          <a href="${verificationLink}" style="background: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
            Verify Email
          </a>
          <p style="margin-top: 20px;">Or copy this link: ${verificationLink}</p>
          <p style="color: #666;">Link expires in 1 hour</p>
        </div>
      `
    });

    res.render('pages/login', { 
      message: 'Registration successful! Please check your email to verify your account.' 
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.render('pages/signup', { message: 'Registration failed. Please try again.' });
  }
};

const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    if (!token) throw new Error('Token missing');
    
    const { email } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [email]);
    
    if (!user) throw new Error('User not found');
    if (user.is_verified) return res.redirect('/login?message=Email already verified');

    await db.none('UPDATE users SET is_verified = true, verification_token = null WHERE email = $1', [email]);
    res.redirect('/login?message=Email verified successfully');
  } catch (error) {
    console.error('Verification error:', error);
    res.status(400).render('pages/error', {
      message: error.name === 'TokenExpiredError' 
        ? 'Verification link expired. Please register again.' 
        : 'Invalid verification link'
    });
  }
};

const getForgotPassword = (req, res) => {
  res.render('pages/forgot-password', { message: null });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await db.oneOrNone('SELECT * FROM users WHERE email = $1', [normalizeEmail(email)]);
    if (user) {
      const resetToken = jwt.sign(
        { email: user.email, purpose: 'password_reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      await db.none('UPDATE users SET reset_token = $1 WHERE email = $2', [resetToken, email]);

      const resetLink = `${BASE_URL}/reset-password?token=${resetToken}`;
      await sendEmail({
        from: `"Password Reset" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif;">
            <p>Click below to reset your password:</p>
            <a href="${resetLink}">Reset Password</a>
            <p>Link expires in 1 hour.</p>
          </div>
        `
      });
    }

    res.render('pages/forgot-password', {
      message: 'If an account exists, a reset link has been sent'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.render('pages/forgot-password', {
      message: 'An error occurred. Please try again.'
    });
  }
};

const getResetPassword = (req, res) => {
  res.render('pages/reset-password', { token: req.query.token, message: null });
};

const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const { email } = jwt.verify(token, process.env.JWT_SECRET);
    if (!isPasswordComplex(newPassword)) {
      return res.render('pages/reset-password', {
        token,
        message: 'Password does not meet complexity requirements'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await db.none(
      'UPDATE users SET password = $1, reset_token = NULL WHERE email = $2',
      [hashedPassword, email]
    );

    res.redirect('/login?message=Password updated successfully');
  } catch (error) {
    console.error('Password reset error:', error);
    res.render('pages/reset-password', {
      token,
      message: 'Invalid or expired token. Please try again.'
    });
  }
};

const logout = (req, res) => {
  res.clearCookie('jwt');
  res.redirect('/login');
};

// Export all handlers correctly
module.exports = {
  getLogin,
  postLogin,
  getSignup,
  postSignup,
  verifyEmail,
  getForgotPassword,
  forgotPassword,
  getResetPassword,
  resetPassword,
  logout
};

// Email config check
transporter.verify((error) => {
  if (error) {
    console.error('❌ Email configuration error:', error);
  } else {
    console.log('✅ Email server ready');
  }
});
