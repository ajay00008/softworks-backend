import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import { Class } from "../models/Class";
import { Subject } from "../models/Subject";
import { Exam } from "../models/Exam";
import { Question } from "../models/Question";
import { Result } from "../models/Result";
// ClassSubjectMapping is handled through existing models, no separate model needed

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/softworks");
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Sample data
const sampleClasses = [
  { name: "11A", displayName: "Class 11 A", level: 11, section: "A", academicYear: "2024-25" },
  { name: "11B", displayName: "Class 11 B", level: 11, section: "B", academicYear: "2024-25" },
  { name: "11C", displayName: "Class 11 C", level: 11, section: "C", academicYear: "2024-25" },
  { name: "12A", displayName: "Class 12 A", level: 12, section: "A", academicYear: "2024-25" },
  { name: "12B", displayName: "Class 12 B", level: 12, section: "B", academicYear: "2024-25" }
];

const sampleSubjects = [
  { code: "MATH", name: "Mathematics", shortName: "Math", category: "MATHEMATICS", level: [11, 12] },
  { code: "PHY", name: "Physics", shortName: "Physics", category: "SCIENCE", level: [11, 12] },
  { code: "CHEM", name: "Chemistry", shortName: "Chemistry", category: "SCIENCE", level: [11, 12] },
  { code: "BIO", name: "Biology", shortName: "Biology", category: "SCIENCE", level: [11, 12] },
  { code: "ENG", name: "English", shortName: "English", category: "LANGUAGES", level: [11, 12] },
  { code: "CS", name: "Computer Science", shortName: "CS", category: "COMPUTER_SCIENCE", level: [11, 12] }
];

const sampleStudents = [
  { name: "John Doe", rollNumber: "11A001", email: "john.doe@school.com" },
  { name: "Jane Smith", rollNumber: "11A002", email: "jane.smith@school.com" },
  { name: "Mike Johnson", rollNumber: "11A003", email: "mike.johnson@school.com" },
  { name: "Sarah Wilson", rollNumber: "11A004", email: "sarah.wilson@school.com" },
  { name: "David Brown", rollNumber: "11A005", email: "david.brown@school.com" },
  { name: "Emily Davis", rollNumber: "11B001", email: "emily.davis@school.com" },
  { name: "James Miller", rollNumber: "11B002", email: "james.miller@school.com" },
  { name: "Lisa Garcia", rollNumber: "11B003", email: "lisa.garcia@school.com" },
  { name: "Robert Martinez", rollNumber: "11B004", email: "robert.martinez@school.com" },
  { name: "Jennifer Anderson", rollNumber: "11B005", email: "jennifer.anderson@school.com" },
  { name: "William Taylor", rollNumber: "11C001", email: "william.taylor@school.com" },
  { name: "Ashley Thomas", rollNumber: "11C002", email: "ashley.thomas@school.com" },
  { name: "Christopher Jackson", rollNumber: "11C003", email: "christopher.jackson@school.com" },
  { name: "Amanda White", rollNumber: "11C004", email: "amanda.white@school.com" },
  { name: "Matthew Harris", rollNumber: "11C005", email: "matthew.harris@school.com" },
  { name: "Jessica Martin", rollNumber: "12A001", email: "jessica.martin@school.com" },
  { name: "Daniel Thompson", rollNumber: "12A002", email: "daniel.thompson@school.com" },
  { name: "Michelle Garcia", rollNumber: "12A003", email: "michelle.garcia@school.com" },
  { name: "Andrew Martinez", rollNumber: "12A004", email: "andrew.martinez@school.com" },
  { name: "Stephanie Robinson", rollNumber: "12A005", email: "stephanie.robinson@school.com" }
];

