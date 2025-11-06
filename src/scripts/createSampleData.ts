import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Subject } from "../models/Subject";
import { Class } from "../models/Class";
import logger from "../utils/logger";

async function createSampleData() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Get the admin
    const admin = await User.findOne({ email: 'admin@softworks.local' });
    if (!admin) {
      console.error('Admin not found');
      return;
    }

    console.log('Admin ID:', admin._id);

    // Create sample subjects
    const subjects = [
      {
        code: 'MATH',
        name: 'Mathematics',
        shortName: 'Math',
        category: 'MATHEMATICS',
        classIds: [],
        description: 'Mathematics subject covering all levels',
        color: '#3B82F6',
        adminId: admin._id,
        isActive: true
      },
      {
        code: 'PHY',
        name: 'Physics',
        shortName: 'Physics',
        category: 'SCIENCE',
        classIds: [],
        description: 'Physics subject for higher classes',
        color: '#10B981',
        adminId: admin._id,
        isActive: true
      },
      {
        code: 'CHEM',
        name: 'Chemistry',
        shortName: 'Chem',
        category: 'SCIENCE',
        classIds: [],
        description: 'Chemistry subject for higher classes',
        color: '#8B5CF6',
        adminId: admin._id,
        isActive: true
      },
      {
        code: 'BIO',
        name: 'Biology',
        shortName: 'Bio',
        category: 'SCIENCE',
        classIds: [],
        description: 'Biology subject for higher classes',
        color: '#F59E0B',
        adminId: admin._id,
        isActive: true
      },
      {
        code: 'ENG',
        name: 'English',
        shortName: 'Eng',
        category: 'LANGUAGES',
        classIds: [],
        description: 'English language subject',
        color: '#EF4444',
        adminId: admin._id,
        isActive: true
      }
    ];

    // Create sample classes
    const classes = [
      {
        name: '10A',
        displayName: 'Class 10A',
        level: 10,
        section: 'A',
        adminId: admin._id,
        isActive: true,
        description: 'Class 10 Section A'
      },
      {
        name: '10B',
        displayName: 'Class 10B',
        level: 10,
        section: 'B',
        adminId: admin._id,
        isActive: true,
        description: 'Class 10 Section B'
      },
      {
        name: '11A',
        displayName: 'Class 11A',
        level: 11,
        section: 'A',
        adminId: admin._id,
        isActive: true,
        description: 'Class 11 Section A'
      },
      {
        name: '12A',
        displayName: 'Class 12A',
        level: 12,
        section: 'A',
        adminId: admin._id,
        isActive: true,
        description: 'Class 12 Section A'
      }
    ];

    // Create subjects
    const createdSubjects = await Subject.insertMany(subjects);
    console.log(`Created ${createdSubjects.length} subjects:`, createdSubjects.map(s => s.name));

    // Create classes
    const createdClasses = await Class.insertMany(classes);
    console.log(`Created ${createdClasses.length} classes:`, createdClasses.map(c => c.name));

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error: unknown) {
    console.error('Error creating sample data:', error);
    await mongoose.disconnect();
  }
}

createSampleData();
