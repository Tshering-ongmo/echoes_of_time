const db = require('../config/db');
const Testimonial = require('../Models/testimonialModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const fs = require('fs');
const path = require('path');

const formatStory = (story) => {
  if (!story) return null;
  
  return {
    ...story,
    content: story.content?.replace(/\r\n/g, '\n') || '',
    images: Array.isArray(story.images) ? story.images : [],
    created_at: new Date(story.created_at).toISOString(),
    updated_at: new Date(story.updated_at).toISOString(),
    published: Boolean(story.published)
  };
};

// Admin Dashboard
exports.getDashboard = (req, res) => {
  res.render('admin/dashboard', {
    admin: req.user,
    pendingTestimonials: []
  });
};

// Add Story Page
exports.getAddStoryForm = catchAsync(async (req, res, next) => {
  const stories = await db.any(
    `SELECT *, 
     COALESCE(images, ARRAY[]::TEXT[]) as images 
     FROM stories 
     ORDER BY created_at DESC`
  );
  res.render('admin/addStory', { 
    title: 'Add New Story',
    admin: req.user,
    stories: stories.map(formatStory)
  });
});

// Create Story
exports.createStory = catchAsync(async (req, res, next) => {
  const { title, content } = req.body;
  const images = req.files ? req.files.map(file => file.filename) : [];
  
  const story = await db.one(
    `INSERT INTO stories (title, content, images) 
     VALUES ($1, $2, $3) 
     RETURNING *`,
    [title, content?.replace(/\r\n/g, '\n'), images]
  );

  req.flash('success', 'Story created successfully!');
  res.redirect('/admin/viewStories');
});

// Get All Stories
exports.getAllStories = catchAsync(async (req, res, next) => {
  const stories = await db.any(
    `SELECT *, 
     COALESCE(images, ARRAY[]::TEXT[]) as images 
     FROM stories 
     ORDER BY created_at DESC`
  );
  res.render('admin/viewStories', {
    title: 'Manage Stories',
    stories: stories.map(formatStory),
    admin: req.user
  });
});

// Get Single Story
exports.getStoryById = catchAsync(async (req, res, next) => {
  const story = await db.one(
    `SELECT *, 
     COALESCE(images, ARRAY[]::TEXT[]) as images 
     FROM stories 
     WHERE id = $1`,
    [req.params.id]
  );
  
  if (!story) {
    return next(new AppError('No story found with that ID', 404));
  }
  res.json(formatStory(story));
});

// Update Story
exports.updateStory = catchAsync(async (req, res, next) => {
  const { title, content } = req.body;
  const { id } = req.params;

  try {
    // First get the existing story to preserve images
    const existingStory = await db.one(
      'SELECT images FROM stories WHERE id = $1',
      [id]
    );

    const story = await db.one(
      `UPDATE stories 
       SET title = $1, 
           content = $2, 
           images = $3,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [title, content?.replace(/\r\n/g, '\n'), existingStory.images || [], id]
    );

    if (!story) {
      return next(new AppError('No story found with that ID', 404));
    }

    res.json(formatStory(story));
  } catch (error) {
    console.error('Error updating story:', error);
    return next(new AppError('Error updating story', 500));
  }
});

// Delete Story
exports.deleteStory = catchAsync(async (req, res, next) => {
  // First get the story to delete its images
  const story = await db.one('SELECT images FROM stories WHERE id = $1', [req.params.id]);
  
  if (story && Array.isArray(story.images)) {
    story.images.forEach(image => {
      const imagePath = path.join('public/uploads/stories', image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    });
  }
  
  const result = await db.result(
    'DELETE FROM stories WHERE id = $1',
    [req.params.id]
  );

  if (result.rowCount === 0) {
    return next(new AppError('No story found with that ID', 404));
  }
  
  res.json({ success: true });
});

// Publish Story
exports.publishStory = catchAsync(async (req, res, next) => {
  const story = await db.one(
    `UPDATE stories 
     SET published = TRUE, 
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1 
     RETURNING *`,
    [req.params.id]
  );

  if (!story) {
    return next(new AppError('No story found with that ID', 404));
  }

  res.json(formatStory(story));
});

// Add Images to Story
exports.addStoryImages = catchAsync(async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      req.flash('info', 'No images were selected for upload');
      return res.redirect('/admin/viewStories');
    }

    // Get existing story first
    const existingStory = await db.one(
      'SELECT images FROM stories WHERE id = $1',
      [req.params.id]
    );

    const newImages = req.files.map(file => file.filename);
    const existingImages = Array.isArray(existingStory.images) ? existingStory.images : [];
    const combinedImages = [...existingImages, ...newImages];
    
    const story = await db.one(
      `UPDATE stories 
       SET images = $1, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [combinedImages, req.params.id]
    );

    if (!story) {
      // Clean up uploaded files if story update fails
      newImages.forEach(image => {
        const imagePath = path.join('public/uploads/stories', image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
      return next(new AppError('No story found with that ID', 404));
    }

    req.flash('success', 'Images uploaded successfully');
    res.redirect('/admin/viewStories');
  } catch (error) {
    console.error('Error adding images:', error);
    // Clean up uploaded files if there's an error
    if (req.files) {
      req.files.forEach(file => {
        const imagePath = path.join('public/uploads/stories', file.filename);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      });
    }
    req.flash('error', 'Error uploading images');
    res.redirect('/admin/viewStories');
  }
});

// Testimonial Management
exports.getPendingTestimonials = async (req, res) => {
  try {
    const pending = await db.any(
      `SELECT * FROM testimonials 
       WHERE is_approved = false 
       ORDER BY created_at DESC`
    );
    res.render('admin/testimonials', { 
      pending,
      admin: req.user
    });
  } catch (error) {
    console.error('Error fetching pending testimonials:', error);
    res.status(500).render('error', { 
      message: 'Error loading testimonials',
      admin: req.user
    });
  }
};

exports.approveTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    await db.one(
      `UPDATE testimonials 
       SET is_approved = true 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    res.redirect('/admin/testimonials');
  } catch (error) {
    console.error('Error approving testimonial:', error);
    res.status(500).render('error', { message: 'Error approving testimonial' });
  }
};

exports.deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    await db.result(
      `DELETE FROM testimonials 
       WHERE id = $1`,
      [id]
    );
    res.redirect('/admin/testimonials');
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    res.status(500).render('error', { message: 'Error deleting testimonial' });
  }
};
