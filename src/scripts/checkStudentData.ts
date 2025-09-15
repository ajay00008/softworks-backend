import mongoose from "mongoose";
import { Class } from "../models/Class";
import { Student } from "../models/Student";

/**
 * Script to check the current state of student data
 * Shows how many students have className vs classId
 */

async function checkStudentData() {
  try {
    console.log("Checking student data structure...");

    // Check students with className (old format)
    const studentsWithClassName = await Student.find({
      className: { $exists: true }
    });

    // Check students with classId (new format)
    const studentsWithClassId = await Student.find({
      classId: { $exists: true }
    });

    // Check students with both (shouldn't happen but let's check)
    const studentsWithBoth = await Student.find({
      className: { $exists: true },
      classId: { $exists: true }
    });

    // Check students with neither (invalid state)
    const studentsWithNeither = await Student.find({
      className: { $exists: false },
      classId: { $exists: false }
    });

    console.log("\n=== STUDENT DATA ANALYSIS ===");
    console.log(`Total students: ${await Student.countDocuments()}`);
    console.log(`Students with className: ${studentsWithClassName.length}`);
    console.log(`Students with classId: ${studentsWithClassId.length}`);
    console.log(`Students with both: ${studentsWithBoth.length}`);
    console.log(`Students with neither: ${studentsWithNeither.length}`);

    if (studentsWithClassName.length > 0) {
      console.log("\n=== STUDENTS WITH CLASSNAME ===");
      const uniqueClassNames = [...new Set(studentsWithClassName.map(s => (s as any).className))];
      console.log("Unique class names found:", uniqueClassNames);
      
      // Check which classNames have corresponding classes
      const classes = await Class.find({});
      const existingClassNames = classes.map(c => c.name);
      
      console.log("\nClass name mapping analysis:");
      uniqueClassNames.forEach(className => {
        const hasClass = existingClassNames.includes(className);
        const studentCount = studentsWithClassName.filter(s => (s as any).className === className).length;
        console.log(`  "${className}": ${studentCount} students, class exists: ${hasClass}`);
      });
    }

    if (studentsWithClassId.length > 0) {
      console.log("\n=== STUDENTS WITH CLASSID ===");
      const studentsWithPopulatedClass = await Student.find({
        classId: { $exists: true }
      }).populate('classId', 'name displayName level section');
      
      const classDistribution = studentsWithPopulatedClass.reduce((acc, student) => {
        const className = (student.classId as any)?.name || 'Unknown';
        acc[className] = (acc[className] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log("Class distribution:");
      Object.entries(classDistribution).forEach(([className, count]) => {
        console.log(`  ${className}: ${count} students`);
      });
    }

    if (studentsWithNeither.length > 0) {
      console.log("\n⚠️  WARNING: Found students with neither className nor classId!");
      console.log("Student IDs:", studentsWithNeither.map(s => s.userId));
    }

    console.log("\n=== RECOMMENDATION ===");
    if (studentsWithClassName.length > 0) {
      console.log("❌ Migration needed: Run migrateStudentClassData.ts to update className to classId");
    } else if (studentsWithClassId.length > 0) {
      console.log("✅ Data is up to date: All students use classId");
    } else {
      console.log("ℹ️  No student data found");
    }

  } catch (error) {
    console.error("Error checking student data:", error);
    throw error;
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/school-management";
  
  mongoose.connect(mongoUri)
    .then(() => {
      console.log("Connected to MongoDB");
      return checkStudentData();
    })
    .then(() => {
      console.log("Check completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Check failed:", error);
      process.exit(1);
    });
}

export { checkStudentData };
