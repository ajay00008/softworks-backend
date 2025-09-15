# 🚀 **API ENDPOINTS REFERENCE FOR FRONTEND**

## 📋 **OVERVIEW**

This document provides a complete reference for all API endpoints in the Softworks system, organized by functionality for easy frontend integration.

---

## 🔐 **AUTHENTICATION**

### **Login**
```http
POST /api/auth/login
```
**Purpose:** Authenticate user and get JWT token  
**Body:** `{ email, password }`  
**Response:** `{ token, user }`  
**Access:** Public

---

## 👑 **SUPER ADMIN ROUTES**

### **Admin Management**
```http
POST /api/super/admins
GET /api/super/admins
GET /api/super/admins/:id
PUT /api/super/admins/:id
DELETE /api/super/admins/:id
PATCH /api/super/admins/:id/activate
```
**Purpose:** Create, read, update, delete, and manage admins  
**Access:** SUPER_ADMIN only

---

## 👨‍💼 **ADMIN ROUTES**

### **User Management**

#### **Teachers**
```http
POST /api/admin/teachers
GET /api/admin/teachers
GET /api/admin/teachers/:id
PUT /api/admin/teachers/:id
DELETE /api/admin/teachers/:id
PATCH /api/admin/teachers/:id/activate
POST /api/admin/teachers/:id/assign-subjects
POST /api/admin/teachers/:id/assign-classes
```
**Purpose:** Complete teacher CRUD and assignment management  
**Access:** ADMIN, SUPER_ADMIN

#### **Students**
```http
POST /api/admin/students
GET /api/admin/students
GET /api/admin/students/:id
PUT /api/admin/students/:id
DELETE /api/admin/students/:id
PATCH /api/admin/students/:id/activate
GET /api/admin/students/class/:classId
```
**Purpose:** Complete student CRUD and class-based retrieval  
**Access:** ADMIN, SUPER_ADMIN

### **Class & Subject Management**
```http
GET /api/admin/class-subject-mappings
GET /api/admin/subjects/level/:level
GET /api/admin/teachers/class/:classId
GET /api/admin/classes/teacher/:teacherId
GET /api/admin/assigned-classes/teacher/:teacherId
GET /api/admin/validate-consistency
```
**Purpose:** Manage class-subject relationships and validate data consistency  
**Access:** ADMIN, SUPER_ADMIN

---

## 📝 **QUESTION MANAGEMENT**

### **Question CRUD**
```http
POST /api/admin/questions
GET /api/admin/questions
GET /api/admin/questions/:id
PUT /api/admin/questions/:id
DELETE /api/admin/questions/:id
```
**Purpose:** Create, read, update, delete questions with Blooms taxonomy  
**Access:** ADMIN, SUPER_ADMIN, TEACHER

### **AI Question Generation**
```http
POST /api/admin/questions/generate
```
**Purpose:** Generate questions using AI with Blooms taxonomy distribution  
**Body:** `{ subjectId, classId, unit, questionDistribution, totalQuestions, language }`  
**Access:** ADMIN, SUPER_ADMIN, TEACHER

### **Question Statistics**
```http
GET /api/admin/questions/statistics
```
**Purpose:** Get question statistics and analytics  
**Access:** ADMIN, SUPER_ADMIN

---

## 📊 **EXAM MANAGEMENT**

### **Exam CRUD**
```http
POST /api/admin/exams
GET /api/admin/exams
GET /api/admin/exams/:id
PUT /api/admin/exams/:id
DELETE /api/admin/exams/:id
```
**Purpose:** Create, read, update, delete exams  
**Access:** ADMIN, SUPER_ADMIN, TEACHER

### **Exam Control**
```http
PATCH /api/admin/exams/:id/start
PATCH /api/admin/exams/:id/end
```
**Purpose:** Start and end exams  
**Access:** ADMIN, SUPER_ADMIN, TEACHER

### **Exam Results & Analytics**
```http
GET /api/admin/exams/:id/results
GET /api/admin/exams/:id/statistics
```
**Purpose:** Get exam results and statistics  
**Access:** ADMIN, SUPER_ADMIN, TEACHER

---

## 📈 **PERFORMANCE MONITORING**

### **Individual Performance**
```http
GET /api/admin/performance/individual/:studentId
```
**Purpose:** Get individual student performance analytics  
**Query Params:** `subjectId, examType, startDate, endDate, academicYear`  
**Access:** ADMIN, SUPER_ADMIN

### **Class Performance**
```http
GET /api/admin/performance/class/:classId
```
**Purpose:** Get class performance analytics  
**Query Params:** `subjectId, examType, startDate, endDate, academicYear`  
**Access:** ADMIN, SUPER_ADMIN

### **Performance Analytics Dashboard**
```http
GET /api/admin/performance/analytics
```
**Purpose:** Get comprehensive performance analytics dashboard  
**Query Params:** `classId, subjectId, examType, startDate, endDate, academicYear`  
**Access:** ADMIN, SUPER_ADMIN

### **Performance Reports**
```http
GET /api/admin/performance/reports/:type
```
**Purpose:** Get performance reports for printing  
**Path Params:** `type` (individual, class)  
**Query Params:** `studentId, classId, subjectId, examId`  
**Access:** ADMIN, SUPER_ADMIN

---

## 📚 **SYLLABUS MANAGEMENT**

