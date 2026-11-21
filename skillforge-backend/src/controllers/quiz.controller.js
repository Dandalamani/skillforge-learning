const { publishQuiz, unpublishQuiz, deleteQuiz } = require('./quiz.publish');
const { validationResult } = require('express-validator');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const Course = require('../models/Course');
const { updateQuiz } = require('./quiz.update');

// ── Groq config ────────────────────────────────────────────────────────────
// llama-3.3-70b-versatile was shut down by Groq on Aug 16, 2026.
// Model is now configurable via the GROQ_MODEL env var.
// Recommended: openai/gpt-oss-120b  or  qwen/qwen3.6-27b
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// Free-tier limits (adjust to match your Groq plan)
const DAILY_LIMIT = 6000;
const MINUTE_LIMIT = 30;
const WARN_AT_PERCENT = 80; // warn at 80%

const usageStore = {
  date: new Date().toDateString(),
  count: 0,
  minuteCount: 0,
  minuteReset: Date.now() + 60000,
  history: [],
};

function getTodayUsage() {
  const today = new Date().toDateString();
  if (usageStore.date !== today) {
    usageStore.date = today;
    usageStore.count = 0;
    usageStore.history = [];
  }
  // Reset per-minute counter
  if (Date.now() > usageStore.minuteReset) {
    usageStore.minuteCount = 0;
    usageStore.minuteReset = Date.now() + 60000;
  }
  return usageStore;
}

function incrementUsage(user, topic) {
  const u = getTodayUsage();
  u.count++;
  u.minuteCount++;
  u.history.push({ user, topic, timestamp: new Date().toISOString() });
}

function getUsageSummary() {
  const u = getTodayUsage();
  const percent = Math.round((u.count / DAILY_LIMIT) * 100);
  return {
    used: u.count,
    limit: DAILY_LIMIT,
    percent,
    minuteUsed: u.minuteCount,
    minuteLimit: MINUTE_LIMIT,
    warning: percent >= WARN_AT_PERCENT,
    exhausted: u.count >= DAILY_LIMIT,
    history: u.history.slice(-20),
  };
}

// GET /api/quizzes/ai-usage
const getAiUsage = (req, res) => {
  return res.status(200).json({ usage: getUsageSummary() });
};

