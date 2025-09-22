import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Import models
import { Student } from './src/models/Student.js';
import { User } from './src/models/User.js';

async function testStudentCount() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/softworks');
    console.log('Connected to MongoDB');

    // Test 1: Count all students in Student collection
    const totalStudentsInCollection = await Student.countDocuments({});
    console.log(`Total students in Student collection: ${totalStudentsInCollection}`);

    // Test 2: Count all users with role STUDENT
    const totalStudentUsers = await User.countDocuments({ role: "STUDENT" });
    console.log(`Total users with role STUDENT: ${totalStudentUsers}`);

    // Test 3: Count active users with role STUDENT
    const activeStudentUsers = await User.countDocuments({ role: "STUDENT", isActive: true });
    console.log(`Active users with role STUDENT: ${activeStudentUsers}`);

    // Test 4: Count students with active user accounts (using aggregation)
    const activeStudentsWithUsers = await Student.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      { $match: { "user.isActive": true, "user.role": "STUDENT" } },
      { $count: "total" }
    ]);
    const activeStudentsCount = activeStudentsWithUsers[0]?.total || 0;
    console.log(`Active students (with active user accounts): ${activeStudentsCount}`);

    // Test 5: Count inactive users with role STUDENT
    const inactiveStudentUsers = await User.countDocuments({ role: "STUDENT", isActive: false });
    console.log(`Inactive users with role STUDENT: ${inactiveStudentUsers}`);

    // Test 6: Find students with inactive user accounts
    const studentsWithInactiveUsers = await Student.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      { $match: { "user.isActive": false, "user.role": "STUDENT" } },
      { $count: "total" }
    ]);
    const inactiveStudentsCount = studentsWithInactiveUsers[0]?.total || 0;
    console.log(`Students with inactive user accounts: ${inactiveStudentsCount}`);

    // Test 7: Find orphaned student records (students without corresponding user)
    const orphanedStudents = await Student.aggregate([
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $match: { user: { $size: 0 } } },
      { $count: "total" }
    ]);
    const orphanedCount = orphanedStudents[0]?.total || 0;
    console.log(`Orphaned student records (no corresponding user): ${orphanedCount}`);

    console.log('\n--- Summary ---');
    console.log(`Dashboard should show: ${activeStudentsCount} students`);
    console.log(`This represents active students with active user accounts`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

testStudentCount();
