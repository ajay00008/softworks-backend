import { Router } from "express";
import { upload } from "../config/multer";
import { login } from "../controllers/authController";
import { requireAuth, requireRoles } from "../middleware/auth";
import { createAdmin } from "../controllers/adminController";
import { createStudent, createTeacher } from "../controllers/userManagementController";
import { 
  createAdmin as createAdminSuper, 
  getAdmins, 
  getAdmin, 
  updateAdmin, 
  deleteAdmin, 
  activateAdmin 
} from "../controllers/superAdminController";
import { 
  createStudent as createStudentNew, 
  getStudents, 
  getStudent, 
  updateStudent, 
  deleteStudent, 
  activateStudent,
  getStudentsByClass,
  bulkCreateStudents
} from "../controllers/studentController";
import { 
  createTeacher as createTeacherNew, 
  getTeachers, 
  getTeacher, 
  updateTeacher, 
  deleteTeacher, 
  activateTeacher,
  assignSubjects,
  assignClasses,
  assignPermissions,
  getTeacherPermissions,
  bulkCreateTeachers
} from "../controllers/teacherController";
import {
  getMyStudents,
  getMySubjects,
  getMyClasses,
  getMyExams,
  getMyQuestions,
  getMyExamResults,
  getMyDashboard
} from "../controllers/teacherDataController";
import { 
  getClassSubjectMappings,
  getSubjectsForLevel,
  getTeachersForClass,
  getClassesForTeacher,
  getAssignedClassesForTeacher,
  validateConsistency
} from "../controllers/classSubjectController";
import {
  createQuestion,
  getQuestions,
  getQuestion,
  updateQuestion,
  deleteQuestion,
  generateQuestions,
  getQuestionStatistics
} from "../controllers/questionController";
import {
  createExam,
  getExams,
  getExam,
  updateExam,
  deleteExam,
  startExam,
  endExam,
  getExamResults,
  getExamStatistics
} from "../controllers/examController";
import {
  getIndividualPerformance,
  getClassPerformance,
  getPerformanceAnalytics,
  getPerformanceReport
} from "../controllers/performanceController";
import {
  getDashboardStats,
  getDashboardAnalytics,
  getIndividualStudentPerformance
} from "../controllers/dashboardController";
import {
  createSyllabus,
  getSyllabi,
  getSyllabus,
  updateSyllabus,
  deleteSyllabus,
  getSyllabusBySubjectClass,
  uploadSyllabusFile,
  getSyllabusStatistics
} from "../controllers/syllabusController";
import {
  reportAbsenteeism,
  getAbsenteeismReports,
  getAbsenteeismReport,
  acknowledgeAbsenteeism,
  resolveAbsenteeism,
  escalateAbsenteeism,
  updateAbsenteeism,
  deleteAbsenteeism,
  getAbsenteeismStatistics
} from "../controllers/absenteeismController";
import {
  printAllStudentsAnswers,
  printIndividualStudentAnswer,
  printClassResultsSummary,
  printPerformanceReport
} from "../controllers/printingController";
import {
  sendResultsToParents,
  sendBulkMessage,
  sendIndividualResult
} from "../controllers/communicationController";

const router = Router();

// Health
router.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login and get JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
// Auth
router.post("/auth/login", login);

/**
 * @openapi
 * /api/super/admins:
 *   post:
 *     tags: [Super Admin]
 *     summary: Create an Admin (Super Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin created
 */
router.post("/super/admins", requireAuth, requireRoles("SUPER_ADMIN"), createAdmin);

/**
 * @openapi
 * /api/admin/teachers:
 *   post:
 *     tags: [Admin]
 *     summary: Create a Teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               subjectIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Teacher created
 */
router.post("/admin/teachers", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), createTeacher);

/**
 * @openapi
 * /api/admin/students:
 *   post:
 *     tags: [Admin]
 *     summary: Create a Student (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, rollNumber, classId]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               rollNumber:
 *                 type: string
 *               classId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Student created
 */
router.post("/admin/students", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), createStudent);

// ==================== SUPER ADMIN ROUTES ====================

/**
 * @openapi
 * /api/super/admins:
 *   get:
 *     tags: [Super Admin]
 *     summary: Get all admins (Super Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of admins
 */
router.get("/super/admins", requireAuth, requireRoles("SUPER_ADMIN"), getAdmins);

/**
 * @openapi
 * /api/super/admins/{id}:
 *   get:
 *     tags: [Super Admin]
 *     summary: Get single admin (Super Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin details
 */
router.get("/super/admins/:id", requireAuth, requireRoles("SUPER_ADMIN"), getAdmin);

/**
 * @openapi
 * /api/super/admins/{id}:
 *   put:
 *     tags: [Super Admin]
 *     summary: Update admin (Super Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Admin updated
 */
router.put("/super/admins/:id", requireAuth, requireRoles("SUPER_ADMIN"), updateAdmin);

/**
 * @openapi
 * /api/super/admins/{id}:
 *   delete:
 *     tags: [Super Admin]
 *     summary: Deactivate admin (Super Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin deactivated
 */
