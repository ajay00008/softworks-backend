import { z } from "zod";
import bcrypt from "bcryptjs";
import createHttpError from "http-errors";
import { User } from "../models/User";
import { Teacher } from "../models/Teacher";
import { Student } from "../models/Student";
const CreateTeacherSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    subjectIds: z.array(z.string()).default([]),
});
export async function createTeacher(req, res, next) {
    try {
        const { email, password, name, subjectIds } = CreateTeacherSchema.parse(req.body);
        const exists = await User.findOne({ email });
        if (exists)
            throw new createHttpError.Conflict("Email already in use");
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({ email, passwordHash, name, role: "TEACHER" });
        await Teacher.create({ userId: user._id, subjectIds });
        res.status(201).json({ success: true, teacher: { id: user._id, email: user.email, name: user.name } });
    }
    catch (err) {
        next(err);
    }
}
const CreateStudentSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    rollNumber: z.string().min(1),
    className: z.string().min(1),
});
export async function createStudent(req, res, next) {
    try {
        const { email, password, name, rollNumber, className } = CreateStudentSchema.parse(req.body);
        const exists = await User.findOne({ email });
        if (exists)
            throw new createHttpError.Conflict("Email already in use");
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({ email, passwordHash, name, role: "STUDENT" });
        await Student.create({ userId: user._id, rollNumber, className });
        res.status(201).json({ success: true, student: { id: user._id, email: user.email, name: user.name } });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=userManagementController.js.map