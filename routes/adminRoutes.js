const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAdmin } = require('../Middleware/authMiddleware');
const upload = require('../utils/multerConfig');
const multer = require('multer');

// Apply isAdmin middleware to all admin routes
router.use(isAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// Story: Show add story form
router.get('/addStory', adminController.getAddStoryForm);

// Story: Handle new story submission with image upload
router.post('/addStory', 
  (req, res, next) => {
    upload.array('images', 5)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ 
          error: 'File upload error', 
          details: err.message 
        });
      } else if (err) {
        return res.status(500).json({ 
          error: 'Server error', 
          details: err.message 
        });
      }
      next();
    });
  },
  adminController.createStory
);

// View all stories
router.get('/viewStories', adminController.getAllStories);

// Get single story
router.get('/stories/:id', adminController.getStoryById);

// Update story
router.put('/stories/:id', adminController.updateStory);

// Delete a story
router.delete('/stories/:id', adminController.deleteStory);

// Publish a story
router.post('/stories/:id/publish', adminController.publishStory);

// Add images to a story
router.post('/stories/:id/images', 
  upload.array('images', 5),
  adminController.addStoryImages
);

// Testimonials management
router.get('/testimonials', adminController.getPendingTestimonials);
router.post('/approveTestimonial/:id', adminController.approveTestimonial);
router.post('/deleteTestimonial/:id', adminController.deleteTestimonial);

module.exports = router;
