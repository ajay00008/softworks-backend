import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import logger from "../utils/logger";

async function run() {
  await mongoose.connect(env.MONGO_URI);
  
  try {
    // Sample student data
    const studentData = {
      email: "john.doe@student.local",
      password: "Student123!",
      name: "John Doe",
      rollNumber: "STU001",
      className: "10A",
      fatherName: "Robert Doe",
      motherName: "Jane Doe",
      dateOfBirth: "2005-03-15",
      parentsPhone: "9876543210",
      parentsEmail: "parents.doe@email.com",
      address: "123 Main Street, City, State 12345",
      whatsappNumber: "9876543210"
    };

    // Sample teacher data
    const teacherData = {
      email: "jane.smith@teacher.local",
      password: "Teacher123!",
      name: "Jane Smith",
      subjectIds: ["MATH", "PHYSICS"],
      phone: "9876543210",
      address: "456 Oak Avenue, City, State 12345",
      qualification: "M.Sc. Mathematics, B.Ed.",
      experience: "5 years",
      department: "Mathematics"
    };

    // Create student
    const existingStudent = await User.findOne({ email: studentData.email });
    if (!existingStudent) {
      const passwordHash = await bcrypt.hash(studentData.password, 12);
      const user = await User.create({
        email: studentData.email,
        passwordHash,
        name: studentData.name,
        role: "STUDENT",
        isActive: true
      });

      const student = await Student.create({
        userId: user._id,
        rollNumber: studentData.rollNumber,
        className: studentData.className,
        fatherName: studentData.fatherName,
        motherName: studentData.motherName,
        dateOfBirth: studentData.dateOfBirth,
        parentsPhone: studentData.parentsPhone,
        parentsEmail: studentData.parentsEmail,
        address: studentData.address,
        whatsappNumber: studentData.whatsappNumber
      });

      logger.info("Sample student created successfully", {
        id: user._id,
        email: user.email,
        name: user.name,
        rollNumber: student.rollNumber,
        className: student.className
      });
    } else {
      logger.info("Student already exists", { email: studentData.email });
    }

    // Create teacher
    const existingTeacher = await User.findOne({ email: teacherData.email });
    if (!existingTeacher) {
      const passwordHash = await bcrypt.hash(teacherData.password, 12);
      const user = await User.create({
        email: teacherData.email,
        passwordHash,
        name: teacherData.name,
        role: "TEACHER",
        isActive: true
      });

      const teacher = await Teacher.create({
        userId: user._id,
        subjectIds: teacherData.subjectIds,
        phone: teacherData.phone,
        address: teacherData.address,
        qualification: teacherData.qualification,
        experience: teacherData.experience,
        department: teacherData.department
      });

      logger.info("Sample teacher created successfully", {
        id: user._id,
        email: user.email,
        name: user.name,
        subjectIds: teacher.subjectIds,
        department: teacher.department
      });
    } else {
      logger.info("Teacher already exists", { email: teacherData.email });
    }

  } catch (error) {
    logger.error("Failed to create sample data", { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (err) => {
  logger.error("Sample data seeding failed", { error: err.message, stack: err.stack });
  await mongoose.disconnect();
  process.exit(1);
});
