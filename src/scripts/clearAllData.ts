import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Subject } from "../models/Subject";
import { Class } from "../models/Class";
import { Teacher } from "../models/Teacher";
import { Student } from "../models/Student";
import { Exam } from "../models/Exam";
import { Syllabus } from "../models/Syllabus";
import logger from "../utils/logger";

async function clearAllData() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear all collections
    const collections = [
      { name: 'User', model: User },
      { name: 'Subject', model: Subject },
      { name: 'Class', model: Class },
      { name: 'Teacher', model: Teacher },
      { name: 'Student', model: Student },
      { name: 'Exam', model: Exam },
      { name: 'Syllabus', model: Syllabus }
    ];

    for (const collection of collections) {
      const result = await collection.model.deleteMany({});
      console.log(`Cleared ${result.deletedCount} documents from ${collection.name}`);
    }

    console.log('All data cleared successfully!');
    console.log('Database is now empty and ready for fresh testing.');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error) {
    console.error('Error clearing data:', error);
    await mongoose.disconnect();
  }
}

clearAllData();
