import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import { Class } from "../models/Class";
import { Subject } from "../models/Subject";
import logger from "../utils/logger";

async function run() {
  await mongoose.connect(env.MONGO_URI);
  
  try {
    logger.info("Starting migration of classes and subjects...");
    
    // Create default classes
    const defaultClasses = [
      { name: "9A", displayName: "Class 9A", level: 9, section: "A", academicYear: "2024-25" },
      { name: "9B", displayName: "Class 9B", level: 9, section: "B", academicYear: "2024-25" },
      { name: "10A", displayName: "Class 10A", level: 10, section: "A", academicYear: "2024-25" },
      { name: "10B", displayName: "Class 10B", level: 10, section: "B", academicYear: "2024-25" },
      { name: "11A", displayName: "Class 11A", level: 11, section: "A", academicYear: "2024-25" },
      { name: "11B", displayName: "Class 11B", level: 11, section: "B", academicYear: "2024-25" },
      { name: "12A", displayName: "Class 12A", level: 12, section: "A", academicYear: "2024-25" },
      { name: "12B", displayName: "Class 12B", level: 12, section: "B", academicYear: "2024-25" },
    ];
    
    const createdClasses = [];
    for (const classData of defaultClasses) {
      const existing = await Class.findOne({ name: classData.name, academicYear: classData.academicYear });
      if (!existing) {
        const newClass = await Class.create(classData);
        createdClasses.push(newClass);
        logger.info(`Created class: ${newClass.name}`);
      } else {
        createdClasses.push(existing);
        logger.info(`Class already exists: ${existing.name}`);
      }
    }
    
    // Create default subjects
    const defaultSubjects = [
      { code: "MATH", name: "Mathematics", shortName: "Math", category: "MATHEMATICS", level: [9, 10, 11, 12], color: "#FF6B6B" },
      { code: "PHYSICS", name: "Physics", shortName: "Phy", category: "SCIENCE", level: [9, 10, 11, 12], color: "#4ECDC4" },
      { code: "CHEMISTRY", name: "Chemistry", shortName: "Chem", category: "SCIENCE", level: [9, 10, 11, 12], color: "#45B7D1" },
      { code: "BIOLOGY", name: "Biology", shortName: "Bio", category: "SCIENCE", level: [9, 10, 11, 12], color: "#96CEB4" },
      { code: "ENGLISH", name: "English", shortName: "Eng", category: "ENGLISH", level: [9, 10, 11, 12], color: "#FFEAA7" },
      { code: "HINDI", name: "Hindi", shortName: "Hindi", category: "HINDI", level: [9, 10, 11, 12], color: "#DDA0DD" },
      { code: "HISTORY", name: "History", shortName: "Hist", category: "HISTORY", level: [9, 10, 11, 12], color: "#98D8C8" },
      { code: "GEOGRAPHY", name: "Geography", shortName: "Geo", category: "GEOGRAPHY", level: [9, 10, 11, 12], color: "#F7DC6F" },
      { code: "ECONOMICS", name: "Economics", shortName: "Eco", category: "ECONOMICS", level: [11, 12], color: "#BB8FCE" },
      { code: "COMPUTER_SCIENCE", name: "Computer Science", shortName: "CS", category: "COMPUTER_SCIENCE", level: [9, 10, 11, 12], color: "#85C1E9" },
    ];
    
    const createdSubjects = [];
    for (const subjectData of defaultSubjects) {
      const existing = await Subject.findOne({ code: subjectData.code });
      if (!existing) {
        const newSubject = await Subject.create(subjectData);
        createdSubjects.push(newSubject);
        logger.info(`Created subject: ${newSubject.name}`);
      } else {
        createdSubjects.push(existing);
        logger.info(`Subject already exists: ${existing.name}`);
      }
    }
    
    // Create a mapping for class names to class IDs
    const classMapping = new Map();
    for (const classData of createdClasses) {
      classMapping.set(classData.name, classData._id);
    }
    
    // Create a mapping for subject names to subject IDs
    const subjectMapping = new Map();
    for (const subjectData of createdSubjects) {
      subjectMapping.set(subjectData.code, subjectData._id);
    }
    
    // Migrate existing students
    const students = await Student.find({});
    let migratedStudents = 0;
    
    for (const student of students) {
      const className = (student as any).className;
      if (className && classMapping.has(className)) {
        await Student.findByIdAndUpdate(student._id, {
          classId: classMapping.get(className)
        });
        migratedStudents++;
        logger.info(`Migrated student ${student.rollNumber} to class ${className}`);
      } else {
        logger.warn(`Could not find class mapping for student ${student.rollNumber} with className: ${className}`);
      }
    }
    
    // Migrate existing teachers
    const teachers = await Teacher.find({});
    let migratedTeachers = 0;
    
    for (const teacher of teachers) {
      const subjectIds = (teacher as any).subjectIds;
      if (subjectIds && Array.isArray(subjectIds)) {
        const newSubjectIds = [];
        for (const subjectId of subjectIds) {
          if (typeof subjectId === 'string' && subjectMapping.has(subjectId)) {
            newSubjectIds.push(subjectMapping.get(subjectId));
          }
        }
        
        if (newSubjectIds.length > 0) {
          await Teacher.findByIdAndUpdate(teacher._id, {
            subjectIds: newSubjectIds
          });
          migratedTeachers++;
          logger.info(`Migrated teacher ${(teacher.userId as any).name} with subjects: ${subjectIds.join(', ')}`);
        }
      }
    }
    
    logger.info(`Migration completed successfully!`);
    logger.info(`- Created ${createdClasses.length} classes`);
    logger.info(`- Created ${createdSubjects.length} subjects`);
    logger.info(`- Migrated ${migratedStudents} students`);
    logger.info(`- Migrated ${migratedTeachers} teachers`);
    
  } catch (error: unknown) {
    logger.error("Migration failed", { 
      error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (err) => {
  logger.error("Migration script failed", { error: err.message, stack: err.stack });
  await mongoose.disconnect();
  process.exit(1);
});
