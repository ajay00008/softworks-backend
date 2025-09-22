import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { Student } from "../models/Student.js";
import { Teacher } from "../models/Teacher.js";
import { Class } from "../models/Class.js";
import { Subject } from "../models/Subject.js";
import { Exam } from "../models/Exam.js";
import { Question } from "../models/Question.js";
import { Result } from "../models/Result.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/softworks";

// Sample data for comprehensive seeding
const sampleUsers = [
  // Students
  { email: "john.doe@student.com", name: "John Doe", password: "password123", role: "STUDENT", isActive: true },
  { email: "jane.smith@student.com", name: "Jane Smith", password: "password123", role: "STUDENT", isActive: true },
  { email: "mike.johnson@student.com", name: "Mike Johnson", password: "password123", role: "STUDENT", isActive: true },
  { email: "sarah.wilson@student.com", name: "Sarah Wilson", password: "password123", role: "STUDENT", isActive: true },
  { email: "david.brown@student.com", name: "David Brown", password: "password123", role: "STUDENT", isActive: true },
  { email: "emma.davis@student.com", name: "Emma Davis", password: "password123", role: "STUDENT", isActive: true },
  { email: "alex.garcia@student.com", name: "Alex Garcia", password: "password123", role: "STUDENT", isActive: true },
  { email: "lisa.martinez@student.com", name: "Lisa Martinez", password: "password123", role: "STUDENT", isActive: true },
  { email: "tom.anderson@student.com", name: "Tom Anderson", password: "password123", role: "STUDENT", isActive: true },
  { email: "anna.taylor@student.com", name: "Anna Taylor", password: "password123", role: "STUDENT", isActive: true },
  { email: "james.thomas@student.com", name: "James Thomas", password: "password123", role: "STUDENT", isActive: true },
  { email: "sophia.jackson@student.com", name: "Sophia Jackson", password: "password123", role: "STUDENT", isActive: true },
  { email: "william.white@student.com", name: "William White", password: "password123", role: "STUDENT", isActive: true },
  { email: "olivia.harris@student.com", name: "Olivia Harris", password: "password123", role: "STUDENT", isActive: true },
  { email: "benjamin.martin@student.com", name: "Benjamin Martin", password: "password123", role: "STUDENT", isActive: true },
  { email: "ava.thompson@student.com", name: "Ava Thompson", password: "password123", role: "STUDENT", isActive: true },
  { email: "lucas.garcia@student.com", name: "Lucas Garcia", password: "password123", role: "STUDENT", isActive: true },
  { email: "mia.martinez@student.com", name: "Mia Martinez", password: "password123", role: "STUDENT", isActive: true },
  { email: "henry.robinson@student.com", name: "Henry Robinson", password: "password123", role: "STUDENT", isActive: true },
  { email: "charlotte.clark@student.com", name: "Charlotte Clark", password: "password123", role: "STUDENT", isActive: true },
  { email: "alexander.rodriguez@student.com", name: "Alexander Rodriguez", password: "password123", role: "STUDENT", isActive: true },
  { email: "amelia.lewis@student.com", name: "Amelia Lewis", password: "password123", role: "STUDENT", isActive: true },
  { email: "mason.lee@student.com", name: "Mason Lee", password: "password123", role: "STUDENT", isActive: true },
  { email: "harper.walker@student.com", name: "Harper Walker", password: "password123", role: "STUDENT", isActive: true },
  { email: "ethan.hall@student.com", name: "Ethan Hall", password: "password123", role: "STUDENT", isActive: true },
  { email: "evelyn.allen@student.com", name: "Evelyn Allen", password: "password123", role: "STUDENT", isActive: true },
  { email: "logan.young@student.com", name: "Logan Young", password: "password123", role: "STUDENT", isActive: true },
  { email: "abigail.hernandez@student.com", name: "Abigail Hernandez", password: "password123", role: "STUDENT", isActive: true },
  { email: "sebastian.king@student.com", name: "Sebastian King", password: "password123", role: "STUDENT", isActive: true },
  { email: "emily.wright@student.com", name: "Emily Wright", password: "password123", role: "STUDENT", isActive: true },
  
  // Teachers
  { email: "prof.math@teacher.com", name: "Prof. Mathematics", password: "password123", role: "TEACHER", isActive: true },
  { email: "prof.physics@teacher.com", name: "Prof. Physics", password: "password123", role: "TEACHER", isActive: true },
  { email: "prof.chemistry@teacher.com", name: "Prof. Chemistry", password: "password123", role: "TEACHER", isActive: true },
  { email: "prof.biology@teacher.com", name: "Prof. Biology", password: "password123", role: "TEACHER", isActive: true },
  { email: "prof.english@teacher.com", name: "Prof. English", password: "password123", role: "TEACHER", isActive: true },
  { email: "prof.computer@teacher.com", name: "Prof. Computer Science", password: "password123", role: "TEACHER", isActive: true },
  
  // Admin
  { email: "admin@school.com", name: "School Admin", password: "password123", role: "ADMIN", isActive: true }
];

