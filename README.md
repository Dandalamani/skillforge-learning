## SkillForge — AI-Driven Adaptive Learning Platform

A full-stack e-learning platform with AI-powered quiz generation, role-based dashboards, and real-time analytics.

## 📌 Overview :

SkillForge is a full-stack adaptive learning platform where Instructors create courses, upload content, and generate quizzes using AI, Students learn from courses, take timed quizzes, and track their progress, Admins manage users, courses, and monitor platform analytics

The standout feature is AI Quiz Generation — instructors enter a topic and the platform instantly generates a complete MCQ quiz using the Groq API with LLaMA 3.3 70B.

## 🚀 Live Demo

**Frontend**	--  https://skillforge-learning.vercel.app

**Backend API**	 --  https://skillforge-backend.onrender.com

Demo Accounts : Register fresh accounts on the live site using the Register page. Choose your role — Student, Instructor, or Admin.

## ✨ Features =>

**👨‍🏫 Instructor Panel :**

- Create, edit, publish and delete courses
- Upload video lessons and PDF documents with drag & drop and real-time progress bar
- Add external resource links (YouTube, GitHub, articles)
- AI Quiz Generator — enter any topic → get a complete quiz in seconds
- Manual quiz builder — write custom questions with 4 options each
- Edit, publish, unpublish and delete quizzes per course
- View student feedback with star ratings and comments
- Analytics dashboard with Chart.js — avg scores, pass rates, attempt trends

**🎓 Student Panel :**
- Browse all published courses
- Full course content viewer — video player, PDF iframe, link opener
- Take quizzes with countdown timer and question navigation
- Submit quiz answers → instant results with score and answer review
- Leave star ratings and feedback after each quiz
- Progress page with 3 charts — score trend, course comparison, pass/fail ratio

**🛡️ Admin Panel :**
- View all platform users with role filter, remove users
- View and delete all courses across the platform
- AI Logs — complete history of all AI-generated quizzes
- Reports page with 4 charts — platform overview, users by role, performance trend, content breakdown

## 🛠️ Tech Stack

**Frontend :**

- Angular 19 - Frontend framework
- Angular Signals -	Reactive state management
- Standalone Components	- Modular architecture without NgModule
- TypeScript - Type safety
- Chart.js 4.4 - Data visualization (bar, line, pie, doughnut)
- SCSS - Styling with design system

**Backend :**

- Node.js + Express	- REST API server
- Sequelize ORM -	Database abstraction
- JWT	Authentication - tokens
- bcryptjs - Password hashing
- Multer - File upload handling
- CORS - Cross-origin request handling

**AI & Database :** 

- Groq API - AI inference (fast LLM hosting)
- LLaMA 3.3 70B -	Quiz generation model
- PostgreSQL (Neon)	- Production database
- MySQL	- Local development database

**Deployment :**
- Vercel - Frontend hosting
- Render - Backend hosting
- Neon	- Serverless PostgreSQL
- GitHub	- Version control & CI/CD

## 🔐 Security : 
- Passwords hashed with bcryptjs (salt rounds: 10)
- JWT tokens signed with secret, expire in 7 days
- HTTP Interceptor auto-attaches token to every request
- Role-based middleware — authenticate + authorize on every protected route
- CORS configured to allow only the Vercel frontend domain

## 🚀 Deployment :

**=> Frontend → Vercel :**
- Build command: npx ng build --configuration production
- Output directory: dist/skillforge/browser
- vercel.json rewrite rule handles Angular client-side routing
  
**=> Backend → Render :**
- Root directory: skillforge-backend
- Start command: node src/server.js
- Environment variables set in Render dashboard
  
**=> Database → Neon :**
- Serverless PostgreSQL
- Sequelize auto-syncs tables on startup
- SSL connection required (rejectUnauthorized: false)

---
## 👨‍💻 Author
**Dandalamani**

GitHub: @Dandalamani
---

## 📄 License
This project is open source and available under the MIT License.
---
