import mongoose from "mongoose";
import { Teacher } from "../models/Teacher";
import { Class } from "../models/Class";
import { Subject } from "../models/Subject";
async function migrateTeachersWithClasses(options = {}) {
    const { assignClassesBasedOnSubjects = false, dryRun = false } = options;
    try {
        console.log("🔄 Starting teacher migration with class assignment...");
        if (dryRun) {
            console.log("🧪 DRY RUN MODE - No actual changes will be made");
        }
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/school-management");
        console.log("✅ Connected to database");
        // Get all teachers with their subjects
        const teachers = await Teacher.find({})
            .populate('subjectIds', 'code name level')
            .populate('classIds', 'name displayName level');
        console.log(`📊 Found ${teachers.length} teachers to migrate`);
        let updatedCount = 0;
        let skippedCount = 0;
        let classesAssignedCount = 0;
        for (const teacher of teachers) {
            try {
                console.log(`\n👨‍🏫 Processing teacher: ${teacher.userId?.name || teacher._id}`);
                const updateData = {};
                let needsUpdate = false;
                // Initialize classIds as empty array if not present
                if (!teacher.classIds) {
                    updateData.classIds = [];
                    needsUpdate = true;
                    console.log(`   📝 Adding empty classIds array`);
                }
                // Remove department field if it exists
                if (teacher.department !== undefined) {
                    updateData.$unset = { department: 1 };
                    needsUpdate = true;
                    console.log(`   🗑️  Removing department field`);
                }
                // Optionally assign classes based on subjects
                if (assignClassesBasedOnSubjects && teacher.subjectIds.length > 0) {
                    const teacherSubjects = teacher.subjectIds.map((subject) => ({
                        id: subject._id.toString(),
                        level: subject.level
                    }));
                    // Get unique levels from teacher's subjects
                    const teacherLevels = [...new Set(teacherSubjects.flatMap(ts => ts.level))];
                    console.log(`   📚 Teacher can teach levels: ${teacherLevels.join(', ')}`);
                    // Find classes that match teacher's subject levels
                    const compatibleClasses = await Class.find({
                        level: { $in: teacherLevels },
                        isActive: true
                    });
                    if (compatibleClasses.length > 0) {
                        const classIds = compatibleClasses.map(cls => cls._id);
                        updateData.classIds = classIds;
                        needsUpdate = true;
                        classesAssignedCount += classIds.length;
                        console.log(`   🎯 Assigning ${classIds.length} compatible classes`);
                        console.log(`   📋 Classes: ${compatibleClasses.map(c => `${c.name} (Level ${c.level})`).join(', ')}`);
                    }
                    else {
                        console.log(`   ⚠️  No compatible classes found for teacher's subjects`);
                    }
                }
                // Apply updates if needed
                if (needsUpdate && !dryRun) {
                    await Teacher.findByIdAndUpdate(teacher._id, updateData);
                    console.log(`   ✅ Updated teacher`);
                    updatedCount++;
                }
                else if (needsUpdate && dryRun) {
                    console.log(`   🧪 Would update teacher (dry run)`);
                    updatedCount++;
                }
                else {
                    console.log(`   ⏭️  No updates needed`);
                    skippedCount++;
                }
            }
            catch (error) {
                console.error(`   ❌ Error updating teacher ${teacher._id}:`, error);
            }
        }
        console.log("\n📈 Migration Summary:");
        console.log(`✅ Updated: ${updatedCount} teachers`);
        console.log(`⏭️  Skipped: ${skippedCount} teachers`);
        if (assignClassesBasedOnSubjects) {
            console.log(`🎯 Classes assigned: ${classesAssignedCount}`);
        }
        console.log(`📊 Total processed: ${teachers.length} teachers`);
        // Show detailed statistics
        console.log("\n📊 Detailed Statistics:");
        const teachersWithClassIds = await Teacher.find({ classIds: { $exists: true } });
        const teachersWithAssignedClasses = await Teacher.find({ classIds: { $ne: [] } });
        const teachersWithoutDepartment = await Teacher.find({ department: { $exists: false } });
        console.log(`✅ Teachers with classIds field: ${teachersWithClassIds.length}/${teachers.length}`);
        console.log(`🎯 Teachers with assigned classes: ${teachersWithAssignedClasses.length}/${teachers.length}`);
        console.log(`✅ Teachers without department field: ${teachersWithoutDepartment.length}/${teachers.length}`);
        // Show sample of updated teachers
        if (teachersWithClassIds.length > 0) {
            console.log("\n📋 Sample of updated teachers:");
            const sampleTeachers = await Teacher.find({})
                .populate('userId', 'name email')
                .populate('subjectIds', 'code name level')
                .populate('classIds', 'name displayName level')
                .limit(3);
            sampleTeachers.forEach((teacher, index) => {
                console.log(`\n${index + 1}. Teacher: ${teacher.userId?.name}`);
                console.log(`   Email: ${teacher.userId?.email}`);
                console.log(`   Subjects (${teacher.subjectIds.length}): ${teacher.subjectIds.map((s) => `${s.code} (L${s.level})`).join(', ')}`);
                console.log(`   Classes (${teacher.classIds.length}): ${teacher.classIds.map((c) => `${c.name} (L${c.level})`).join(', ')}`);
            });
        }
        if (!dryRun) {
            console.log("\n🎉 Teacher migration completed successfully!");
        }
        else {
            console.log("\n🧪 Dry run completed. Use dryRun: false to apply changes.");
        }
    }
    catch (error) {
        console.error("❌ Migration failed:", error);
        throw error;
    }
    finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected from database");
    }
}
// Helper function to run basic migration
async function runBasicMigration() {
    await migrateTeachersWithClasses({ dryRun: false });
}
// Helper function to run migration with class assignment
async function runMigrationWithClasses() {
    await migrateTeachersWithClasses({
        assignClassesBasedOnSubjects: true,
        dryRun: false
    });
}
// Helper function to run dry run
async function runDryRun() {
    await migrateTeachersWithClasses({
        assignClassesBasedOnSubjects: true,
        dryRun: true
    });
}
// Run migration if this script is executed directly
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'basic';
    console.log(`🚀 Running migration with command: ${command}`);
    switch (command) {
        case 'basic':
            runBasicMigration()
                .then(() => process.exit(0))
                .catch((error) => {
                console.error("❌ Basic migration failed:", error);
                process.exit(1);
            });
            break;
        case 'with-classes':
            runMigrationWithClasses()
                .then(() => process.exit(0))
                .catch((error) => {
                console.error("❌ Migration with classes failed:", error);
                process.exit(1);
            });
            break;
        case 'dry-run':
            runDryRun()
                .then(() => process.exit(0))
                .catch((error) => {
                console.error("❌ Dry run failed:", error);
                process.exit(1);
            });
            break;
        default:
            console.log("Available commands:");
            console.log("  basic        - Basic migration (add classIds field, remove department)");
            console.log("  with-classes - Migration with automatic class assignment based on subjects");
            console.log("  dry-run      - Preview what changes would be made");
            process.exit(1);
    }
}
export { migrateTeachersWithClasses, runBasicMigration, runMigrationWithClasses, runDryRun };
//# sourceMappingURL=migrateTeachersWithClasses.js.map