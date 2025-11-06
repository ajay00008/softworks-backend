import mongoose from "mongoose";
import { Teacher } from "../models/Teacher";
import { Class } from "../models/Class";
import { Subject } from "../models/Subject";

async function migrateTeachers() {
  try {
    console.log("🔄 Starting teacher migration...");
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/school-management");
    console.log("✅ Connected to database");

    // Get all teachers
    const teachers = await Teacher.find({});
    console.log(`📊 Found ${teachers.length} teachers to migrate`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const teacher of teachers) {
      try {
        // Check if teacher already has classIds field
        if (teacher.classIds && teacher.classIds.length > 0) {
          console.log(`⏭️  Teacher ${teacher._id} already has classIds, skipping`);
          skippedCount++;
          continue;
        }

        // Initialize classIds as empty array if not present
        const updateData: any = {};
        
        // Add classIds field if missing
        if (!teacher.classIds) {
          updateData.classIds = [];
        }

        // Remove department field if it exists (since it was removed from schema)
        if (teacher.department !== undefined) {
          updateData.$unset = { department: 1 };
        }

        // Update the teacher
        if (Object.keys(updateData).length > 0) {
          await Teacher.findByIdAndUpdate(teacher._id, updateData);
          console.log(`✅ Updated teacher ${teacher._id}`);
          updatedCount++;
        } else {
          console.log(`⏭️  Teacher ${teacher._id} needs no updates, skipping`);
          skippedCount++;
        }

      } catch (error: unknown) {
        console.error(`❌ Error updating teacher ${teacher._id}:`, error);
      }
    }

    console.log("\n📈 Migration Summary:");
    console.log(`✅ Updated: ${updatedCount} teachers`);
    console.log(`⏭️  Skipped: ${skippedCount} teachers`);
    console.log(`📊 Total processed: ${teachers.length} teachers`);

    // Verify migration
    console.log("\n🔍 Verifying migration...");
    const teachersWithClassIds = await Teacher.find({ classIds: { $exists: true } });
    const teachersWithoutDepartment = await Teacher.find({ department: { $exists: false } });
    
    console.log(`✅ Teachers with classIds field: ${teachersWithClassIds.length}/${teachers.length}`);
    console.log(`✅ Teachers without department field: ${teachersWithoutDepartment.length}/${teachers.length}`);

    // Show sample of updated teachers
    if (teachersWithClassIds.length > 0) {
      console.log("\n📋 Sample of updated teachers:");
      const sampleTeachers = await Teacher.find({})
        .populate('userId', 'name email')
        .populate('subjectIds', 'code name')
        .populate('classIds', 'name displayName')
        .limit(3);
      
      sampleTeachers.forEach((teacher, index) => {
        console.log(`\n${index + 1}. Teacher: ${(teacher.userId as any)?.name}`);
        console.log(`   Email: ${(teacher.userId as any)?.email}`);
        console.log(`   Subjects: ${teacher.subjectIds.length} assigned`);
        console.log(`   Classes: ${teacher.classIds.length} assigned`);
        console.log(`   Department: ${teacher.department || 'Not set'}`);
      });
    }

    console.log("\n🎉 Teacher migration completed successfully!");

  } catch (error: unknown) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from database");
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateTeachers()
    .then(() => {
      console.log("✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration script failed:", error);
      process.exit(1);
    });
}

export { migrateTeachers };