### **Syllabus CRUD**
```http
POST /api/admin/syllabi
GET /api/admin/syllabi
GET /api/admin/syllabi/:id
PUT /api/admin/syllabi/:id
DELETE /api/admin/syllabi/:id
```
**Purpose:** Create, read, update, delete syllabi  
**Access:** ADMIN, SUPER_ADMIN, TEACHER

### **Syllabus Utilities**
```http
GET /api/admin/syllabi/subject/:subjectId/class/:classId
POST /api/admin/syllabi/:id/upload
GET /api/admin/syllabi/statistics
```
**Purpose:** Get syllabus by subject/class, upload files, get statistics  
**Access:** ADMIN, SUPER_ADMIN, TEACHER

---

## 🚨 **ABSENTEEISM TRACKING**

### **Absenteeism Management**
```http
POST /api/admin/absenteeism
GET /api/admin/absenteeism
GET /api/admin/absenteeism/:id
```
**Purpose:** Report and retrieve absenteeism/missing answer sheets  
**Access:** ADMIN, SUPER_ADMIN, TEACHER

### **Admin Actions**
```http
PATCH /api/admin/absenteeism/:id/acknowledge
PATCH /api/admin/absenteeism/:id/resolve
PATCH /api/admin/absenteeism/:id/escalate
```
**Purpose:** Acknowledge, resolve, and escalate absenteeism reports  
**Access:** ADMIN, SUPER_ADMIN

### **Statistics**
```http
GET /api/admin/absenteeism/statistics
```
**Purpose:** Get absenteeism statistics  
**Access:** ADMIN, SUPER_ADMIN

---

## 🖨️ **PRINTING FEATURES**

### **Print Exam Materials**
```http
GET /api/admin/print/exams/:examId/answers
GET /api/admin/print/exams/:examId/students/:studentId
GET /api/admin/print/exams/:examId/summary
```
**Purpose:** Print all students' answers, individual student answers, class summary  
**Query Params:** `includeAnswers, includeGrades, includeStatistics`  
**Access:** ADMIN, SUPER_ADMIN

---

## 📱 **COMMUNICATION FEATURES**

### **Result Communication**
```http
POST /api/admin/communication/results
POST /api/admin/communication/results/:examId/students/:studentId
```
**Purpose:** Send results to parents via WhatsApp/Email  
**Body:** `{ examId, studentIds, communicationMethod, message, includeAnswers, includeStatistics }`  
**Access:** ADMIN, SUPER_ADMIN

### **Bulk Communication**
```http
POST /api/admin/communication/bulk
```
**Purpose:** Send bulk messages to parents  
**Body:** `{ studentIds, classId, communicationMethod, subject, message, scheduledAt }`  
**Access:** ADMIN, SUPER_ADMIN

---

## 🔑 **AUTHENTICATION & AUTHORIZATION**

### **Required Headers**
```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### **Role-Based Access**
- **SUPER_ADMIN:** Full system access
- **ADMIN:** Admin panel access, user management, all features
- **TEACHER:** Question creation, exam management, syllabus management
- **STUDENT:** Limited access (future implementation)

---

## 📊 **COMMON QUERY PARAMETERS**

### **Pagination**
```http
?page=1&limit=10
```

### **Filtering**
```http
?search=keyword
?subjectId=123
?classId=456
?isActive=true
```

### **Date Filtering**
```http
?startDate=2024-01-01
?endDate=2024-12-31
?academicYear=2024-25
```

---

## 🎯 **KEY FEATURES FOR FRONTEND**

### **1. Question Management**
- Create questions with Blooms taxonomy
- AI-powered question generation
- Difficulty levels (Easy, Moderate, Toughest)
- Twisted question options
- Multi-language support

### **2. Exam Management**
- Complete exam lifecycle
- Question distribution by Blooms taxonomy
- Real-time exam control
- Results and analytics

### **3. Performance Monitoring**
- Individual student performance
- Class performance analytics
- Graphical representation
- Performance reports

### **4. Absenteeism Tracking**
- Red flag system
- Admin acknowledgment
- Priority levels
- Statistics and reporting

### **5. Communication**
- WhatsApp integration
- Email integration
- Bulk messaging
- Scheduled communication

### **6. Printing**
- Single-click printing
- Individual/class reports
- Performance reports
- Customizable formats

---

## 🚀 **FRONTEND INTEGRATION TIPS**

### **1. Authentication Flow**
```javascript
// Login and store token
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { token } = await response.json();
localStorage.setItem('token', token);
```

### **2. API Calls with Auth**
```javascript
const token = localStorage.getItem('token');
const response = await fetch('/api/admin/questions', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### **3. Error Handling**
```javascript
if (!response.ok) {
  const error = await response.json();
  throw new Error(error.message || 'API Error');
}
```

### **4. Pagination**
```javascript
const params = new URLSearchParams({
  page: currentPage,
  limit: pageSize,
  search: searchTerm
});
const response = await fetch(`/api/admin/questions?${params}`);
```

---

## 📱 **SWAGGER DOCUMENTATION**

**Interactive API Documentation:** `/api/docs`

All endpoints are fully documented in Swagger UI with:
- Request/Response schemas
- Parameter descriptions
- Example requests
- Error responses
- Authentication requirements

---

## 🎉 **READY FOR DEVELOPMENT**

All endpoints are:
- ✅ **Fully Implemented** - Complete backend functionality
- ✅ **Fully Documented** - Comprehensive Swagger documentation
- ✅ **Role-Based Access** - Proper authentication and authorization
- ✅ **Error Handling** - Standardized error responses
- ✅ **Validation** - Input validation and sanitization

**Happy coding! 🚀**