const sampleTeachers = [
  { name: "Dr. Alice Johnson", email: "alice.johnson@school.com", qualification: "Ph.D. Mathematics", experience: 15 },
  { name: "Prof. Bob Smith", email: "bob.smith@school.com", qualification: "M.Sc. Physics", experience: 12 },
  { name: "Dr. Carol Davis", email: "carol.davis@school.com", qualification: "Ph.D. Chemistry", experience: 18 },
  { name: "Mr. David Wilson", email: "david.wilson@school.com", qualification: "M.Sc. Biology", experience: 10 },
  { name: "Ms. Emma Brown", email: "emma.brown@school.com", qualification: "M.A. English", experience: 8 },
  { name: "Dr. Frank Miller", email: "frank.miller@school.com", qualification: "Ph.D. Computer Science", experience: 20 }
];

const examTypes = ["UNIT_TEST", "MID_TERM", "FINAL", "QUIZ", "ASSIGNMENT"] as const;
const questionTypes = ["MULTIPLE_CHOICE", "SHORT_ANSWER", "LONG_ANSWER", "TRUE_FALSE"] as const;
const bloomsLevels = ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"] as const;
const difficulties = ["EASY", "MODERATE", "TOUGHEST"] as const;

// Generate random data
const getRandomElement = <T>(array: T[]): T => array[Math.floor(Math.random() * array.length)];
const getRandomNumber = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min: number, max: number): number => Math.random() * (max - min) + min;

// Generate sample questions
const generateQuestions = async (subjects: any[], classes: any[], teachers: any[]) => {
  const questions = [];
  
  for (let i = 0; i < 200; i++) {
    const subject = getRandomElement(subjects);
    const classObj = getRandomElement(classes);
    const teacher = getRandomElement(teachers);
    const questionType = getRandomElement(questionTypes);
    const bloomsLevel = getRandomElement(bloomsLevels);
    const difficulty = getRandomElement(difficulties);
    
    const question = {
      questionText: `Sample question ${i + 1} for ${subject.name} in ${classObj.name}`,
      questionType,
      subjectId: subject._id,
      classId: classObj._id,
      unit: `Unit ${getRandomNumber(1, 10)}`,
      bloomsTaxonomyLevel: bloomsLevel,
      difficulty,
      isTwisted: Math.random() < 0.2,
      options: questionType === "MULTIPLE_CHOICE" ? [
        "Option A", "Option B", "Option C", "Option D"
      ] : undefined,
      correctAnswer: questionType === "MULTIPLE_CHOICE" ? "Option A" : "Sample correct answer",
      explanation: "This is a sample explanation for the question",
      marks: getRandomNumber(1, 10),
      timeLimit: getRandomNumber(30, 300),
      tags: [`tag${getRandomNumber(1, 5)}`],
      language: "ENGLISH",
      createdBy: teacher._id,
      isActive: true
    };
    
    questions.push(question);
  }
  
  return await Question.insertMany(questions);
};

// Generate sample exams
const generateExams = async (subjects: any[], classes: any[], teachers: any[], questions: any[]) => {
  const exams = [];
  const now = new Date();
  
  for (let i = 0; i < 80; i++) {
    const subject = getRandomElement(subjects);
    const classObj = getRandomElement(classes);
    const teacher = getRandomElement(teachers);
    const examType = getRandomElement(examTypes);
    
    // Generate exam date (past 8 months to future 1 month) - more bias towards past
    const examDate = new Date(now.getTime() + (Math.random() - 0.9) * 240 * 24 * 60 * 60 * 1000);
    
    // Select random questions for this exam
    const examQuestions = questions
      .filter(q => q.subjectId.toString() === subject._id.toString() && q.classId.toString() === classObj._id.toString())
      .slice(0, getRandomNumber(5, 15));
    
    const exam = {
      title: `${examType.replace('_', ' ')} - ${subject.name} - ${classObj.name}`,
      description: `Sample ${examType.toLowerCase()} for ${subject.name}`,
      examType,
      subjectId: subject._id,
      classId: classObj._id,
      totalMarks: examQuestions.reduce((sum, q) => sum + q.marks, 0),
      duration: getRandomNumber(60, 180),
      status: examDate < now ? "COMPLETED" : "SCHEDULED",
      scheduledDate: examDate,
      endDate: new Date(examDate.getTime() + getRandomNumber(60, 180) * 60 * 1000),
      createdBy: teacher._id,
      questions: examQuestions.map(q => q._id),
      questionDistribution: [
        {
          unit: "Unit 1",
          bloomsLevel: "REMEMBER",
          difficulty: "EASY",
          percentage: 30
        },
        {
          unit: "Unit 2",
          bloomsLevel: "UNDERSTAND",
          difficulty: "MODERATE",
          percentage: 40
        },
        {
          unit: "Unit 3",
          bloomsLevel: "APPLY",
          difficulty: "TOUGHEST",
          percentage: 30
        }
      ],
      instructions: "Read all questions carefully before answering",
      isActive: true,
      allowLateSubmission: Math.random() < 0.3,
      lateSubmissionPenalty: Math.random() < 0.3 ? getRandomNumber(5, 20) : undefined
    };
    
    exams.push(exam);
  }
  
  return await Exam.insertMany(exams);
};

