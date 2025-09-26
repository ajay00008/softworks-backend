import request from 'supertest';
import { app } from '../../src/server';
import { connectDB, disconnectDB } from '../../src/config/database';
import { User } from '../../src/models/User';
import { Student } from '../../src/models/Student';
import { Class } from '../../src/models/Class';
import { Exam } from '../../src/models/Exam';
import { AnswerSheet } from '../../src/models/AnswerSheet';
import bcrypt from 'bcryptjs';

describe('Answer Sheet Integration Tests', () => {
  let authToken: string;
  let teacherId: string;
  let studentId: string;
  let examId: string;
  let classId: string;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({});
    await Student.deleteMany({});
    await Class.deleteMany({});
    await Exam.deleteMany({});
    await AnswerSheet.deleteMany({});

    // Create test data
    const hashedPassword = await bcrypt.hash('password123', 12);
    
    // Create teacher
    const teacher = await User.create({
      email: 'teacher@test.com',
      passwordHash: hashedPassword,
      name: 'Test Teacher',
      role: 'TEACHER',
      isActive: true
    });
    teacherId = teacher._id.toString();

    // Create student
    const student = await User.create({
      email: 'student@test.com',
      passwordHash: hashedPassword,
      name: 'Test Student',
      role: 'STUDENT',
      isActive: true
    });
    studentId = student._id.toString();

    // Create class
    const classObj = await Class.create({
      name: 'Test Class',
      displayName: 'Class 11A',
      level: 11,
      section: 'A',
      isActive: true
    });
    classId = classObj._id.toString();

    // Create student record
    await Student.create({
      userId: student._id,
      rollNumber: '001',
      classId: classObj._id,
      fatherName: 'Father Name',
      motherName: 'Mother Name',
      dateOfBirth: '2005-01-01',
      parentsEmail: 'parent@test.com',
      whatsappNumber: '+1234567890',
      address: 'Test Address'
    });

    // Create exam
    const exam = await Exam.create({
      title: 'Test Exam',
      examType: 'UNIT_TEST',
      subjectId: new mongoose.Types.ObjectId(),
      classId: classObj._id,
      totalMarks: 100,
      duration: 120,
      scheduledDate: new Date(),
      instructions: 'Test instructions',
      createdBy: teacher._id,
      isActive: true
    });
    examId = exam._id.toString();

    // Login as teacher
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'teacher@test.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
  });

  describe('POST /api/admin/answer-sheets/upload', () => {
    it('should upload answer sheet successfully', async () => {
      const response = await request(app)
        .post('/api/admin/answer-sheets/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          examId,
          studentId,
          originalFileName: 'test-sheet.jpg',
          cloudStorageUrl: 'https://example.com/sheet.jpg',
          cloudStorageKey: 'answer-sheets/test-sheet.jpg',
          language: 'ENGLISH'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should reject upload for non-existent exam', async () => {
      const response = await request(app)
        .post('/api/admin/answer-sheets/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          examId: new mongoose.Types.ObjectId().toString(),
          studentId,
          originalFileName: 'test-sheet.jpg',
          cloudStorageUrl: 'https://example.com/sheet.jpg',
          cloudStorageKey: 'answer-sheets/test-sheet.jpg'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate upload for same student', async () => {
      // First upload
      await request(app)
        .post('/api/admin/answer-sheets/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          examId,
          studentId,
          originalFileName: 'test-sheet.jpg',
          cloudStorageUrl: 'https://example.com/sheet.jpg',
          cloudStorageKey: 'answer-sheets/test-sheet.jpg'
        });

      // Second upload (should fail)
      const response = await request(app)
        .post('/api/admin/answer-sheets/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          examId,
          studentId,
          originalFileName: 'test-sheet2.jpg',
          cloudStorageUrl: 'https://example.com/sheet2.jpg',
          cloudStorageKey: 'answer-sheets/test-sheet2.jpg'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/answer-sheets/exam/:examId', () => {
    beforeEach(async () => {
      // Create test answer sheets
      await AnswerSheet.create([
        {
          examId,
          studentId,
          uploadedBy: teacherId,
          originalFileName: 'sheet1.jpg',
          cloudStorageUrl: 'https://example.com/sheet1.jpg',
          cloudStorageKey: 'answer-sheets/sheet1.jpg',
          status: 'UPLOADED',
          scanQuality: 'GOOD',
          isAligned: true,
          rollNumberDetected: '001',
          rollNumberConfidence: 95,
          language: 'ENGLISH'
        },
        {
          examId,
          studentId,
          uploadedBy: teacherId,
          originalFileName: 'sheet2.jpg',
          cloudStorageUrl: 'https://example.com/sheet2.jpg',
          cloudStorageKey: 'answer-sheets/sheet2.jpg',
          status: 'PROCESSING',
          scanQuality: 'FAIR',
          isAligned: false,
          rollNumberDetected: '002',
          rollNumberConfidence: 70,
          language: 'ENGLISH'
        }
      ]);
    });

    it('should get answer sheets for exam', async () => {
      const response = await request(app)
        .get(`/api/admin/answer-sheets/exam/${examId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get(`/api/admin/answer-sheets/exam/${examId}?status=UPLOADED`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('UPLOADED');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/admin/answer-sheets/exam/${examId}?page=1&limit=1`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('POST /api/admin/answer-sheets/:answerSheetId/missing', () => {
    let answerSheetId: string;

    beforeEach(async () => {
      const answerSheet = await AnswerSheet.create({
        examId,
        studentId,
        uploadedBy: teacherId,
        originalFileName: 'test-sheet.jpg',
        cloudStorageUrl: 'https://example.com/sheet.jpg',
        cloudStorageKey: 'answer-sheets/test-sheet.jpg',
        status: 'UPLOADED',
        scanQuality: 'GOOD',
        isAligned: true,
        language: 'ENGLISH'
      });
      answerSheetId = answerSheet._id.toString();
    });

    it('should mark answer sheet as missing', async () => {
      const response = await request(app)
        .post(`/api/admin/answer-sheets/${answerSheetId}/missing`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Student did not submit answer sheet'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isMissing).toBe(true);
      expect(response.body.data.missingReason).toBe('Student did not submit answer sheet');
    });

    it('should require reason for marking as missing', async () => {
      const response = await request(app)
        .post(`/api/admin/answer-sheets/${answerSheetId}/missing`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/admin/answer-sheets/exam/:examId/student/:studentId/absent', () => {
    it('should mark student as absent', async () => {
      const response = await request(app)
        .post(`/api/admin/answer-sheets/exam/${examId}/student/${studentId}/absent`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Student was sick'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isAbsent).toBe(true);
      expect(response.body.data.absentReason).toBe('Student was sick');
    });
  });

  describe('POST /api/admin/answer-sheets/:answerSheetId/manual-override', () => {
    let answerSheetId: string;

    beforeEach(async () => {
      const answerSheet = await AnswerSheet.create({
        examId,
        studentId,
        uploadedBy: teacherId,
        originalFileName: 'test-sheet.jpg',
        cloudStorageUrl: 'https://example.com/sheet.jpg',
        cloudStorageKey: 'answer-sheets/test-sheet.jpg',
        status: 'AI_CORRECTED',
        scanQuality: 'GOOD',
        isAligned: true,
        language: 'ENGLISH',
        aiCorrectionResults: {
          totalMarks: 80,
          answers: [],
          strengths: [],
          weakAreas: [],
          unansweredQuestions: [],
          irrelevantAnswers: [],
          overallFeedback: 'Good performance'
        }
      });
      answerSheetId = answerSheet._id.toString();
    });

    it('should add manual override', async () => {
      const response = await request(app)
        .post(`/api/admin/answer-sheets/${answerSheetId}/manual-override`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionId: new mongoose.Types.ObjectId().toString(),
          correctedAnswer: 'Corrected answer',
          correctedMarks: 5,
          reason: 'AI made an error in evaluation'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.manualOverrides).toHaveLength(1);
      expect(response.body.data.status).toBe('MANUALLY_REVIEWED');
    });

    it('should require all fields for manual override', async () => {
      const response = await request(app)
        .post(`/api/admin/answer-sheets/${answerSheetId}/manual-override`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          questionId: new mongoose.Types.ObjectId().toString(),
          correctedAnswer: 'Corrected answer'
          // Missing correctedMarks and reason
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/admin/answer-sheets/upload')
        .send({
          examId,
          studentId,
          originalFileName: 'test-sheet.jpg',
          cloudStorageUrl: 'https://example.com/sheet.jpg',
          cloudStorageKey: 'answer-sheets/test-sheet.jpg'
        });

      expect(response.status).toBe(401);
    });

    it('should require valid token', async () => {
      const response = await request(app)
        .post('/api/admin/answer-sheets/upload')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          examId,
          studentId,
          originalFileName: 'test-sheet.jpg',
          cloudStorageUrl: 'https://example.com/sheet.jpg',
          cloudStorageKey: 'answer-sheets/test-sheet.jpg'
        });

      expect(response.status).toBe(401);
    });
  });
});