const sampleClasses = [
  { name: "11A", displayName: "Class 11A", level: 11, academicYear: "2024-25", section: "A" },
  { name: "11B", displayName: "Class 11B", level: 11, academicYear: "2024-25", section: "B" },
  { name: "11C", displayName: "Class 11C", level: 11, academicYear: "2024-25", section: "C" },
  { name: "12A", displayName: "Class 12A", level: 12, academicYear: "2024-25", section: "A" },
  { name: "12B", displayName: "Class 12B", level: 12, academicYear: "2024-25", section: "B" }
];

const sampleSubjects = [
  { name: "Mathematics", code: "MATH", shortName: "Math", category: "MATHEMATICS", level: [11, 12] },
  { name: "Physics", code: "PHY", shortName: "Phy", category: "SCIENCE", level: [11, 12] },
  { name: "Chemistry", code: "CHEM", shortName: "Chem", category: "SCIENCE", level: [11, 12] },
  { name: "Biology", code: "BIO", shortName: "Bio", category: "SCIENCE", level: [11, 12] },
  { name: "English", code: "ENG", shortName: "Eng", category: "LANGUAGES", level: [11, 12] },
  { name: "Computer Science", code: "CS", shortName: "CS", category: "COMPUTER_SCIENCE", level: [11, 12] }
];

const examTypes = ["QUIZ", "ASSIGNMENT", "UNIT_TEST", "MID_TERM", "FINAL"];
const examStatuses = ["SCHEDULED", "ONGOING", "COMPLETED"];