// Generate sample results
const generateResults = async (exams: any[], students: any[]) => {
  const results = [];
  const now = new Date();
  
  for (const exam of exams) {
    const examDate = new Date(exam.scheduledDate);
    
    // Only generate results for exams that are in the past or very recent
    // 80% of past exams should have results, 20% of recent exams
    const isPastExam = examDate < now;
    const isRecentExam = examDate >= now && examDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    if (!isPastExam && !isRecentExam) continue;
    if (isPastExam && Math.random() > 0.8) continue;
    if (isRecentExam && Math.random() > 0.2) continue;
    
    // Update exam status to COMPLETED if it has results
    await Exam.findByIdAndUpdate(exam._id, { status: "COMPLETED" });
    
    // Get students for this exam's class
    const classStudents = students.filter(s => s.classId.toString() === exam.classId.toString());
    
    for (const student of classStudents) {
      // Skip some students randomly (absent) - 5% absent rate
      if (Math.random() < 0.05) continue;
      
      const answers = [];
      let totalMarksObtained = 0;
      
      for (const questionId of exam.questions) {
        // More realistic marks distribution based on student performance
        const studentPerformance = Math.random(); // 0-1, higher = better student
        let marksObtained;
        
        if (studentPerformance < 0.1) {
          // 10% chance of very low marks (0-3)
          marksObtained = getRandomNumber(0, 3);
        } else if (studentPerformance < 0.25) {
          // 15% chance of low marks (3-6)
          marksObtained = getRandomNumber(3, 6);
        } else if (studentPerformance < 0.6) {
          // 35% chance of average marks (6-8)
          marksObtained = getRandomNumber(6, 8);
        } else if (studentPerformance < 0.85) {
          // 25% chance of good marks (8-10)
          marksObtained = getRandomNumber(8, 10);
        } else {
          // 15% chance of perfect marks (10)
          marksObtained = 10;
        }
        
        totalMarksObtained += marksObtained;
        
        answers.push({
          questionId,
          answer: "Sample answer",
          isCorrect: marksObtained > 5,
          marksObtained,
          timeSpent: getRandomNumber(30, 300)
        });
      }
      
      const percentage = Math.min((totalMarksObtained / exam.totalMarks) * 100, 100);
      const grade = percentage >= 90 ? "A+" : 
                   percentage >= 80 ? "A" : 
                   percentage >= 70 ? "B+" : 
                   percentage >= 60 ? "B" : 
                   percentage >= 50 ? "C+" : 
                   percentage >= 40 ? "C" : 
                   percentage >= 30 ? "D" : "F";
      
      const result = {
        examId: exam._id,
        studentId: student.userId, // Use userId from Student model, not student._id
        answers,
        totalMarksObtained,
        percentage: Math.round(percentage * 100) / 100,
        grade,
        submissionStatus: "SUBMITTED",
        submittedAt: new Date(exam.scheduledDate.getTime() + getRandomNumber(0, exam.duration) * 60 * 1000),
        startedAt: exam.scheduledDate,
        timeSpent: getRandomNumber(30, exam.duration * 60),
        isAbsent: false,
        isMissingSheet: false,
        isActive: true
      };
      
      results.push(result);
    }
  }
  
  return await Result.insertMany(results);
};