router.delete("/super/admins/:id", requireAuth, requireRoles("SUPER_ADMIN"), deleteAdmin);

/**
 * @openapi
 * /api/super/admins/{id}/activate:
 *   patch:
 *     tags: [Super Admin]
 *     summary: Activate admin (Super Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin activated
 */
router.patch("/super/admins/:id/activate", requireAuth, requireRoles("SUPER_ADMIN"), activateAdmin);

// ==================== ADMIN ROUTES FOR STUDENTS ====================

/**
 * @openapi
 * /api/admin/students:
 *   get:
 *     tags: [Admin - Students]
 *     summary: Get all students (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of students
 */
router.get("/admin/students", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getStudents);

/**
 * @openapi
 * /api/admin/students/{id}:
 *   get:
 *     tags: [Admin - Students]
 *     summary: Get single student (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student details
 */
router.get("/admin/students/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getStudent);

/**
 * @openapi
 * /api/admin/students:
 *   post:
 *     tags: [Admin - Students]
 *     summary: Create a student (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name, rollNumber, classId]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               rollNumber:
 *                 type: string
 *               classId:
 *                 type: string
 *               fatherName:
 *                 type: string
 *               motherName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *               parentsPhone:
 *                 type: string
 *               parentsEmail:
 *                 type: string
 *                 format: email
 *               address:
 *                 type: string
 *               whatsappNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Student created
 */
router.post("/admin/students", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), createStudentNew);

/**
 * @openapi
 * /api/admin/students/{id}:
 *   put:
 *     tags: [Admin - Students]
 *     summary: Update student (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               rollNumber:
 *                 type: string
 *               classId:
 *                 type: string
 *               fatherName:
 *                 type: string
 *               motherName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *               parentsPhone:
 *                 type: string
 *               parentsEmail:
 *                 type: string
 *                 format: email
 *               address:
 *                 type: string
 *               whatsappNumber:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Student updated
 */
router.put("/admin/students/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), updateStudent);

/**
 * @openapi
 * /api/admin/students/{id}:
 *   delete:
 *     tags: [Admin - Students]
 *     summary: Delete student (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student deleted
 */
router.delete("/admin/students/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), deleteStudent);

/**
 * @openapi
 * /api/admin/students/{id}/activate:
 *   patch:
 *     tags: [Admin - Students]
 *     summary: Activate student (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student activated
 */
router.patch("/admin/students/:id/activate", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), activateStudent);

/**
 * @openapi
 * /api/admin/students/class/{classId}:
 *   get:
 *     tags: [Admin - Students]
 *     summary: Get students by class (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Students in class
 */
router.get("/admin/students/class/:classId", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getStudentsByClass);

/**
 * @openapi
 * /api/admin/students/bulk-upload:
 *   post:
 *     tags: [Admin - Students]
 *     summary: Bulk create students from CSV file (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing student data
 *     responses:
 *       201:
 *         description: Students created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRows:
 *                       type: number
 *                     created:
 *                       type: number
 *                     errors:
 *                       type: number
 *                     students:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           email:
 *                             type: string
 *                           name:
 *                             type: string
 *                           rollNumber:
 *                             type: string
 *                           className:
 *                             type: string
 *                           isActive:
 *                             type: boolean
 *                           rowNumber:
 *                             type: number
 *       400:
 *         description: Validation errors in CSV file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:
 *                         type: number
 *                       errors:
 *                         type: array
 *                         items:
 *                           type: string
 *                 totalRows:
 *                   type: number
 *                 errorRows:
 *                   type: number
 *                 validRows:
 *                   type: number
 */
router.post("/admin/students/bulk-upload", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), upload.single('file'), bulkCreateStudents);

// ==================== ADMIN ROUTES FOR TEACHERS ====================

/**
 * @openapi
 * /api/admin/teachers:
 *   get:
 *     tags: [Admin - Teachers]
 *     summary: Get all teachers (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of teachers
 */
router.get("/admin/teachers", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getTeachers);

/**
 * @openapi
 * /api/admin/teachers/{id}:
 *   get:
 *     tags: [Admin - Teachers]
 *     summary: Get single teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teacher details
 */
router.get("/admin/teachers/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getTeacher);

/**
 * @openapi
 * /api/admin/teachers:
 *   post:
 *     tags: [Admin - Teachers]
 *     summary: Create a teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, name]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               subjectIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               classIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               qualification:
 *                 type: string
 *               experience:
 *                 type: string
 *     responses:
 *       201:
 *         description: Teacher created
 */
router.post("/admin/teachers", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), createTeacherNew);

/**
 * @openapi
 * /api/admin/teachers/{id}:
 *   put:
 *     tags: [Admin - Teachers]
 *     summary: Update teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               subjectIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               classIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               qualification:
 *                 type: string
 *               experience:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Teacher updated
 */
