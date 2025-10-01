import { z } from "zod";
import bcrypt from "bcryptjs";
import createHttpError from "http-errors";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Class } from "../models/Class";
const CreateStudentSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    rollNumber: z.string().min(1),
    classId: z.string().min(1),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    parentsPhone: z.string().optional(),
    parentsEmail: z.string().email().optional(),
    address: z.string().optional(),
    whatsappNumber: z.string().optional(),
});
const UpdateStudentSchema = z.object({
    email: z.string().email().optional(),
    name: z.string().min(2).optional(),
    rollNumber: z.string().min(1).optional(),
    classId: z.string().min(1).optional(),
    fatherName: z.string().optional(),
    motherName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    parentsPhone: z.string().optional(),
    parentsEmail: z.string().email().optional(),
    address: z.string().optional(),
    whatsappNumber: z.string().optional(),
    isActive: z.boolean().optional(),
});
const GetStudentsQuerySchema = z.object({
    page: z.union([z.string(), z.number()]).transform(Number).default(1),
    limit: z.union([z.string(), z.number()]).transform(Number).default(10),
    search: z.string().optional(),
    classId: z.string().optional(),
    isActive: z.string().transform(Boolean).optional(),
});
// Create Student
export async function createStudent(req, res, next) {
    let createdUser = null;
    try {
        const studentData = CreateStudentSchema.parse(req.body);
        const { email, password, name, rollNumber, classId, ...additionalData } = studentData;
        const auth = req.auth;
        const adminId = auth.adminId;
        // First, check if any classes exist for this admin
        const totalClasses = await Class.countDocuments({ adminId, isActive: true });
        if (totalClasses === 0) {
            throw new createHttpError.BadRequest("Cannot create students. Please create at least one class first.");
        }
        const exists = await User.findOne({ email });
        if (exists)
            throw new createHttpError.Conflict("Email already in use");
        // Validate that the class exists, is active, and belongs to the same admin
        const classExists = await Class.findOne({ _id: classId, adminId, isActive: true });
        if (!classExists) {
            throw new createHttpError.BadRequest("Class not found, inactive, or not accessible");
        }
        // Check if roll number already exists in the same class for this admin
        const rollExists = await Student.findOne({ rollNumber, classId, adminId });
        if (rollExists)
            throw new createHttpError.Conflict("Roll number already exists in this class");
        const passwordHash = await bcrypt.hash(password, 12);
        try {
            // Create user first
            createdUser = await User.create({
                email,
                passwordHash,
                name,
                role: "STUDENT",
                isActive: true
            });
            // Create student
            const student = await Student.create({
                userId: createdUser._id,
                adminId,
                rollNumber,
                classId,
                ...additionalData
            });
            // Populate class information for response
            const populatedStudent = await Student.findById(student._id).populate('classId', 'name displayName level section academicYear');
            res.status(201).json({
                success: true,
                student: {
                    id: createdUser._id,
                    email: createdUser.email,
                    name: createdUser.name,
                    rollNumber: student.rollNumber,
                    class: {
                        id: populatedStudent.classId._id,
                        name: populatedStudent.classId.name,
                        displayName: populatedStudent.classId.displayName,
                        level: populatedStudent.classId.level,
                        section: populatedStudent.classId.section,
                        academicYear: populatedStudent.classId.academicYear
                    },
                    fatherName: student.fatherName,
                    motherName: student.motherName,
                    dateOfBirth: student.dateOfBirth,
                    parentsPhone: student.parentsPhone,
                    parentsEmail: student.parentsEmail,
                    address: student.address,
                    whatsappNumber: student.whatsappNumber,
                    isActive: createdUser.isActive,
                    createdAt: createdUser.createdAt
                }
            });
        }
        catch (studentError) {
            // If student creation fails, delete the user
            if (createdUser) {
                try {
                    await User.findByIdAndDelete(createdUser._id);
                }
                catch (deleteError) {
                    console.error('Failed to delete user after student creation failure:', deleteError);
                }
            }
            throw studentError; // Re-throw the original error
        }
    }
    catch (err) {
        next(err);
    }
}
// Get All Students
export async function getStudents(req, res, next) {
    try {
        const { page, limit, search, classId, isActive } = GetStudentsQuerySchema.parse(req.query);
        const auth = req.auth;
        const adminId = auth.adminId;
        const query = { adminId };
        if (classId) {
            query.classId = classId;
        }
        if (search) {
            query.$or = [
                { rollNumber: { $regex: search, $options: "i" } },
                { fatherName: { $regex: search, $options: "i" } },
                { motherName: { $regex: search, $options: "i" } }
            ];
        }
        const skip = (page - 1) * limit;
        const [students, total] = await Promise.all([
            Student.find(query)
                .populate('userId', 'name email isActive createdAt')
                .populate('classId', 'name displayName level section academicYear')
                .sort({ 'classId.level': 1, 'classId.section': 1, rollNumber: 1 })
                .skip(skip)
                .limit(limit),
            Student.countDocuments(query)
        ]);
        // Transform the data to include all form fields
        const transformedStudents = students.map(student => ({
            id: student.userId._id,
            email: student.userId.email,
            name: student.userId.name,
            rollNumber: student.rollNumber,
            class: {
                id: student.classId._id,
                name: student.classId.name,
                displayName: student.classId.displayName,
                level: student.classId.level,
                section: student.classId.section,
                academicYear: student.classId.academicYear
            },
            fatherName: student.fatherName,
            motherName: student.motherName,
            dateOfBirth: student.dateOfBirth,
            parentsPhone: student.parentsPhone,
            parentsEmail: student.parentsEmail,
            address: student.address,
            whatsappNumber: student.whatsappNumber,
            isActive: student.userId.isActive,
            createdAt: student.userId.createdAt,
            updatedAt: student.updatedAt
        }));
        res.json({
            success: true,
            data: transformedStudents,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (err) {
        next(err);
    }
}
// Get Single Student
export async function getStudent(req, res, next) {
    try {
        const { id } = req.params;
        const student = await Student.findOne({ userId: id })
            .populate('userId', 'name email isActive createdAt')
            .populate('classId', 'name displayName level section academicYear');
        if (!student)
            throw new createHttpError.NotFound("Student not found");
        // Transform the data to include all form fields
        const transformedStudent = {
            id: student.userId._id,
            email: student.userId.email,
            name: student.userId.name,
            rollNumber: student.rollNumber,
            class: {
                id: student.classId._id,
                name: student.classId.name,
                displayName: student.classId.displayName,
                level: student.classId.level,
                section: student.classId.section,
                academicYear: student.classId.academicYear
            },
            fatherName: student.fatherName,
            motherName: student.motherName,
            dateOfBirth: student.dateOfBirth,
            parentsPhone: student.parentsPhone,
            parentsEmail: student.parentsEmail,
            address: student.address,
            whatsappNumber: student.whatsappNumber,
            isActive: student.userId.isActive,
            createdAt: student.userId.createdAt,
            updatedAt: student.updatedAt
        };
        res.json({ success: true, student: transformedStudent });
    }
    catch (err) {
        next(err);
    }
}
// Update Student
export async function updateStudent(req, res, next) {
    try {
        const { id } = req.params;
        const updateData = UpdateStudentSchema.parse(req.body);
        const student = await Student.findOne({ userId: id }).populate('userId');
        if (!student)
            throw new createHttpError.NotFound("Student not found");
        // Check if email is being changed and if it's already in use
        if (updateData.email && updateData.email !== student.userId.email) {
            const emailExists = await User.findOne({ email: updateData.email });
            if (emailExists)
                throw new createHttpError.Conflict("Email already in use");
        }
        // Validate class if being changed
        if (updateData.classId) {
            const classExists = await Class.findById(updateData.classId);
            if (!classExists)
                throw new createHttpError.NotFound("Class not found");
            if (!classExists.isActive)
                throw new createHttpError.BadRequest("Class is not active");
        }
        // Check if roll number is being changed and if it's already in use in the same class
        if (updateData.rollNumber && updateData.rollNumber !== student.rollNumber) {
            const rollExists = await Student.findOne({
                rollNumber: updateData.rollNumber,
                classId: updateData.classId || student.classId,
                _id: { $ne: student._id }
            });
            if (rollExists)
                throw new createHttpError.Conflict("Roll number already exists in this class");
        }
        // Update user data
        const userUpdateData = {};
        if (updateData.email)
            userUpdateData.email = updateData.email;
        if (updateData.name)
            userUpdateData.name = updateData.name;
        if (updateData.isActive !== undefined)
            userUpdateData.isActive = updateData.isActive;
        if (Object.keys(userUpdateData).length > 0) {
            await User.findByIdAndUpdate(id, userUpdateData, { runValidators: true });
        }
        // Update student data
        const studentUpdateData = { ...updateData };
        delete studentUpdateData.email;
        delete studentUpdateData.name;
        delete studentUpdateData.isActive;
        if (Object.keys(studentUpdateData).length > 0) {
            await Student.findByIdAndUpdate(student._id, studentUpdateData, { runValidators: true });
        }
        const updatedStudent = await Student.findOne({ userId: id })
            .populate('userId', 'name email isActive createdAt')
            .populate('classId', 'name displayName level section academicYear');
        // Transform the data to include all form fields
        const transformedStudent = {
            id: updatedStudent.userId._id,
            email: updatedStudent.userId.email,
            name: updatedStudent.userId.name,
            rollNumber: updatedStudent.rollNumber,
            class: {
                id: updatedStudent.classId._id,
                name: updatedStudent.classId.name,
                displayName: updatedStudent.classId.displayName,
                level: updatedStudent.classId.level,
                section: updatedStudent.classId.section,
                academicYear: updatedStudent.classId.academicYear
            },
            fatherName: updatedStudent.fatherName,
            motherName: updatedStudent.motherName,
            dateOfBirth: updatedStudent.dateOfBirth,
            parentsPhone: updatedStudent.parentsPhone,
            parentsEmail: updatedStudent.parentsEmail,
            address: updatedStudent.address,
            whatsappNumber: updatedStudent.whatsappNumber,
            isActive: updatedStudent.userId.isActive,
            createdAt: updatedStudent.userId.createdAt,
            updatedAt: updatedStudent.updatedAt
        };
        res.json({ success: true, student: transformedStudent });
    }
    catch (err) {
        next(err);
    }
}
// Delete Student (Hard delete)
export async function deleteStudent(req, res, next) {
    try {
        const { id } = req.params;
        const student = await Student.findOne({ userId: id });
        if (!student)
            throw new createHttpError.NotFound("Student not found");
        // Delete both student record and user record
        await Promise.all([
            Student.findByIdAndDelete(student._id),
            User.findByIdAndDelete(id)
        ]);
        res.json({ success: true, message: "Student deleted successfully" });
    }
    catch (err) {
        next(err);
    }
}
// Activate Student
export async function activateStudent(req, res, next) {
    try {
        const { id } = req.params;
        const student = await Student.findOne({ userId: id });
        if (!student)
            throw new createHttpError.NotFound("Student not found");
        await User.findByIdAndUpdate(id, { isActive: true });
        res.json({ success: true, message: "Student activated successfully" });
    }
    catch (err) {
        next(err);
    }
}
// Get Students by Class
export async function getStudentsByClass(req, res, next) {
    try {
        const { classId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        // Validate that the class exists
        const classExists = await Class.findById(classId);
        if (!classExists)
            throw new createHttpError.NotFound("Class not found");
        const skip = (Number(page) - 1) * Number(limit);
        const [students, total] = await Promise.all([
            Student.find({ classId })
                .populate('userId', 'name email isActive')
                .populate('classId', 'name displayName level section academicYear')
                .sort({ rollNumber: 1 })
                .skip(skip)
                .limit(Number(limit)),
            Student.countDocuments({ classId })
        ]);
        // Transform the data to include all form fields
        const transformedStudents = students.map(student => ({
            id: student.userId._id,
            email: student.userId.email,
            name: student.userId.name,
            rollNumber: student.rollNumber,
            class: {
                id: student.classId._id,
                name: student.classId.name,
                displayName: student.classId.displayName,
                level: student.classId.level,
                section: student.classId.section,
                academicYear: student.classId.academicYear
            },
            fatherName: student.fatherName,
            motherName: student.motherName,
            dateOfBirth: student.dateOfBirth,
            parentsPhone: student.parentsPhone,
            parentsEmail: student.parentsEmail,
            address: student.address,
            whatsappNumber: student.whatsappNumber,
            isActive: student.userId.isActive,
            createdAt: student.userId.createdAt,
            updatedAt: student.updatedAt
        }));
        res.json({
            success: true,
            data: transformedStudents,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=studentController.js.map