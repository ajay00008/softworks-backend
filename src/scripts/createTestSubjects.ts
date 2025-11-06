import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Subject } from "../models/Subject";
import logger from "../utils/logger";

async function createTestSubjects() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get the admin ID
    const admin = await User.findOne({ role: 'ADMIN' });
    if (!admin) {
      console.error('No admin found');
      return;
    }

    console.log('Admin ID:', admin._id);

    // Sample subjects
    const subjects = [
      {
        code: 'MATH',
        name: 'Mathematics',
        shortName: 'Math',
        category: 'MATHEMATICS',
        classIds: [], // Will be populated later
        description: 'Mathematics subject covering all levels',
        color: '#3B82F6', // Blue
        adminId: admin._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'PHY',
        name: 'Physics',
        shortName: 'Physics',
        category: 'SCIENCE',
        classIds: [], // Will be populated later
        description: 'Physics subject for higher classes',
        color: '#10B981', // Green
        adminId: admin._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'CHEM',
        name: 'Chemistry',
        shortName: 'Chem',
        category: 'SCIENCE',
        classIds: [], // Will be populated later
        description: 'Chemistry subject for higher classes',
        color: '#8B5CF6', // Purple
        adminId: admin._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'BIO',
        name: 'Biology',
        shortName: 'Bio',
        category: 'SCIENCE',
        classIds: [], // Will be populated later
        description: 'Biology subject for higher classes',
        color: '#F59E0B', // Orange
        adminId: admin._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        code: 'ENG',
        name: 'English',
        shortName: 'Eng',
        category: 'ENGLISH',
        classIds: [], // Will be populated later
        description: 'English language subject',
        color: '#EF4444', // Red
        adminId: admin._id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Clear ALL existing subjects first (to avoid code conflicts)
    const deletedCount = await Subject.deleteMany({});
    console.log(`Cleared ${deletedCount.deletedCount} existing subjects`);

    // Create subjects
    const createdSubjects = await Subject.insertMany(subjects);
    console.log(`Created ${createdSubjects.length} subjects:`, createdSubjects.map(s => s.name));

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error: unknown) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

createTestSubjects();