// Main seeding function
const seedDashboardData = async () => {
  try {
    await connectDB();
    
    console.log("Starting dashboard data seeding...");
    
    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Student.deleteMany({}),
      Teacher.deleteMany({}),
      Class.deleteMany({}),
      Subject.deleteMany({}),
      Exam.deleteMany({}),
      Question.deleteMany({}),
      Result.deleteMany({})
    ]);
    
    console.log("Cleared existing data");
    
    // Create classes
    const classes = await Class.insertMany(sampleClasses);
    console.log(`Created ${classes.length} classes`);
    
    // Create subjects
    const subjects = await Subject.insertMany(sampleSubjects);
    console.log(`Created ${subjects.length} subjects`);
    
    // Class-subject mappings are handled through the existing models
    // No separate collection needed as relationships are managed through references
    console.log("Class-subject relationships established through model references");
    
    // Create admin user
    const adminPasswordHash = await bcrypt.hash("admin123", 12);
    const adminUser = await User.create({
      email: "admin@school.com",
      passwordHash: adminPasswordHash,
      name: "Admin User",
      role: "ADMIN",
      isActive: true
    });
    console.log("Created admin user");
    
    // Create teacher users and teachers
    const teachers = [];
    for (let i = 0; i < sampleTeachers.length; i++) {
      const teacherData = sampleTeachers[i];
      const passwordHash = await bcrypt.hash("teacher123", 12);
      
      const user = await User.create({
        email: teacherData.email,
        passwordHash,
        name: teacherData.name,
        role: "TEACHER",
        isActive: true
      });
      
      const teacher = await Teacher.create({
        userId: user._id,
        name: teacherData.name,
        email: teacherData.email,
        qualification: teacherData.qualification,
        experience: teacherData.experience,
        subjectIds: [subjects[i % subjects.length]._id],
        classIds: [classes[i % classes.length]._id],
        isActive: true
      });
      
      teachers.push(teacher);
    }
    console.log(`Created ${teachers.length} teachers`);
    
    // Create student users and students
    const students = [];
    for (let i = 0; i < sampleStudents.length; i++) {
      const studentData = sampleStudents[i];
      const passwordHash = await bcrypt.hash("student123", 12);
      
      const user = await User.create({
        email: studentData.email,
        passwordHash,
        name: studentData.name,
        role: "STUDENT",
        isActive: true
      });
      
      const classObj = classes.find(c => studentData.rollNumber.startsWith(c.name));
      const student = await Student.create({
        userId: user._id,
        name: studentData.name,
        email: studentData.email,
        rollNumber: studentData.rollNumber,
        classId: classObj?._id || classes[0]._id,
        fatherName: `Father of ${studentData.name}`,
        motherName: `Mother of ${studentData.name}`,
        dateOfBirth: `${2000 + Math.floor(Math.random() * 5)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        parentsPhone: `+91${getRandomNumber(9000000000, 9999999999)}`,
        parentsEmail: `parent.${studentData.email}`,
        address: `Address of ${studentData.name}`,
        whatsappNumber: `+91${getRandomNumber(9000000000, 9999999999)}`,
        isActive: true
      });
      
      students.push(student);
    }
    console.log(`Created ${students.length} students`);
    
    // Generate questions
    const questions = await generateQuestions(subjects, classes, teachers);
    console.log(`Created ${questions.length} questions`);
    
    // Generate exams
    const exams = await generateExams(subjects, classes, teachers, questions);
    console.log(`Created ${exams.length} exams`);
    
    // Generate results
    const results = await generateResults(exams, students);
    console.log(`Created ${results.length} results`);
    
    console.log("Dashboard data seeding completed successfully!");
    console.log("\nLogin credentials:");
    console.log("Admin: admin@school.com / admin123");
    console.log("Teacher: alice.johnson@school.com / teacher123");
    console.log("Student: john.doe@school.com / student123");
    
  } catch (error) {
    console.error("Error seeding dashboard data:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the seeding
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDashboardData();
}

export { seedDashboardData };