router.put("/admin/teachers/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), updateTeacher);

/**
 * @openapi
 * /api/admin/teachers/{id}:
 *   delete:
 *     tags: [Admin - Teachers]
 *     summary: Delete teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teacher deleted
 */
router.delete("/admin/teachers/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), deleteTeacher);

/**
 * @openapi
 * /api/admin/teachers/{id}/activate:
 *   patch:
 *     tags: [Admin - Teachers]
 *     summary: Activate teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teacher activated
 */
router.patch("/admin/teachers/:id/activate", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), activateTeacher);


/**
 * @openapi
 * /api/admin/teachers/{id}/subjects:
 *   patch:
 *     tags: [Admin - Teachers]
 *     summary: Assign subjects to teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subjectIds]
 *             properties:
 *               subjectIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Subjects assigned
 */
router.patch("/admin/teachers/:id/subjects", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), assignSubjects);

/**
 * @openapi
 * /api/admin/teachers/{id}/classes:
 *   patch:
 *     tags: [Admin - Teachers]
 *     summary: Assign classes to teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [classIds]
 *             properties:
 *               classIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Classes assigned
 */
router.patch("/admin/teachers/:id/classes", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), assignClasses);

/**
 * @openapi
 * /api/admin/teachers/{id}/permissions:
 *   patch:
 *     tags: [Admin - Teachers]
 *     summary: Assign comprehensive permissions to teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subjectIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               classIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               permissions:
 *                 type: object
 *                 properties:
 *                   createQuestions:
 *                     type: boolean
 *                     description: Allow teacher to create and manage questions
 *                   viewResults:
 *                     type: boolean
 *                     description: Allow teacher to view student results
 *                   manageStudents:
 *                     type: boolean
 *                     description: Allow teacher to manage student data
 *                   accessAnalytics:
 *                     type: boolean
 *                     description: Allow teacher to view performance analytics
 *     responses:
 *       200:
 *         description: Teacher permissions updated successfully
 */
router.patch("/admin/teachers/:id/permissions", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), assignPermissions);

/**
 * @openapi
 * /api/admin/teachers/{id}/permissions:
 *   get:
 *     tags: [Admin - Teachers]
 *     summary: Get teacher's current permissions (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Teacher permissions retrieved successfully
 */
router.get("/admin/teachers/:id/permissions", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getTeacherPermissions);

/**
 * @openapi
 * /api/admin/teachers/bulk-upload:
 *   post:
 *     tags: [Admin - Teachers]
 *     summary: Bulk create teachers from CSV file (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing teacher data
 *     responses:
 *       201:
 *         description: Teachers created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRows:
 *                       type: number
 *                     created:
 *                       type: number
 *                     errors:
 *                       type: number
 *                     teachers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           email:
 *                             type: string
 *                           name:
 *                             type: string
 *                           qualification:
 *                             type: string
 *                           experience:
 *                             type: number
 *                           phone:
 *                             type: string
 *                           address:
 *                             type: string
 *                           isActive:
 *                             type: boolean
 *                           rowNumber:
 *                             type: number
 *       400:
 *         description: Validation errors in CSV file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       row:
 *                         type: number
 *                       errors:
 *                         type: array
 *                         items:
 *                           type: string
 *                 totalRows:
 *                   type: number
 *                 errorRows:
 *                   type: number
 *                 validRows:
 *                   type: number
 */
router.post("/admin/teachers/bulk-upload", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), upload.single('file'), bulkCreateTeachers);

// ==================== TEACHER DATA ACCESS ROUTES ====================

/**
 * @openapi
 * /api/teacher/students:
 *   get:
 *     tags: [Teacher - Data Access]
 *     summary: Get students assigned to teacher's classes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned students
 */
router.get("/teacher/students", requireAuth, requireRoles("TEACHER"), getMyStudents);

/**
 * @openapi
 * /api/teacher/subjects:
 *   get:
 *     tags: [Teacher - Data Access]
 *     summary: Get subjects assigned to teacher
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned subjects
 */
router.get("/teacher/subjects", requireAuth, requireRoles("TEACHER"), getMySubjects);

/**
 * @openapi
 * /api/teacher/classes:
 *   get:
 *     tags: [Teacher - Data Access]
 *     summary: Get classes assigned to teacher
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned classes
 */
router.get("/teacher/classes", requireAuth, requireRoles("TEACHER"), getMyClasses);

/**
 * @openapi
 * /api/teacher/exams:
 *   get:
 *     tags: [Teacher - Data Access]
 *     summary: Get exams for teacher's assigned subjects/classes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned exams
 */
router.get("/teacher/exams", requireAuth, requireRoles("TEACHER"), getMyExams);

/**
 * @openapi
 * /api/teacher/questions:
 *   get:
 *     tags: [Teacher - Data Access]
 *     summary: Get questions for teacher's assigned subjects/classes
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: unit
 *         schema:
 *           type: string
 *       - in: query
 *         name: bloomsTaxonomyLevel
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *       - in: query
 *         name: isTwisted
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned questions
 */
router.get("/teacher/questions", requireAuth, requireRoles("TEACHER"), getMyQuestions);

/**
 * @openapi
 * /api/teacher/exams/{examId}/results:
 *   get:
 *     tags: [Teacher - Data Access]
 *     summary: Get exam results for teacher's assigned exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Exam results for assigned exam
 *       403:
 *         description: No permission to view this exam's results
 */
