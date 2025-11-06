import mongoose from "mongoose";
import { env } from "../config/env";
import { User } from "../models/User";
import { Subject } from "../models/Subject";

async function checkSubjects() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check users
    const users = await User.find({ role: 'ADMIN' });
    console.log('Admin users:', users.map(u => ({ id: u._id, email: u.email, name: u.name })));

    // Check subjects
    const subjects = await Subject.find({});
    console.log('All subjects:', subjects.map(s => ({ 
      id: s._id, 
      name: s.name, 
      adminId: s.adminId,
      isActive: s.isActive 
    })));

    // Check subjects for specific admin
    if (users.length > 0 && users[0]) {
      const adminId = users[0]._id;
      const adminSubjects = await Subject.find({ adminId });
      console.log(`Subjects for admin ${adminId}:`, adminSubjects.map(s => s.name));
    }

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

  } catch (error: unknown) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

checkSubjects();
