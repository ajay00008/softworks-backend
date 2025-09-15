# School Management System API

A comprehensive REST API for managing school operations with role-based access control, built with Node.js, Express, TypeScript, and MongoDB.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (Super Admin, Admin, Teacher, Student)
- Password hashing with bcrypt
- Input sanitization and validation

### 👥 User Management
- **Super Admin**: Full system access, can create and manage admins
- **Admin**: Can create and manage students and teachers
- **Teacher**: Limited access to assigned classes and subjects
- **Student**: Basic access to their own data

### 📚 Student Management
- Complete student profiles with parent information
- Class-wise organization
- Roll number management
- Contact information and address tracking
- Search and pagination

### 👨‍🏫 Teacher Management
- Teacher profiles with qualifications
- Subject assignment
- Department organization
- Experience tracking
- Search and filtering

### 🛡️ Security Features
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation with Zod
- Error handling middleware

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Copy environment variables**
```bash
cp .env.example .env
# Edit .env and change JWT_SECRET to a long random string
```

2. **Start MongoDB**
```bash
# Local service
sudo systemctl start mongod

# OR Docker
docker run -d --name mongo -p 27017:27017 -v softworks-mongo:/data/db mongo:7
```

3. **Install dependencies**
```bash
npm install
```

4. **Seed initial Super Admin**
```bash
npm run seed
```

5. **Start development server**
```bash
npm run dev
```

Server runs at `http://localhost:4000/api` (default port 4000).

## API Documentation

Once the server is running, access the interactive API documentation at:
```
http://localhost:4000/api/docs
```

## Key Endpoints

### Authentication
- `POST /api/auth/login` - Login and get JWT token

### Super Admin Endpoints
- `GET /api/super/admins` - Get all admins (with pagination)
- `POST /api/super/admins` - Create new admin
- `GET /api/super/admins/:id` - Get single admin
- `PUT /api/super/admins/:id` - Update admin
- `DELETE /api/super/admins/:id` - Deactivate admin
- `PATCH /api/super/admins/:id/activate` - Activate admin

### Admin Endpoints - Students
- `GET /api/admin/students` - Get all students (with pagination & search)
- `POST /api/admin/students` - Create new student
- `GET /api/admin/students/:id` - Get single student
- `PUT /api/admin/students/:id` - Update student
- `DELETE /api/admin/students/:id` - Deactivate student
- `PATCH /api/admin/students/:id/activate` - Activate student
- `GET /api/admin/students/class/:className` - Get students by class

### Admin Endpoints - Teachers
- `GET /api/admin/teachers` - Get all teachers (with pagination & search)
- `POST /api/admin/teachers` - Create new teacher
- `GET /api/admin/teachers/:id` - Get single teacher
- `PUT /api/admin/teachers/:id` - Update teacher
- `DELETE /api/admin/teachers/:id` - Deactivate teacher
- `PATCH /api/admin/teachers/:id/activate` - Activate teacher
- `GET /api/admin/teachers/department/:department` - Get teachers by department
- `PATCH /api/admin/teachers/:id/subjects` - Assign subjects to teacher

## Usage Examples

### 1. Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@school.com",
    "password": "password123"
  }'
```

### 2. Create a Student
```bash
curl -X POST http://localhost:4000/api/admin/students \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "email": "john.doe@school.com",
    "password": "password123",
    "name": "John Doe",
    "rollNumber": "11A001",
    "className": "11th A",
    "fatherName": "Robert Doe",
    "motherName": "Jane Doe",
    "parentsPhone": "+1234567890",
    "parentsEmail": "parents@email.com"
  }'
```

### 3. Get Students with Pagination
```bash
curl -X GET "http://localhost:4000/api/admin/students?page=1&limit=10&search=john" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Testing

Run the test script to verify API functionality:

```bash
node test-api.js
```

Make sure the server is running before executing the tests.

## Available Scripts

- `npm run dev` – start dev server with live reload
- `npm run build` – compile TypeScript to `dist/`
- `npm start` – run compiled server
- `npm run seed` – create the initial Super Admin (idempotent)

## Tech Stack

Express, Mongoose, Zod, JWT, bcrypt, Helmet, CORS, Rate limit, XSS clean, Winston (daily rotate), Morgan, TypeScript.

## Project Structure

```
src/
├── config/           # Configuration files
├── controllers/      # Route controllers
├── middleware/       # Custom middleware
├── models/          # Database models
├── routes/          # API routes
├── scripts/         # Utility scripts
├── services/        # Business logic services
├── utils/           # Utility functions
└── server.ts        # Main server file
```

## Database Schema

### Users Collection
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

### Students Collection
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

### Teachers Collection
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

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For support, create an issue in the repository or contact the development team.