// GET /api/quizzes
const getQuizzes = async (req, res) => {
  try {
    const where = {};
    if (req.query.course_id) where.course_id = req.query.course_id;

    // Students only see PUBLISHED quizzes
    if (req.user.role === 'STUDENT') {
      where.status = 'PUBLISHED';
    }

    const quizzes = await Quiz.findAll({
      where,
      include: [
        { model: Course, as: 'course', attributes: ['id', 'title'] },
        { model: Question, as: 'questions' },
      ],
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json({ quizzes });
  } catch (error) {
    console.error('getQuizzes error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// GET /api/quizzes/:id
const getQuizById = async (req, res) => {
  try {
    const quiz = await Quiz.findByPk(req.params.id, {
      include: [{ model: Question, as: 'questions' }],
    });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });
    return res.status(200).json({ quiz });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// POST /api/quizzes
const createQuiz = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    const { title, description, course_id, time_limit_minutes, difficulty_level, questions } = req.body;
    const quiz = await Quiz.create({
      title, description, course_id,
      time_limit_minutes: time_limit_minutes || 30,
      difficulty_level: difficulty_level || 'BEGINNER',
      generated_by_ai: false,
    });
    if (questions?.length > 0) {
      await Question.bulkCreate(questions.map(q => ({ ...q, quiz_id: quiz.id })));
    }
    const fullQuiz = await Quiz.findByPk(quiz.id, { include: [{ model: Question, as: 'questions' }] });
    return res.status(201).json({ message: 'Quiz created.', quiz: fullQuiz });
  } catch (error) {
    console.error('Create quiz error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

// POST /api/quizzes/generate-ai
const generateAIQuiz = async (req, res) => {
  try {
    const topic = req.body.topic?.trim();
    const course_id = parseInt(req.body.course_id, 10);
    const num_questions = parseInt(req.body.num_questions, 10) || 5;
    const difficulty = req.body.difficulty || 'INTERMEDIATE';

    if (!topic || !course_id) {
      return res.status(400).json({ message: 'Topic and course are required.' });
    }
    if (isNaN(course_id)) {
      return res.status(400).json({ message: 'Invalid course selected.' });
    }

    // ── Check API key ──
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_groq_api_key_here') {
      return res.status(503).json({
        message: 'Groq API key not configured. Add GROQ_API_KEY to your .env file. Get a free key at console.groq.com',
      });
    }

    // ── Check daily quota ──
    const u = getTodayUsage();
    if (u.count >= DAILY_LIMIT) {
      return res.status(429).json({
        message: `Daily AI quota exhausted (${DAILY_LIMIT} requests/day). Resets at midnight.`,
        exhausted: true,
        usage: getUsageSummary(),
      });
    }

    // ── Check per-minute rate limit ──
    if (u.minuteCount >= MINUTE_LIMIT) {
      return res.status(429).json({
        message: `Rate limit: max ${MINUTE_LIMIT} requests/minute. Please wait a moment.`,
        rateLimited: true,
        usage: getUsageSummary(),
      });
    }

    // ── Warn if approaching limit ──
    const currentPercent = Math.round((u.count / DAILY_LIMIT) * 100);
    if (currentPercent >= WARN_AT_PERCENT) {
      console.warn(`[Groq Usage Warning] ${u.count}/${DAILY_LIMIT} daily requests used (${currentPercent}%)`);
    }

    // ── Verify course exists ──
    const course = await Course.findByPk(course_id);
    if (!course) return res.status(404).json({ message: 'Selected course not found.' });

    const userName = req.user?.name || req.user?.email || 'Unknown';

    // ── Build prompt ──
    const prompt = `You are an expert educator. Generate exactly ${num_questions} multiple choice quiz questions about "${topic}" at ${difficulty} level.
Return ONLY a valid JSON array with no markdown, no explanation, just raw JSON:
[
  {
    "question_text": "Question here?",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correct_answer": "A) option1",
    "explanation": "Brief explanation why this is correct"
  }
]
The "correct_answer" value must be copied exactly from one of the "options" strings.`;

    console.log(`[AI Quiz] Generating ${num_questions} questions on "${topic}" using Groq (${GROQ_MODEL})`);

    // ── Build request body ──
    const requestBody = {
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      // Reasoning models (gpt-oss) spend tokens on thinking, so allow more headroom
      max_tokens: 6000,
    };
    // Keep gpt-oss thinking short so the JSON answer is not truncated
    if (GROQ_MODEL.includes('gpt-oss')) {
      requestBody.reasoning_effort = 'low';
    }

    // ── Call Groq API ──
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => ({}));
      console.error('[Groq Error]', groqRes.status, errData);
      if (groqRes.status === 429) {
        return res.status(429).json({
          message: 'Groq rate limit hit. Please wait a moment and try again.',
          rateLimited: true,
          usage: getUsageSummary(),
        });
      }
      if (groqRes.status === 401) {
        return res.status(401).json({ message: 'Invalid Groq API key. Check your .env file.' });
      }
      const errMsg = errData?.error?.message || 'AI service unavailable.';
      return res.status(502).json({ message: `Groq error: ${errMsg}` });
    }

    const aiData = await groqRes.json();
    let rawText = aiData?.choices?.[0]?.message?.content || '';

    console.log('[Groq Raw]', rawText.substring(0, 200));

    // ── Strip <think> blocks (some reasoning models include them) ──
    rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // ── Strip markdown fences ──
    rawText = rawText.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    // Extract JSON array
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) rawText = jsonMatch[0];

    let generatedQuestions;
    try {
      generatedQuestions = JSON.parse(rawText);
      if (!Array.isArray(generatedQuestions)) throw new Error('Not an array');
    } catch (parseErr) {
      console.error('[Parse Error]', parseErr.message, '\nRaw:', rawText.substring(0, 300));
      return res.status(502).json({ message: 'Failed to parse AI response. Please retry.' });
    }

    if (generatedQuestions.length === 0) {
      return res.status(502).json({ message: 'AI returned no questions. Please retry with a different topic.' });
    }

    // ── Track usage ──
    incrementUsage(userName, topic);
    const usageSummary = getUsageSummary();

    // ── Save quiz to DB ──
    const quiz = await Quiz.create({
      title: `AI Quiz: ${topic}`,
      description: `Auto-generated quiz on "${topic}" at ${difficulty} level.`,
      course_id,
      generated_by_ai: true,
      difficulty_level: difficulty,
      time_limit_minutes: num_questions * 2,
    });

    await Question.bulkCreate(generatedQuestions.map(q => ({
      quiz_id: quiz.id,
      question_text: q.question_text || q.question || 'Question',
      question_type: 'MCQ',
      options: Array.isArray(q.options) ? q.options : [],
      correct_answer: q.correct_answer || q.answer || '',
      explanation: q.explanation || '',
      marks: 1,
    })));

    const fullQuiz = await Quiz.findByPk(quiz.id, {
      include: [{ model: Question, as: 'questions' }],
    });

    console.log(`[AI Quiz] ✓ Created quiz #${quiz.id} with ${generatedQuestions.length} questions. Usage: ${usageSummary.used}/${DAILY_LIMIT}`);

    return res.status(201).json({
      message: `✓ Generated ${generatedQuestions.length} questions on "${topic}"`,
      quiz: fullQuiz,
      usage: usageSummary,
    });

  } catch (error) {
    console.error('[AI Quiz Error]', error);
    return res.status(500).json({ message: 'Internal server error. Check backend logs.' });
  }
};

// POST /api/quizzes/:id/attempt
const submitQuizAttempt = async (req, res) => {
  try {
    const { answers } = req.body;
    const quiz = await Quiz.findByPk(req.params.id, {
      include: [{ model: Question, as: 'questions' }],
    });
    if (!quiz) return res.status(404).json({ message: 'Quiz not found.' });
    let score = 0, totalMarks = 0;
    const gradedAnswers = {};
    for (const question of quiz.questions) {
      const qId = String(question.id);
      totalMarks += question.marks;
      const studentAnswer = answers[qId];
      const isCorrect = studentAnswer === question.correct_answer;
      if (isCorrect) score += question.marks;
      gradedAnswers[qId] = { studentAnswer, correct: isCorrect, correctAnswer: question.correct_answer };
    }
    const percentage = totalMarks > 0 ? ((score / totalMarks) * 100).toFixed(2) : 0;
    const attempt = await QuizAttempt.create({
      quiz_id: quiz.id, student_id: req.user.id, answers,
      score: percentage, total_marks: totalMarks,
      attempt_time: new Date(), completed: true,
    });
    return res.status(200).json({
      message: 'Quiz submitted.',
      result: { score: percentage, totalMarks, gradedAnswers, attemptId: attempt.id },
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = {
  getQuizzes, getQuizById, createQuiz, generateAIQuiz, submitQuizAttempt,
  getAiUsage, publishQuiz, unpublishQuiz, deleteQuiz, updateQuiz,
};