router.get("/teacher/exams/:examId/results", requireAuth, requireRoles("TEACHER"), getMyExamResults);

/**
 * @openapi
 * /api/teacher/dashboard:
 *   get:
 *     tags: [Teacher - Data Access]
 *     summary: Get teacher's dashboard data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Teacher dashboard data
 */
router.get("/teacher/dashboard", requireAuth, requireRoles("TEACHER"), getMyDashboard);

// ==================== CLASS-SUBJECT MAPPING ROUTES ====================

/**
 * @openapi
 * /api/admin/class-subject-mappings:
 *   get:
 *     tags: [Admin - Class-Subject Mapping]
 *     summary: Get all class-subject mappings (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of class-subject mappings
 */
router.get("/admin/class-subject-mappings", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getClassSubjectMappings);

/**
 * @openapi
 * /api/admin/subjects/level/{level}:
 *   get:
 *     tags: [Admin - Class-Subject Mapping]
 *     summary: Get subjects for a specific class level (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: level
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *     responses:
 *       200:
 *         description: List of subjects for the class level
 */
router.get("/admin/subjects/level/:level", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getSubjectsForLevel);

/**
 * @openapi
 * /api/admin/classes/{classId}/teachers:
 *   get:
 *     tags: [Admin - Class-Subject Mapping]
 *     summary: Get teachers who can teach a specific class (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of teachers who can teach the class
 */
router.get("/admin/classes/:classId/teachers", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getTeachersForClass);

/**
 * @openapi
 * /api/admin/teachers/{teacherId}/classes:
 *   get:
 *     tags: [Admin - Class-Subject Mapping]
 *     summary: Get classes that a teacher can teach (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of classes the teacher can teach
 */
router.get("/admin/teachers/:teacherId/classes", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getClassesForTeacher);

/**
 * @openapi
 * /api/admin/teachers/{teacherId}/assigned-classes:
 *   get:
 *     tags: [Admin - Class-Subject Mapping]
 *     summary: Get assigned classes for a teacher (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of assigned classes for the teacher
 */
router.get("/admin/teachers/:teacherId/assigned-classes", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getAssignedClassesForTeacher);

/**
 * @openapi
 * /api/admin/validate-consistency:
 *   get:
 *     tags: [Admin - Class-Subject Mapping]
 *     summary: Validate data consistency across all models (Admin or Super Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data consistency validation results
 */
router.get("/admin/validate-consistency", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), validateConsistency);

// ==================== QUESTION MANAGEMENT ROUTES ====================

/**
 * @openapi
 * /api/admin/questions:
 *   post:
 *     tags: [Admin - Questions]
 *     summary: Create a new question with Blooms taxonomy
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionText, questionType, subjectId, classId, unit, bloomsTaxonomyLevel, difficulty, correctAnswer, marks]
 *             properties:
 *               questionText:
 *                 type: string
 *                 minLength: 10
 *               questionType:
 *                 type: string
 *                 enum: [MULTIPLE_CHOICE, SHORT_ANSWER, LONG_ANSWER, TRUE_FALSE, FILL_BLANKS]
 *               subjectId:
 *                 type: string
 *               classId:
 *                 type: string
 *               unit:
 *                 type: string
 *               bloomsTaxonomyLevel:
 *                 type: string
 *                 enum: [REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE]
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MODERATE, TOUGHEST]
 *               isTwisted:
 *                 type: boolean
 *                 default: false
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               correctAnswer:
 *                 type: string
 *               explanation:
 *                 type: string
 *               marks:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *               timeLimit:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 300
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               language:
 *                 type: string
 *                 enum: [ENGLISH, TAMIL, HINDI, MALAYALAM, TELUGU, KANNADA]
 *                 default: ENGLISH
 *     responses:
 *       201:
 *         description: Question created successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Subject or class not found
 */
router.post("/admin/questions", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), createQuestion);

/**
 * @openapi
 * /api/admin/questions:
 *   get:
 *     tags: [Admin - Questions]
 *     summary: Get all questions with filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: unit
 *         schema:
 *           type: string
 *       - in: query
 *         name: bloomsTaxonomyLevel
 *         schema:
 *           type: string
 *           enum: [REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE]
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [EASY, MODERATE, TOUGHEST]
 *       - in: query
 *         name: isTwisted
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of questions
 */
router.get("/admin/questions", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getQuestions);

/**
 * @openapi
 * /api/admin/questions/{id}:
 *   get:
 *     tags: [Admin - Questions]
 *     summary: Get a single question by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Question details
 *       404:
 *         description: Question not found
 */
