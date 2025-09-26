import request from 'supertest';
import { app } from '../src/server';
import { User } from '../src/models/User';
import { Student } from '../src/models/Student';
import { Class } from '../src/models/Class';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
describe('Student Management', () => {
    let authToken;
    let adminUser;
    beforeEach(async () => {
        // Clean up test data
        await User.deleteMany({});
        await Student.deleteMany({});
        await Class.deleteMany({});
        // Create admin user
        const hashedPassword = await bcrypt.hash('password123', 10);
        adminUser = new User({
            email: 'admin@example.com',
            passwordHash: hashedPassword,
            name: 'Admin User',
            role: 'ADMIN',
            isActive: true
        });
        await adminUser.save();
        // Generate auth token
        authToken = jwt.sign({ sub: adminUser._id.toString(), role: 'ADMIN' }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' });
        // Create test class
        const testClass = new Class({
            name: 'Test Class',
            displayName: 'Test Class 11A',
            level: 11,
            section: 'A'
        });
        await testClass.save();
    });
    describe('POST /api/admin/students', () => {
        it('should create a new student', async () => {
            const studentData = {
                email: 'student@example.com',
                password: 'password123',
                name: 'Test Student',
                rollNumber: '001',
                classId: (await Class.findOne({}))._id.toString(),
                fatherName: 'Father Name',
                motherName: 'Mother Name',
                dateOfBirth: '2005-01-01',
                parentsPhone: '+1234567890',
                parentsEmail: 'parents@example.com',
                address: 'Test Address',
                whatsappNumber: '+1234567890'
            };
            const response = await request(app)
                .post('/api/admin/students')
                .set('Authorization', `Bearer ${authToken}`)
                .send(studentData);
            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.student.rollNumber).toBe('001');
        });
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/admin/students')
                .send({
                email: 'student@example.com',
                password: 'password123',
                name: 'Test Student',
                rollNumber: '001'
            });
            expect(response.status).toBe(401);
        });
        it('should validate required fields', async () => {
            const response = await request(app)
                .post('/api/admin/students')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                email: 'student@example.com'
                // missing required fields
            });
            expect(response.status).toBe(400);
        });
    });
    describe('GET /api/admin/students', () => {
        it('should get all students', async () => {
            const response = await request(app)
                .get('/api/admin/students')
                .set('Authorization', `Bearer ${authToken}`);
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/admin/students?page=1&limit=10')
                .set('Authorization', `Bearer ${authToken}`);
            expect(response.status).toBe(200);
            expect(response.body.pagination).toBeDefined();
        });
    });
});
//# sourceMappingURL=students.test.js.map