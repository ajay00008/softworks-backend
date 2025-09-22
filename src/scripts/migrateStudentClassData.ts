import mongoose from "mongoose";
import { Class } from "../models/Class";
import { Student } from "../models/Student";
import { User } from "../models/User";

/**
 * Migration script to update existing student data from className to classId
 * This script will:
 * 1. Find students with className field (old format)
 * 2. Match className to existing Class records
 * 3. Update students to use classId instead
 * 4. Handle cases where class doesn't exist
 */

async function migrateStudentClassData() {
  try {
    console.log("Starting student class data migration...");

    // First, let's check if there are any students with className field
    const studentsWithClassName = await Student.find({
      className: { $exists: true }
    });

    console.log(`Found ${studentsWithClassName.length} students with className field`);

    if (studentsWithClassName.length === 0) {
      console.log("No students with className field found. Migration not needed.");
      return;
    }

    // Get all available classes
    const classes = await Class.find({ isActive: true });
    console.log(`Found ${classes.length} active classes`);

    // Create a mapping of className to classId
    const classNameToIdMap = new Map();
    classes.forEach(cls => {
      classNameToIdMap.set(cls.name, cls._id);
      classNameToIdMap.set(cls.displayName, cls._id);
    });

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process each student
    for (const student of studentsWithClassName) {
      try {
        const className = (student as any).className;
        let classId = classNameToIdMap.get(className);

        // If exact match not found, try to find by level and section
        if (!classId) {
          // Try to extract level and section from className (e.g., "11A" -> level 11, section A)
          const match = className.match(/^(\d+)([A-Z])?$/i);
          if (match) {
            const level = parseInt(match[1]);
            const section = match[2]?.toUpperCase() || 'A';
            
            const matchingClass = classes.find(cls => 
              cls.level === level && cls.section === section
            );
            
            if (matchingClass) {
              classId = matchingClass._id;
              console.log(`Matched "${className}" to class ${matchingClass.name} (${matchingClass.displayName})`);
            }
          }
        }

        if (!classId) {
          errorCount++;
          const error = `Student ${student.userId} has className "${className}" but no matching class found`;
          errors.push(error);
          console.error(error);
          continue;
        }

        // Update the student record
        await Student.findByIdAndUpdate(student._id, {
          $set: { classId: classId },
          $unset: { className: 1 }
        });

        successCount++;
        console.log(`Updated student ${student.userId}: "${className}" -> ${classId}`);

      } catch (error) {
        errorCount++;
        const errorMsg = `Error updating student ${student.userId}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Summary
    console.log("\n=== MIGRATION SUMMARY ===");
    console.log(`Total students processed: ${studentsWithClassName.length}`);
    console.log(`Successfully updated: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log("\n=== ERRORS ===");
      errors.forEach(error => console.log(error));
    }

    // Verify the migration
    const remainingStudentsWithClassName = await Student.find({
      className: { $exists: true }
    });
    
    const studentsWithClassId = await Student.find({
      classId: { $exists: true }
    });

    console.log(`\n=== VERIFICATION ===`);
    console.log(`Students still with className: ${remainingStudentsWithClassName.length}`);
    console.log(`Students with classId: ${studentsWithClassId.length}`);

    if (remainingStudentsWithClassName.length === 0) {
      console.log("✅ Migration completed successfully! All students now use classId.");
    } else {
      console.log("⚠️  Some students still have className field. Manual review needed.");
    }

  } catch (error) {
    console.error("Error during student class data migration:", error);
    throw error;
  }
}

// Helper function to create missing classes if needed
async function createMissingClasses() {
  console.log("Checking for missing classes...");
  
  const studentsWithClassName = await Student.find({
    className: { $exists: true }
  });

  const uniqueClassNames = [...new Set(studentsWithClassName.map(s => (s as any).className))];
  const existingClasses = await Class.find({});
  const existingClassNames = existingClasses.map(c => c.name);

  const missingClassNames = uniqueClassNames.filter(name => !existingClassNames.includes(name));
  
  if (missingClassNames.length > 0) {
    console.log(`Found ${missingClassNames.length} missing classes:`, missingClassNames);
    
    // Create missing classes
    for (const className of missingClassNames) {
      try {
        // Try to extract level and section
        const match = className.match(/^(\d+)([A-Z])?$/i);
        if (match) {
          const level = parseInt(match[1]);
          const section = match[2]?.toUpperCase() || 'A';
          
          const newClass = await Class.create({
            name: className,
            displayName: `Class ${className}`,
            level: level,
            section: section,
            academicYear: "2024-25", // Default academic year
            isActive: true,
            description: `Auto-created during migration for className: ${className}`
          });
          
          console.log(`Created class: ${newClass.name} (${newClass.displayName})`);
        }
      } catch (error) {
        console.error(`Error creating class ${className}:`, error);
      }
    }
  } else {
    console.log("No missing classes found.");
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/school-management";
  
  mongoose.connect(mongoUri)
    .then(async () => {
      console.log("Connected to MongoDB");
      
      // First create missing classes if needed
      await createMissingClasses();
      
      // Then run the migration
      await migrateStudentClassData();
      
      console.log("Migration completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateStudentClassData, createMissingClasses };