router.get("/admin/questions/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getQuestion);

/**
 * @openapi
 * /api/admin/questions/{id}:
 *   put:
 *     tags: [Admin - Questions]
 *     summary: Update a question
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questionText:
 *                 type: string
 *               questionType:
 *                 type: string
 *                 enum: [MULTIPLE_CHOICE, SHORT_ANSWER, LONG_ANSWER, TRUE_FALSE, FILL_BLANKS]
 *               subjectId:
 *                 type: string
 *               classId:
 *                 type: string
 *               unit:
 *                 type: string
 *               bloomsTaxonomyLevel:
 *                 type: string
 *                 enum: [REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE]
 *               difficulty:
 *                 type: string
 *                 enum: [EASY, MODERATE, TOUGHEST]
 *               isTwisted:
 *                 type: boolean
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *               correctAnswer:
 *                 type: string
 *               explanation:
 *                 type: string
 *               marks:
 *                 type: number
 *               timeLimit:
 *                 type: number
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               language:
 *                 type: string
 *                 enum: [ENGLISH, TAMIL, HINDI, MALAYALAM, TELUGU, KANNADA]
 *     responses:
 *       200:
 *         description: Question updated successfully
 *       404:
 *         description: Question not found
 */
router.put("/admin/questions/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), updateQuestion);

/**
 * @openapi
 * /api/admin/questions/{id}:
 *   delete:
 *     tags: [Admin - Questions]
 *     summary: Delete a question
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Question deleted successfully
 *       404:
 *         description: Question not found
 */
router.delete("/admin/questions/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), deleteQuestion);

/**
 * @openapi
 * /api/admin/questions/generate:
 *   post:
 *     tags: [Admin - Questions]
 *     summary: Generate questions using AI with Blooms taxonomy
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subjectId, classId, unit, questionDistribution, totalQuestions]
 *             properties:
 *               subjectId:
 *                 type: string
 *               classId:
 *                 type: string
 *               unit:
 *                 type: string
 *               questionDistribution:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     bloomsLevel:
 *                       type: string
 *                       enum: [REMEMBER, UNDERSTAND, APPLY, ANALYZE, EVALUATE, CREATE]
 *                     difficulty:
 *                       type: string
 *                       enum: [EASY, MODERATE, TOUGHEST]
 *                     percentage:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     twistedPercentage:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *               totalQuestions:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *               language:
 *                 type: string
 *                 enum: [ENGLISH, TAMIL, HINDI, MALAYALAM, TELUGU, KANNADA]
 *                 default: ENGLISH
 *     responses:
 *       201:
 *         description: Questions generated successfully
 *       400:
 *         description: Invalid input data
 */
router.post("/admin/questions/generate", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), generateQuestions);

/**
 * @openapi
 * /api/admin/questions/statistics:
 *   get:
 *     tags: [Admin - Questions]
 *     summary: Get question statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Question statistics
 */
router.get("/admin/questions/statistics", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getQuestionStatistics);

// ==================== EXAM MANAGEMENT ROUTES ====================

/**
 * @openapi
 * /api/admin/exams:
 *   post:
 *     tags: [Admin - Exams]
 *     summary: Create a new exam
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, examType, subjectId, classId, totalMarks, duration, scheduledDate]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               examType:
 *                 type: string
 *                 enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *               subjectId:
 *                 type: string
 *               classId:
 *                 type: string
 *               totalMarks:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 1000
 *               duration:
 *                 type: number
 *                 minimum: 15
 *                 maximum: 480
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               questions:
 *                 type: array
 *                 items:
 *                   type: string
 *               questionDistribution:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     unit:
 *                       type: string
 *                     bloomsLevel:
 *                       type: string
 *                     difficulty:
 *                       type: string
 *                     percentage:
 *                       type: number
 *                     twistedPercentage:
 *                       type: number
 *               instructions:
 *                 type: string
 *               allowLateSubmission:
 *                 type: boolean
 *               lateSubmissionPenalty:
 *                 type: number
 *     responses:
 *       201:
 *         description: Exam created successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Subject or class not found
 */
router.post("/admin/exams", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), createExam);

/**
 * @openapi
 * /api/admin/exams:
 *   get:
 *     tags: [Admin - Exams]
 *     summary: Get all exams with filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, SCHEDULED, ONGOING, COMPLETED, CANCELLED]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of exams
 */
router.get("/admin/exams", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getExams);

/**
 * @openapi
 * /api/admin/exams/{id}:
 *   get:
 *     tags: [Admin - Exams]
 *     summary: Get a single exam by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exam details
 *       404:
 *         description: Exam not found
 */
router.get("/admin/exams/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getExam);

/**
 * @openapi
 * /api/admin/exams/{id}:
 *   put:
 *     tags: [Admin - Exams]
 *     summary: Update an exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               examType:
 *                 type: string
 *                 enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *               subjectId:
 *                 type: string
 *               classId:
 *                 type: string
 *               totalMarks:
 *                 type: number
 *               duration:
 *                 type: number
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [DRAFT, SCHEDULED, ONGOING, COMPLETED, CANCELLED]
 *               questions:
 *                 type: array
 *                 items:
 *                   type: string
 *               instructions:
 *                 type: string
 *     responses:
 *       200:
 *         description: Exam updated successfully
 *       404:
 *         description: Exam not found
 */
router.put("/admin/exams/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), updateExam);

/**
 * @openapi
 * /api/admin/exams/{id}:
 *   delete:
 *     tags: [Admin - Exams]
 *     summary: Delete an exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exam deleted successfully
 *       400:
 *         description: Cannot delete exam with existing results
 *       404:
 *         description: Exam not found
 */
router.delete("/admin/exams/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), deleteExam);

/**
 * @openapi
 * /api/admin/exams/{id}/start:
 *   patch:
 *     tags: [Admin - Exams]
 *     summary: Start an exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exam started successfully
 *       400:
 *         description: Exam is not in scheduled status
 *       404:
 *         description: Exam not found
 */
router.patch("/admin/exams/:id/start", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), startExam);

/**
 * @openapi
 * /api/admin/exams/{id}/end:
 *   patch:
 *     tags: [Admin - Exams]
 *     summary: End an exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exam ended successfully
 *       400:
 *         description: Exam is not currently ongoing
 *       404:
 *         description: Exam not found
 */
router.patch("/admin/exams/:id/end", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), endExam);

/**
 * @openapi
 * /api/admin/exams/{id}/results:
 *   get:
 *     tags: [Admin - Exams]
 *     summary: Get exam results
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Exam results
 *       404:
 *         description: Exam not found
 */
router.get("/admin/exams/:id/results", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getExamResults);

/**
 * @openapi
 * /api/admin/exams/{id}/statistics:
 *   get:
 *     tags: [Admin - Exams]
 *     summary: Get exam statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exam statistics
 *       404:
 *         description: Exam not found
 */
router.get("/admin/exams/:id/statistics", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getExamStatistics);

// ==================== DASHBOARD ROUTES ====================

/**
 * @openapi
 * /api/admin/dashboard/stats:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get comprehensive dashboard statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [current, monthly, quarterly, yearly]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get("/admin/dashboard/stats", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getDashboardStats);

/**
 * @openapi
 * /api/admin/dashboard/analytics:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get dashboard analytics with trends
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [current, monthly, quarterly, yearly]
 *     responses:
 *       200:
 *         description: Dashboard analytics
 */
router.get("/admin/dashboard/analytics", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getDashboardAnalytics);

/**
 * @openapi
 * /api/admin/dashboard/student/{studentId}:
 *   get:
 *     tags: [Admin - Dashboard]
 *     summary: Get individual student performance for dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [current, monthly, quarterly, yearly]
 *     responses:
 *       200:
 *         description: Individual student performance
 *       404:
 *         description: Student not found
 */
router.get("/admin/dashboard/student/:studentId", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getIndividualStudentPerformance);

// ==================== PERFORMANCE MONITORING ROUTES ====================

/**
 * @openapi
 * /api/admin/performance/individual/{studentId}:
 *   get:
 *     tags: [Admin - Performance]
 *     summary: Get individual student performance
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Individual student performance data
 *       404:
 *         description: Student not found
 */
router.get("/admin/performance/individual/:studentId", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getIndividualPerformance);

/**
 * @openapi
 * /api/admin/performance/class/{classId}:
 *   get:
 *     tags: [Admin - Performance]
 *     summary: Get class performance analytics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Class performance analytics
 *       404:
 *         description: Class not found
 */
router.get("/admin/performance/class/:classId", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getClassPerformance);

/**
 * @openapi
 * /api/admin/performance/analytics:
 *   get:
 *     tags: [Admin - Performance]
 *     summary: Get comprehensive performance analytics dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [UNIT_TEST, MID_TERM, FINAL, QUIZ, ASSIGNMENT, PRACTICAL]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Performance analytics dashboard data
 */
router.get("/admin/performance/analytics", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getPerformanceAnalytics);

/**
 * @openapi
 * /api/admin/performance/reports/{type}:
 *   get:
 *     tags: [Admin - Performance]
 *     summary: Get performance reports for printing
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [individual, class]
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: examId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Performance report data
 *       400:
 *         description: Invalid report type or missing parameters
 */
router.get("/admin/performance/reports/:type", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getPerformanceReport);

// ==================== SYLLABUS MANAGEMENT ROUTES ====================

/**
 * @openapi
 * /api/admin/syllabi:
 *   post:
 *     tags: [Admin - Syllabus]
 *     summary: Create a new syllabus
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, subjectId, classId, academicYear, units, totalHours]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               subjectId:
 *                 type: string
 *               classId:
 *                 type: string
 *               academicYear:
 *                 type: string
 *               units:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     unitNumber:
 *                       type: number
 *                     unitName:
 *                       type: string
 *                     topics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           topicName:
 *                             type: string
 *                           subtopics:
 *                             type: array
 *                             items:
 *                               type: string
 *                           learningObjectives:
 *                             type: array
 *                             items:
 *                               type: string
 *                           estimatedHours:
 *                             type: number
 *                     totalHours:
 *                       type: number
 *               totalHours:
 *                 type: number
 *               fileUrl:
 *                 type: string
 *               version:
 *                 type: string
 *                 default: "1.0"
 *               language:
 *                 type: string
 *                 enum: [ENGLISH, TAMIL, HINDI, MALAYALAM, TELUGU, KANNADA]
 *                 default: ENGLISH
 *     responses:
 *       201:
 *         description: Syllabus created successfully
 *       400:
 *         description: Invalid input data
 *       404:
 *         description: Subject or class not found
 *       409:
 *         description: Syllabus already exists for this subject, class, and academic year
 */
router.post("/admin/syllabi", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), createSyllabus);

/**
 * @openapi
 * /api/admin/syllabi:
 *   get:
 *     tags: [Admin - Syllabus]
 *     summary: Get all syllabi with filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: subjectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: List of syllabi
 */
router.get("/admin/syllabi", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getSyllabi);

/**
 * @openapi
 * /api/admin/syllabi/{id}:
 *   get:
 *     tags: [Admin - Syllabus]
 *     summary: Get a single syllabus by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Syllabus details
 *       404:
 *         description: Syllabus not found
 */
router.get("/admin/syllabi/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getSyllabus);

/**
 * @openapi
 * /api/admin/syllabi/{id}:
 *   put:
 *     tags: [Admin - Syllabus]
 *     summary: Update a syllabus
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               subjectId:
 *                 type: string
 *               classId:
 *                 type: string
 *               academicYear:
 *                 type: string
 *               units:
 *                 type: array
 *               totalHours:
 *                 type: number
 *               fileUrl:
 *                 type: string
 *               version:
 *                 type: string
 *               language:
 *                 type: string
 *                 enum: [ENGLISH, TAMIL, HINDI, MALAYALAM, TELUGU, KANNADA]
 *     responses:
 *       200:
 *         description: Syllabus updated successfully
 *       404:
 *         description: Syllabus not found
 *       409:
 *         description: Syllabus already exists for this subject, class, and academic year
 */
router.put("/admin/syllabi/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), updateSyllabus);

/**
 * @openapi
 * /api/admin/syllabi/{id}:
 *   delete:
 *     tags: [Admin - Syllabus]
 *     summary: Delete a syllabus
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Syllabus deleted successfully
 *       404:
 *         description: Syllabus not found
 */
router.delete("/admin/syllabi/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), deleteSyllabus);

/**
 * @openapi
 * /api/admin/syllabi/subject/{subjectId}/class/{classId}:
 *   get:
 *     tags: [Admin - Syllabus]
 *     summary: Get syllabus by subject and class
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subjectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Syllabus for subject and class
 *       404:
 *         description: Syllabus not found for this subject and class
 */
router.get("/admin/syllabi/subject/:subjectId/class/:classId", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getSyllabusBySubjectClass);

/**
 * @openapi
 * /api/admin/syllabi/{id}/upload:
 *   post:
 *     tags: [Admin - Syllabus]
 *     summary: Upload syllabus file
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fileUrl]
 *             properties:
 *               fileUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Syllabus file uploaded successfully
 *       404:
 *         description: Syllabus not found
 */
router.post("/admin/syllabi/:id/upload", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), uploadSyllabusFile);

/**
 * @openapi
 * /api/admin/syllabi/statistics:
 *   get:
 *     tags: [Admin - Syllabus]
 *     summary: Get syllabus statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Syllabus statistics
 */
router.get("/admin/syllabi/statistics", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getSyllabusStatistics);

// ==================== ABSENTEEISM TRACKING ROUTES ====================

/**
 * @openapi
 * /api/admin/absenteeism:
 *   post:
 *     tags: [Admin - Absenteeism]
 *     summary: Report absenteeism or missing answer sheet
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [examId, studentId, type]
 *             properties:
 *               examId:
 *                 type: string
 *               studentId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [ABSENT, MISSING_SHEET, LATE_SUBMISSION]
 *               reason:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 default: MEDIUM
 *     responses:
 *       201:
 *         description: Absenteeism reported successfully
 *       404:
 *         description: Exam or student not found
 *       409:
 *         description: Absenteeism already reported for this exam and student
 */
router.post("/admin/absenteeism", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), reportAbsenteeism);

/**
 * @openapi
 * /api/admin/absenteeism:
 *   get:
 *     tags: [Admin - Absenteeism]
 *     summary: Get all absenteeism reports with filtering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: examId
 *         schema:
 *           type: string
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ABSENT, MISSING_SHEET, LATE_SUBMISSION]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ACKNOWLEDGED, RESOLVED, ESCALATED]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *     responses:
 *       200:
 *         description: List of absenteeism reports
 */
router.get("/admin/absenteeism", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getAbsenteeismReports);

/**
 * @openapi
 * /api/admin/absenteeism/{id}:
 *   get:
 *     tags: [Admin - Absenteeism]
 *     summary: Get a single absenteeism report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Absenteeism report details
 *       404:
 *         description: Absenteeism report not found
 */
router.get("/admin/absenteeism/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN", "TEACHER"), getAbsenteeismReport);

/**
 * @openapi
 * /api/admin/absenteeism/{id}/acknowledge:
 *   patch:
 *     tags: [Admin - Absenteeism]
 *     summary: Acknowledge an absenteeism report (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminRemarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Absenteeism acknowledged successfully
 *       400:
 *         description: Absenteeism report is not in pending status
 *       404:
 *         description: Absenteeism report not found
 */
router.patch("/admin/absenteeism/:id/acknowledge", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), acknowledgeAbsenteeism);

