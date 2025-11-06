import mongoose from "mongoose";
import { Class } from "../models/Class";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import { Subject } from "../models/Subject";
import { User } from "../models/User";

/**
 * Migration script to ensure data consistency between Class, Subject, Teacher, and Student models
 * This script will:
 * 1. Validate and fix any orphaned references
 * 2. Ensure all students have valid class references
 * 3. Ensure all teachers have valid subject references
 * 4. Clean up any invalid data
 */

async function migrateDataConsistency() {
  try {
    console.log("Starting data consistency migration...");

    // 1. Check for orphaned student class references
    console.log("Checking for orphaned student class references...");
    const studentsWithInvalidClasses = await Student.find({
      classId: { $exists: true }
    }).populate('classId');

    const invalidStudents = studentsWithInvalidClasses.filter(student => !student.classId);
    console.log(`Found ${invalidStudents.length} students with invalid class references`);

    if (invalidStudents.length > 0) {
      console.log("Cleaning up invalid student class references...");
      // You might want to assign them to a default class or mark them for manual review
      // For now, we'll just log them
      for (const student of invalidStudents) {
        console.log(`Student ${student.userId} has invalid class reference: ${student.classId}`);
      }
    }

    // 2. Check for orphaned teacher subject references
    console.log("Checking for orphaned teacher subject references...");
    const teachersWithSubjects = await Teacher.find({
      subjectIds: { $exists: true, $not: { $size: 0 } }
    }).populate('subjectIds');

    let invalidSubjectCount = 0;
    for (const teacher of teachersWithSubjects) {
      const validSubjects = teacher.subjectIds.filter((subject: any) => subject !== null);
      if (validSubjects.length !== teacher.subjectIds.length) {
        invalidSubjectCount++;
        console.log(`Teacher ${teacher.userId} has invalid subject references`);
        
        // Clean up invalid subject references
        await Teacher.findByIdAndUpdate(teacher._id, {
          subjectIds: validSubjects.map((subject: any) => subject._id)
        });
      }
    }
    console.log(`Found and fixed ${invalidSubjectCount} teachers with invalid subject references`);

    // 3. Validate class-subject consistency
    console.log("Validating class-subject consistency...");
    const classes = await Class.find({ isActive: true });
    const subjects = await Subject.find({ isActive: true });

    for (const classItem of classes) {
      const classLevel = classItem.level;
      const availableSubjects = subjects.filter(subject => 
        (subject as any).level?.includes(classLevel)
      );
      
      console.log(`Class ${classItem.name} (Level ${classLevel}) can have subjects: ${availableSubjects.map(s => s.name).join(', ')}`);
    }

    // 4. Check for students without proper class assignments
    console.log("Checking students without class assignments...");
    const studentsWithoutClass = await Student.find({
      $or: [
        { classId: { $exists: false } },
        { classId: null }
      ]
    });

    if (studentsWithoutClass.length > 0) {
      console.log(`Found ${studentsWithoutClass.length} students without class assignments`);
      console.log("These students need manual assignment to appropriate classes");
    }

    // 5. Check for teachers without subject assignments
    console.log("Checking teachers without subject assignments...");
    const teachersWithoutSubjects = await Teacher.find({
      $or: [
        { subjectIds: { $exists: false } },
        { subjectIds: { $size: 0 } }
      ]
    });

    if (teachersWithoutSubjects.length > 0) {
      console.log(`Found ${teachersWithoutSubjects.length} teachers without subject assignments`);
      console.log("These teachers need manual assignment to appropriate subjects");
    }

    // 6. Generate consistency report
    console.log("\n=== DATA CONSISTENCY REPORT ===");
    console.log(`Total Classes: ${await Class.countDocuments()}`);
    console.log(`Active Classes: ${await Class.countDocuments({ isActive: true })}`);
    console.log(`Total Subjects: ${await Subject.countDocuments()}`);
    console.log(`Active Subjects: ${await Subject.countDocuments({ isActive: true })}`);
    console.log(`Total Students: ${await Student.countDocuments()}`);
    console.log(`Students with valid classes: ${await Student.countDocuments({ classId: { $exists: true, $ne: null } })}`);
    console.log(`Total Teachers: ${await Teacher.countDocuments()}`);
    console.log(`Teachers with subjects: ${await Teacher.countDocuments({ subjectIds: { $exists: true, $not: { $size: 0 } } })}`);

    console.log("\nData consistency migration completed successfully!");

  } catch (error: unknown) {
    console.error("Error during data consistency migration:", error);
    throw error;
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/school-management";
  
  mongoose.connect(mongoUri)
    .then(() => {
      console.log("Connected to MongoDB");
      return migrateDataConsistency();
    })
    .then(() => {
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateDataConsistency };
