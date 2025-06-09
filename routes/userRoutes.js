const express = require('express'); 
const router = express.Router(); 
const { isAuthenticated } = require('../Middleware/authMiddleware'); 
const userController = require('../controllers/userController'); 
const { body } = require('express-validator');

// Dashboard route (protected)
router.get('/dashboard', isAuthenticated, userController.getDashboard); 

// Add this route for the narration page
router.get('/narration', userController.getStories);
router.get('/narration/:id', userController.getSingleStory); 

//About us page
router.get('/about', userController.getAboutPage);

// Testimonial routes
router.get('/testimonials', userController.showTestimonialsPage);
router.post('/testimonials', userController.submitTestimonial);

module.exports = router; 