/**
 * @openapi
 * /api/admin/absenteeism/{id}/resolve:
 *   patch:
 *     tags: [Admin - Absenteeism]
 *     summary: Resolve an absenteeism report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminRemarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Absenteeism resolved successfully
 *       400:
 *         description: Absenteeism report is already resolved
 *       404:
 *         description: Absenteeism report not found
 */
router.patch("/admin/absenteeism/:id/resolve", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), resolveAbsenteeism);

/**
 * @openapi
 * /api/admin/absenteeism/statistics:
 *   get:
 *     tags: [Admin - Absenteeism]
 *     summary: Get absenteeism statistics
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: examId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Absenteeism statistics
 */
router.get("/admin/absenteeism/statistics", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), getAbsenteeismStatistics);

/**
 * @openapi
 * /api/admin/absenteeism/{id}/escalate:
 *   patch:
 *     tags: [Admin - Absenteeism]
 *     summary: Escalate absenteeism report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Absenteeism report escalated successfully
 *       404:
 *         description: Absenteeism report not found
 */
router.patch("/admin/absenteeism/:id/escalate", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), escalateAbsenteeism);

/**
 * @openapi
 * /api/admin/absenteeism/{id}:
 *   put:
 *     tags: [Admin - Absenteeism]
 *     summary: Update absenteeism report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [ABSENT, MISSING_SHEET, LATE_SUBMISSION]
 *               reason:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *     responses:
 *       200:
 *         description: Absenteeism report updated successfully
 *       404:
 *         description: Absenteeism report not found
 */
