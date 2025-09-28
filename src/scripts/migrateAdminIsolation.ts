import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import { Class } from "../models/Class";
import { Subject } from "../models/Subject";

async function migrateAdminIsolation() {
  try {
    console.log("🚀 Starting admin isolation migration...");
    
    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Find the first SUPER_ADMIN to assign as the admin for all existing data
    const superAdmin = await User.findOne({ role: "SUPER_ADMIN" });
    if (!superAdmin) {
      console.log("❌ No SUPER_ADMIN found. Please create a SUPER_ADMIN first.");
      process.exit(1);
    }

    console.log(`📋 Using SUPER_ADMIN: ${superAdmin.name} (${superAdmin.email}) as admin for all existing data`);

    // Update all existing data to have adminId
    const updates = [];

    // Update Students
    const studentResult = await Student.updateMany(
      { adminId: { $exists: false } },
      { $set: { adminId: superAdmin._id } }
    );
    console.log(`✅ Updated ${studentResult.modifiedCount} students with adminId`);

    // Update Teachers
    const teacherResult = await Teacher.updateMany(
      { adminId: { $exists: false } },
      { $set: { adminId: superAdmin._id } }
    );
    console.log(`✅ Updated ${teacherResult.modifiedCount} teachers with adminId`);

    // Update Classes
    const classResult = await Class.updateMany(
      { adminId: { $exists: false } },
      { $set: { adminId: superAdmin._id } }
    );
    console.log(`✅ Updated ${classResult.modifiedCount} classes with adminId`);

    // Update Subjects
    const subjectResult = await Subject.updateMany(
      { adminId: { $exists: false } },
      { $set: { adminId: superAdmin._id } }
    );
    console.log(`✅ Updated ${subjectResult.modifiedCount} subjects with adminId`);

    console.log("🎉 Admin isolation migration completed successfully!");
    console.log("📝 All existing data has been assigned to the SUPER_ADMIN");
    console.log("🔒 New data created by different admins will be isolated");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateAdminIsolation();
}

export { migrateAdminIsolation };
