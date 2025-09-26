const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/softworks');

// Define schemas directly
const SubjectSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  shortName: { type: String, required: true },
  category: { type: String, required: true },
  level: [Number],
  isActive: { type: Boolean, default: true },
  description: String,
  color: String
});

const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true },
  displayName: { type: String, required: true },
  level: { type: Number, required: true },
  section: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  description: String
});

const Subject = mongoose.model('Subject', SubjectSchema);
const Class = mongoose.model('Class', ClassSchema);

async function createTestData() {
  try {
    console.log('Creating test data...');
    
    // Create a test subject
    const subject = new Subject({
      code: 'MATH',
      name: 'Mathematics',
      shortName: 'Math',
      category: 'MATHEMATICS',
      level: [9, 10, 11, 12],
      isActive: true,
      description: 'Mathematics subject for high school',
      color: '#3B82F6'
    });
    
    const savedSubject = await subject.save();
    console.log('✅ Created subject:', savedSubject._id.toString());
    
    // Create a test class
    const classData = new Class({
      name: 'Class 11A',
      displayName: 'Class 11A',
      level: 11,
      section: 'A',
      isActive: true,
      description: 'Class 11 Section A'
    });
    
    const savedClass = await classData.save();
    console.log('✅ Created class:', savedClass._id.toString());
    
    console.log('\n🎉 Test data created successfully!');
    console.log('Subject ID:', savedSubject._id.toString());
    console.log('Class ID:', savedClass._id.toString());
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTestData();