router.put("/admin/absenteeism/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), updateAbsenteeism);

/**
 * @openapi
 * /api/admin/absenteeism/{id}:
 *   delete:
 *     tags: [Admin - Absenteeism]
 *     summary: Delete absenteeism report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Absenteeism report deleted successfully
 *       404:
 *         description: Absenteeism report not found
 */
router.delete("/admin/absenteeism/:id", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), deleteAbsenteeism);

// ==================== PRINTING ROUTES ====================

/**
 * @openapi
 * /api/admin/print/exams/{examId}/answers:
 *   get:
 *     tags: [Admin - Printing]
 *     summary: Print all students' answers for an exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeAnswers
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includeGrades
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includeStatistics
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Print data generated successfully
 *       404:
 *         description: Exam not found
 */
router.get("/admin/print/exams/:examId/answers", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), printAllStudentsAnswers);

/**
 * @openapi
 * /api/admin/print/exams/{examId}/students/{studentId}:
 *   get:
 *     tags: [Admin - Printing]
 *     summary: Print individual student's answer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeAnswers
 *         schema:
 *           type: boolean
 *           default: true
 *       - in: query
 *         name: includeGrades
 *         schema:
 *           type: boolean
 *           default: true
 *     responses:
 *       200:
 *         description: Print data generated successfully
 *       404:
 *         description: Exam or student not found
 */
