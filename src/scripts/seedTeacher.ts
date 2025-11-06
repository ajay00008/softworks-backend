import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import { Teacher } from "../models/Teacher";
import logger from "../utils/logger";

async function run() {
  await mongoose.connect(env.MONGO_URI);
  
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

  try {
    // Check if teacher already exists
    const existingUser = await User.findOne({ email: teacherData.email });
    if (existingUser) {
      logger.info("Teacher already exists", { email: teacherData.email, role: existingUser.role });
      return;
    }

    // Create user
    const passwordHash = await bcrypt.hash(teacherData.password, 12);
    const user = await User.create({
      email: teacherData.email,
      passwordHash,
      name: teacherData.name,
      role: "TEACHER",
      isActive: true
    });

    // Create teacher profile
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
      department: teacher.department,
      role: user.role
    });

  } catch (error: unknown) {
    logger.error("Failed to create sample teacher", { 
      error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (err) => {
  logger.error("Teacher seeding failed", { error: err.message, stack: err.stack });
  await mongoose.disconnect();
  process.exit(1);
});
