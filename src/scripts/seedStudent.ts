import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import { Student } from "../models/Student";
import logger from "../utils/logger";

async function run() {
  await mongoose.connect(env.MONGO_URI);
  
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

  try {
    // Check if student already exists
    const existingUser = await User.findOne({ email: studentData.email });
    if (existingUser) {
      logger.info("Student already exists", { email: studentData.email, role: existingUser.role });
      return;
    }

    // Check if roll number already exists in the same class
    const existingRoll = await Student.findOne({ 
      rollNumber: studentData.rollNumber, 
      className: studentData.className 
    });
    if (existingRoll) {
      logger.info("Roll number already exists in this class", { 
        rollNumber: studentData.rollNumber, 
        className: studentData.className 
      });
      return;
    }

    // Create user
    const passwordHash = await bcrypt.hash(studentData.password, 12);
    const user = await User.create({
      email: studentData.email,
      passwordHash,
      name: studentData.name,
      role: "STUDENT",
      isActive: true
    });

    // Create student profile
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
      className: (student as any).className || 'Unknown',
      role: user.role
    });

  } catch (error: unknown) {
    logger.error("Failed to create sample student", { 
      error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (err) => {
  logger.error("Student seeding failed", { error: err.message, stack: err.stack });
  await mongoose.disconnect();
  process.exit(1);
});