router.get("/admin/print/exams/:examId/students/:studentId", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), printIndividualStudentAnswer);

/**
 * @openapi
 * /api/admin/print/exams/{examId}/summary:
 *   get:
 *     tags: [Admin - Printing]
 *     summary: Print class results summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeStatistics
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Class results summary generated successfully
 *       404:
 *         description: Exam not found
 */
router.get("/admin/print/exams/:examId/summary", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), printClassResultsSummary);

// ==================== COMMUNICATION ROUTES ====================

/**
 * @openapi
 * /api/admin/communication/results:
 *   post:
 *     tags: [Admin - Communication]
 *     summary: Send results to parents via WhatsApp/Email
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [examId, communicationMethod]
 *             properties:
 *               examId:
 *                 type: string
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               communicationMethod:
 *                 type: string
 *                 enum: [EMAIL, WHATSAPP, BOTH]
 *               message:
 *                 type: string
 *               includeAnswers:
 *                 type: boolean
 *                 default: false
 *               includeStatistics:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Results sent successfully
 *       404:
 *         description: Exam not found
 */
router.post("/admin/communication/results", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), sendResultsToParents);

/**
 * @openapi
 * /api/admin/communication/bulk:
 *   post:
 *     tags: [Admin - Communication]
 *     summary: Send bulk messages to parents
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [communicationMethod, subject, message]
 *             properties:
 *               studentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               classId:
 *                 type: string
 *               communicationMethod:
 *                 type: string
 *                 enum: [EMAIL, WHATSAPP, BOTH]
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Bulk message sent successfully
 *       400:
 *         description: Either studentIds or classId must be provided
 */
router.post("/admin/communication/bulk", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), sendBulkMessage);

/**
 * @openapi
 * /api/admin/communication/results/{examId}/students/{studentId}:
 *   post:
 *     tags: [Admin - Communication]
 *     summary: Send individual student result to parents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: examId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [communicationMethod]
 *             properties:
 *               communicationMethod:
 *                 type: string
 *                 enum: [EMAIL, WHATSAPP, BOTH]
 *               message:
 *                 type: string
 *               includeAnswers:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Individual result sent successfully
 *       404:
 *         description: Exam, student, or result not found
 */
router.post("/admin/communication/results/:examId/students/:studentId", requireAuth, requireRoles("ADMIN", "SUPER_ADMIN"), sendIndividualResult);

export default router;


