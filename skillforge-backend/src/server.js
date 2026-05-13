require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/database');

// ── Load ALL models before sync
const User          = require('./models/User');
const Course        = require('./models/Course');
const Quiz          = require('./models/Quiz');
const Question      = require('./models/Question');
const QuizAttempt   = require('./models/QuizAttempt');
const CourseContent = require('./models/CourseContent');
const Feedback      = require('./models/Feedback');

// ── Associations
Course.hasMany(CourseContent, { foreignKey: 'course_id', as: 'contents' });
CourseContent.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// ── Routes
const authRoutes     = require('./routes/auth.routes');
const courseRoutes   = require('./routes/course.routes');
const quizRoutes     = require('./routes/quiz.routes');
const userRoutes     = require('./routes/user.routes');
const studentRoutes  = require('./routes/student.routes');
const adminRoutes    = require('./routes/admin.routes');
const contentRoutes  = require('./routes/content.routes');
const profileRoutes  = require('./routes/profile.routes');
const feedbackRoutes = require('./routes/feedback.routes');

const app  = express();
const PORT = process.env.PORT || 3000;  // Render sets PORT automatically

app.use(cors({
  origin: '*',  // allow all during initial deploy; tighten after frontend is live
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth',     authRoutes);
app.use('/api/courses',  courseRoutes);
app.use('/api/courses/:courseId/contents', contentRoutes);
app.use('/api/quizzes',  quizRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/student',  studentRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/profile',  profileRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Start server — listen FIRST, then sync DB
// This ensures Render detects the open port immediately
app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
});

// DB connect after server is already listening
sequelize.authenticate()
  .then(() => {
    console.log('✓ Database connected');
    return sequelize.sync({ force: false });
  })
  .then(() => {
    console.log('✓ Tables synced');
  })
  .catch(err => {
    console.error('✗ Database error:', err.message);
    // Don't exit — let health check still work so Render doesn't think it crashed
  });