# School Management System API Documentation

## Overview
This API provides comprehensive management for a school system with role-based access control. The system supports Super Admin, Admin, Teacher, and Student roles with appropriate permissions.

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Role Hierarchy
1. **SUPER_ADMIN**: Full system access, can create and manage admins
2. **ADMIN**: Can create and manage students and teachers
3. **TEACHER**: Limited access to assigned classes and subjects
4. **STUDENT**: Basic access to their own data

## Base URL
```
http://localhost:3000/api
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login and get JWT token

### Super Admin Endpoints
All super admin endpoints require SUPER_ADMIN role.

#### Admin Management
- `GET /super/admins` - Get all admins (with pagination and search)
- `GET /super/admins/:id` - Get single admin details
- `POST /super/admins` - Create new admin
- `PUT /super/admins/:id` - Update admin details
- `DELETE /super/admins/:id` - Deactivate admin (soft delete)
- `PATCH /super/admins/:id/activate` - Activate admin

### Admin Endpoints
All admin endpoints require ADMIN or SUPER_ADMIN role.

#### Student Management
- `GET /admin/students` - Get all students (with pagination, search, and filters)
- `GET /admin/students/:id` - Get single student details
- `POST /admin/students` - Create new student
- `PUT /admin/students/:id` - Update student details
- `DELETE /admin/students/:id` - Deactivate student (soft delete)
- `PATCH /admin/students/:id/activate` - Activate student
- `GET /admin/students/class/:className` - Get students by class

#### Teacher Management
- `GET /admin/teachers` - Get all teachers (with pagination, search, and filters)
- `GET /admin/teachers/:id` - Get single teacher details
- `POST /admin/teachers` - Create new teacher
- `PUT /admin/teachers/:id` - Update teacher details
- `DELETE /admin/teachers/:id` - Deactivate teacher (soft delete)
- `PATCH /admin/teachers/:id/activate` - Activate teacher
- `GET /admin/teachers/department/:department` - Get teachers by department
- `PATCH /admin/teachers/:id/subjects` - Assign subjects to teacher

## Data Models

### User Model
```typescript
{
  _id: ObjectId,
  email: string,
  passwordHash: string,
  name: string,
  role: "SUPER_ADMIN" | "ADMIN" | "TEACHER" | "STUDENT",
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Student Model
```typescript
{
  _id: ObjectId,
  userId: ObjectId, // References User
  rollNumber: string,
  className: string,
  fatherName?: string,
  motherName?: string,
  dateOfBirth?: string,
  parentsPhone?: string,
  parentsEmail?: string,
  address?: string,
  whatsappNumber?: string,
  createdAt: Date,
  updatedAt: Date
}
```

### Teacher Model
```typescript
{
  _id: ObjectId,
  userId: ObjectId, // References User
  subjectIds: string[],
  phone?: string,
  address?: string,
  qualification?: string,
  experience?: number,
  department?: string,
  createdAt: Date,
  updatedAt: Date
}
```

## Request/Response Examples

### Create Student
```http
POST /api/admin/students
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "john.doe@school.com",
  "password": "password123",
  "name": "John Doe",
  "rollNumber": "11A001",
  "className": "11th A",
  "fatherName": "Robert Doe",
  "motherName": "Jane Doe",
  "dateOfBirth": "2005-05-15",
  "parentsPhone": "+1234567890",
  "parentsEmail": "parents@email.com",
  "address": "123 Main St, City",
  "whatsappNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "student": {
    "id": "64a1b2c3d4e5f6789abcdef0",
    "email": "john.doe@school.com",
    "name": "John Doe",
    "rollNumber": "11A001",
    "className": "11th A",
    "isActive": true,
    "createdAt": "2023-07-01T10:00:00.000Z"
  }
}
```

### Create Teacher
```http
POST /api/admin/teachers
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "teacher@school.com",
  "password": "password123",
  "name": "Jane Smith",
  "subjectIds": ["math", "physics"],
  "phone": "+1234567890",
  "qualification": "M.Sc Mathematics",
  "experience": 5,
  "department": "Science"
}
```

### Get Students with Pagination
```http
GET /api/admin/students?page=1&limit=10&search=john&className=11th%20A
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64a1b2c3d4e5f6789abcdef0",
      "userId": {
        "_id": "64a1b2c3d4e5f6789abcdef1",
        "name": "John Doe",
        "email": "john.doe@school.com",
        "isActive": true,
        "createdAt": "2023-07-01T10:00:00.000Z"
      },
      "rollNumber": "11A001",
      "className": "11th A",
      "fatherName": "Robert Doe",
      "createdAt": "2023-07-01T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": "Email is required"
}
```

### 401 Unauthorized
```json
{
  "error": "Missing Authorization header"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient role"
}
```

### 404 Not Found
```json
{
  "error": "Student not found"
}
```

### 409 Conflict
```json
{
  "error": "Email already in use"
}
```

## Query Parameters

### Pagination
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

### Filtering
- `search`: Search in name, email, or other relevant fields
- `isActive`: Filter by active status (true/false)
- `className`: Filter students by class
- `department`: Filter teachers by department

## Features Implemented

### Super Admin Features
- ✅ Create, read, update, delete admins
- ✅ Activate/deactivate admins
- ✅ Search and pagination for admin management
- ✅ Full access to all system data

### Admin Features
- ✅ Create, read, update, delete students
- ✅ Create, read, update, delete teachers
- ✅ Student management with detailed information (parents, contact, etc.)
- ✅ Teacher management with qualifications and department assignment
- ✅ Class-wise student filtering
- ✅ Department-wise teacher filtering
- ✅ Subject assignment to teachers
- ✅ Search and pagination for all entities
- ✅ Soft delete functionality (activate/deactivate)

### Data Validation
- ✅ Email format validation
- ✅ Password strength requirements (minimum 8 characters)
- ✅ Unique email constraints
- ✅ Unique roll number per class constraint
- ✅ Required field validation
- ✅ Data sanitization

### Security Features
- ✅ JWT-based authentication
- ✅ Role-based access control
- ✅ Password hashing with bcrypt
- ✅ Input sanitization
- ✅ Rate limiting
- ✅ CORS protection
- ✅ Helmet security headers

## Future Enhancements

Based on the requirements document, the following features can be added:

1. **Question Management System**
   - Create questions based on Bloom's Taxonomy
   - AI-powered question generation
   - Subject-wise question categorization

2. **Answer Sheet Management**
   - Upload scanned answer sheets
   - AI-powered answer correction
   - Missing paper tracking
   - Performance analytics

3. **Performance Analytics**
   - Individual student performance tracking
   - Class-wise performance metrics
   - Subject-wise analysis
   - Graphical representation of data

4. **Communication Features**
   - WhatsApp integration for result sharing
   - Email notifications
   - Parent communication portal

5. **Syllabus Management**
   - Upload and manage syllabus
   - Subject-wise content organization

6. **Multi-language Support**
   - Support for Tamil, Hindi, Malayalam, Telugu, Kannada
   - Localized question generation and correction

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```
MONGO_URI=mongodb://localhost:27017/school-management
JWT_SECRET=your-secret-key
PORT=3000
```

3. Run the application:
```bash
npm run dev
```

4. Access API documentation:
```
http://localhost:3000/api/docs
```

## Testing the API

You can test the API using tools like Postman, curl, or any HTTP client. Make sure to:

1. First login to get a JWT token
2. Use the token in the Authorization header for protected endpoints
3. Ensure you have the correct role permissions for the endpoints you're testing

## Database Setup

The system uses MongoDB with the following collections:
- `users`: User accounts with authentication data
- `students`: Student-specific information
- `teachers`: Teacher-specific information

All collections include proper indexing for optimal performance.