async function seedComprehensiveData() {
  try {
    console.log("🌱 Starting comprehensive data seeding...");
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    console.log("🧹 Clearing existing data...");
    await Result.deleteMany({});
    await Question.deleteMany({});
    await Exam.deleteMany({});
    await Student.deleteMany({});
    await Teacher.deleteMany({});
    await Class.deleteMany({});
    await Subject.deleteMany({});
    await User.deleteMany({});
    console.log("✅ Cleared existing data");

    // Create Users
    console.log("👥 Creating users...");
    const users = [];
    for (const userData of sampleUsers) {
      const passwordHash = await bcrypt.hash(userData.password, 10);
      const user = new User({
        email: userData.email,
        name: userData.name,
        passwordHash: passwordHash,
        role: userData.role,
        isActive: userData.isActive
      });
      await user.save();
      users.push(user);
    }
    console.log(`✅ Created ${users.length} users`);

    // Create Classes
    console.log("🏫 Creating classes...");
    const classes = await Class.insertMany(sampleClasses);
    console.log(`✅ Created ${classes.length} classes`);

    // Create Subjects
    console.log("📚 Creating subjects...");
    const subjects = await Subject.insertMany(sampleSubjects);
    console.log(`✅ Created ${subjects.length} subjects`);

    // Create Students
    console.log("🎓 Creating students...");
    const studentUsers = users.filter(u => u.role === "STUDENT");
    const students = [];
    
    for (let i = 0; i < studentUsers.length; i++) {
      const user = studentUsers[i];
      const classIndex = i % classes.length;
      const student = new Student({
        userId: user._id,
        rollNumber: `STU${String(i + 1).padStart(3, '0')}`,
        firstName: user.email.split('@')[0].split('.')[0],
        lastName: user.email.split('@')[0].split('.')[1] || 'Student',
        dateOfBirth: new Date(2005 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
        classId: classes[classIndex]._id,
        admissionDate: new Date(2024, 6, 1).toISOString().split('T')[0],
        parentName: `Parent of ${user.email.split('@')[0]}`,
        parentContact: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        address: `Address ${i + 1}, City, State`
      });
      await student.save();
      students.push(student);
    }
    console.log(`✅ Created ${students.length} students`);

    // Create Teachers
    console.log("👨‍🏫 Creating teachers...");
    const teacherUsers = users.filter(u => u.role === "TEACHER");
    const teachers = [];
    
    for (let i = 0; i < teacherUsers.length; i++) {
      const user = teacherUsers[i];
      const teacher = new Teacher({
        userId: user._id,
        employeeId: `TCH${String(i + 1).padStart(3, '0')}`,
        firstName: user.email.split('@')[0].split('.')[1] || 'Teacher',
        lastName: 'Professor',
        dateOfBirth: new Date(1980 + Math.floor(Math.random() * 15), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
        joiningDate: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
        qualification: "M.Sc, B.Ed",
        specialization: subjects[i]?.name || "General",
        contactNumber: `+91${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        address: `Teacher Address ${i + 1}, City, State`
      });
      await teacher.save();
      teachers.push(teacher);
    }
    console.log(`✅ Created ${teachers.length} teachers`);

    // Create Exams and Results
    console.log("📝 Creating exams and results...");
    const exams = [];
    const results = [];
    
    // Create 100 exams across different subjects and classes
    for (let i = 0; i < 100; i++) {
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      const classObj = classes[Math.floor(Math.random() * classes.length)];
      const teacher = teachers[Math.floor(Math.random() * teachers.length)];
      const examType = examTypes[Math.floor(Math.random() * examTypes.length)];
      
      // 80% past exams, 20% future exams
      const isPast = Math.random() < 0.8;
      const examDate = isPast 
        ? new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000) // Last 90 days
        : new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000); // Next 30 days
      
      const status = isPast ? "COMPLETED" : "SCHEDULED";
      
      const exam = new Exam({
        title: `${examType} - ${subject.name} - ${classObj.name}`,
        description: `${examType} exam for ${subject.name} in class ${classObj.name}`,
        examType,
        subjectId: subject._id,
        classId: classObj._id,
        createdBy: teacher._id,
        totalMarks: 100,
        duration: 120, // 2 hours
        scheduledDate: examDate,
        status,
        instructions: "Read all questions carefully before answering."
      });
      
      await exam.save();
      exams.push(exam);

      // Skip creating questions for now - focus on populating dashboard data

      // Create results for completed exams
      if (status === "COMPLETED") {
        const classStudents = students.filter(s => s.classId.toString() === classObj._id.toString());
        
        for (const student of classStudents) {
          // Generate realistic marks based on student performance
          const basePerformance = Math.random(); // 0-1
          const marksObtained = Math.floor(basePerformance * 100);
          const percentage = Math.min((marksObtained / 100) * 100, 100);
          
          // Determine grade based on percentage
          let grade;
          if (percentage >= 90) grade = "A+";
          else if (percentage >= 80) grade = "A";
          else if (percentage >= 70) grade = "B+";
          else if (percentage >= 60) grade = "B";
          else if (percentage >= 50) grade = "C+";
          else if (percentage >= 40) grade = "C";
          else grade = "F";
          
          const result = new Result({
            examId: exam._id,
            studentId: student.userId, // Reference to User model
            answers: [], // Empty for now since we're not creating questions
            totalMarksObtained: marksObtained,
            percentage,
            grade,
            submissionStatus: "SUBMITTED",
            submittedAt: new Date(exam.scheduledDate.getTime() + Math.random() * 2 * 60 * 60 * 1000), // Within 2 hours of exam
            isAbsent: false,
            isMissingSheet: false
          });
          
          await result.save();
          results.push(result);
        }
      }
    }
    
    console.log(`✅ Created ${exams.length} exams`);
    console.log(`✅ Created ${results.length} results`);

    console.log("🎉 Comprehensive data seeding completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Users: ${users.length}`);
    console.log(`   - Students: ${students.length}`);
    console.log(`   - Teachers: ${teachers.length}`);
    console.log(`   - Classes: ${classes.length}`);
    console.log(`   - Subjects: ${subjects.length}`);
    console.log(`   - Exams: ${exams.length}`);
    console.log(`   - Results: ${results.length}`);

  } catch (error) {
    console.error("❌ Error seeding comprehensive data:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

// Run the seeding function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedComprehensiveData()
    .then(() => {
      console.log("✅ Seeding completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}

export { seedComprehensiveData };
