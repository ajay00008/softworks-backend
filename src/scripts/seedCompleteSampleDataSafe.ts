import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env";
import { User } from "../models/User";
import { Student } from "../models/Student";
import { Teacher } from "../models/Teacher";
import { Class } from "../models/Class";
import { Subject } from "../models/Subject";
import logger from "../utils/logger";

async function run() {
  await mongoose.connect(env.MONGO_URI);
  
  try {
    console.log("Creating sample data...");

    // Clear existing data first
    console.log("Clearing existing data...");
    await Class.deleteMany({});
    await Subject.deleteMany({});
    await Teacher.deleteMany({});
    await Student.deleteMany({});
    await User.deleteMany({ role: { $in: ["TEACHER", "STUDENT"] } });
    console.log("Existing data cleared");

    // 1. Create Classes
    console.log("Creating classes...");
    const classData = [
      {
        name: "10A",
        displayName: "Class 10A",
        level: 10,
        section: "A",
        academicYear: "2024-25",
        isActive: true,
        description: "Grade 10 Section A"
      },
      {
        name: "10B",
        displayName: "Class 10B", 
        level: 10,
        section: "B",
        academicYear: "2024-25",
        isActive: true,
        description: "Grade 10 Section B"
      },
      {
        name: "11A",
        displayName: "Class 11A",
        level: 11,
        section: "A",
        academicYear: "2024-25",
        isActive: true,
        description: "Grade 11 Section A"
      },
      {
        name: "12A",
        displayName: "Class 12A",
        level: 12,
        section: "A",
        academicYear: "2024-25",
        isActive: true,
        description: "Grade 12 Section A"
      }
    ];

    const classes = [];
    for (const classInfo of classData) {
      const cls = await Class.create(classInfo);
      classes.push(cls);
      console.log(`Created class: ${cls.name}`);
    }

    // 2. Create Subjects
    console.log("Creating subjects...");
    const subjectData = [
      {
        code: "MATH",
        name: "Mathematics",
        shortName: "Math",
        category: "MATHEMATICS",
        level: [9, 10, 11, 12],
        isActive: true,
        description: "Core Mathematics",
        color: "#FF6B6B"
      },
      {
        code: "PHYSICS",
        name: "Physics",
        shortName: "Phy",
        category: "SCIENCE",
        level: [9, 10, 11, 12],
        isActive: true,
        description: "Core Physics",
        color: "#4ECDC4"
      },
      {
        code: "CHEMISTRY",
        name: "Chemistry",
        shortName: "Chem",
        category: "SCIENCE",
        level: [9, 10, 11, 12],
        isActive: true,
        description: "Core Chemistry",
        color: "#45B7D1"
      },
      {
        code: "BIOLOGY",
        name: "Biology",
        shortName: "Bio",
        category: "SCIENCE",
        level: [9, 10, 11, 12],
        isActive: true,
        description: "Core Biology",
        color: "#96CEB4"
      },
      {
        code: "ENGLISH",
        name: "English Language",
        shortName: "Eng",
        category: "LANGUAGES",
        level: [9, 10, 11, 12],
        isActive: true,
        description: "English Language and Literature",
        color: "#FFEAA7"
      },
      {
        code: "HISTORY",
        name: "History",
        shortName: "Hist",
        category: "SOCIAL_SCIENCES",
        level: [9, 10, 11, 12],
        isActive: true,
        description: "World History",
        color: "#DDA0DD"
      }
    ];

    const subjects = [];
    for (const subjectInfo of subjectData) {
      const subj = await Subject.create(subjectInfo);
      subjects.push(subj);
      console.log(`Created subject: ${subj.name}`);
    }

    // 3. Create Teachers
    console.log("Creating teachers...");
    const teacherData = [
      {
        email: "jane.smith@teacher.local",
        password: "Teacher123!",
        name: "Jane Smith",
        subjectIds: [subjects[0]._id, subjects[1]._id], // Math and Physics
        phone: "9876543210",
        address: "456 Oak Avenue, City, State 12345",
        qualification: "M.Sc. Mathematics, B.Ed.",
        experience: 5,
        department: "MATHEMATICS"
      },
      {
        email: "mike.johnson@teacher.local",
        password: "Teacher123!",
        name: "Mike Johnson",
        subjectIds: [subjects[2]._id, subjects[3]._id], // Chemistry and Biology
        phone: "9876543211",
        address: "789 Pine Street, City, State 12345",
        qualification: "M.Sc. Chemistry, B.Ed.",
        experience: 7,
        department: "SCIENCE"
      },
      {
        email: "sarah.wilson@teacher.local",
        password: "Teacher123!",
        name: "Sarah Wilson",
        subjectIds: [subjects[4]._id, subjects[5]._id], // English and History
        phone: "9876543212",
        address: "321 Elm Street, City, State 12345",
        qualification: "M.A. English Literature, B.Ed.",
        experience: 4,
        department: "LANGUAGES"
      }
    ];

    const createdTeachers = [];
    for (const teacherInfo of teacherData) {
      const passwordHash = await bcrypt.hash(teacherInfo.password, 12);
      const user = await User.create({
        email: teacherInfo.email,
        passwordHash,
        name: teacherInfo.name,
        role: "TEACHER",
        isActive: true
      });

      const teacher = await Teacher.create({
        userId: user._id,
        subjectIds: teacherInfo.subjectIds,
        phone: teacherInfo.phone,
        address: teacherInfo.address,
        qualification: teacherInfo.qualification,
        experience: teacherInfo.experience,
        department: teacherInfo.department
      });

      createdTeachers.push(teacher);
      console.log(`Created teacher: ${teacherInfo.name}`);
    }

    // 4. Create Students
    console.log("Creating students...");
    const studentData = [
      {
        email: "john.doe@student.local",
        password: "Student123!",
        name: "John Doe",
        rollNumber: "10A001",
        classId: classes[0]._id, // 10A
        fatherName: "Robert Doe",
        motherName: "Jane Doe",
        dateOfBirth: "2005-03-15",
        parentsPhone: "9876543210",
        parentsEmail: "parents.doe@email.com",
        address: "123 Main Street, City, State 12345",
        whatsappNumber: "9876543210"
      },
      {
        email: "alice.brown@student.local",
        password: "Student123!",
        name: "Alice Brown",
        rollNumber: "10A002",
        classId: classes[0]._id, // 10A
        fatherName: "David Brown",
        motherName: "Mary Brown",
        dateOfBirth: "2005-07-22",
        parentsPhone: "9876543211",
        parentsEmail: "parents.brown@email.com",
        address: "456 Oak Avenue, City, State 12345",
        whatsappNumber: "9876543211"
      },
      {
        email: "bob.green@student.local",
        password: "Student123!",
        name: "Bob Green",
        rollNumber: "11A001",
        classId: classes[2]._id, // 11A
        fatherName: "Tom Green",
        motherName: "Lisa Green",
        dateOfBirth: "2004-11-08",
        parentsPhone: "9876543212",
        parentsEmail: "parents.green@email.com",
        address: "789 Pine Street, City, State 12345",
        whatsappNumber: "9876543212"
      },
      {
        email: "carol.white@student.local",
        password: "Student123!",
        name: "Carol White",
        rollNumber: "12A001",
        classId: classes[3]._id, // 12A
        fatherName: "Mark White",
        motherName: "Susan White",
        dateOfBirth: "2003-05-12",
        parentsPhone: "9876543213",
        parentsEmail: "parents.white@email.com",
        address: "321 Elm Street, City, State 12345",
        whatsappNumber: "9876543213"
      }
    ];

    const createdStudents = [];
    for (const studentInfo of studentData) {
      const passwordHash = await bcrypt.hash(studentInfo.password, 12);
      const user = await User.create({
        email: studentInfo.email,
        passwordHash,
        name: studentInfo.name,
        role: "STUDENT",
        isActive: true
      });

      const student = await Student.create({
        userId: user._id,
        rollNumber: studentInfo.rollNumber,
        classId: studentInfo.classId,
        fatherName: studentInfo.fatherName,
        motherName: studentInfo.motherName,
        dateOfBirth: studentInfo.dateOfBirth,
        parentsPhone: studentInfo.parentsPhone,
        parentsEmail: studentInfo.parentsEmail,
        address: studentInfo.address,
        whatsappNumber: studentInfo.whatsappNumber
      });

      createdStudents.push(student);
      console.log(`Created student: ${studentInfo.name} in class ${studentInfo.rollNumber.substring(0, 3)}`);
    }

    // 5. Summary
    console.log("\n=== SAMPLE DATA CREATED ===");
    console.log(`Classes: ${classes.length}`);
    console.log(`Subjects: ${subjects.length}`);
    console.log(`Teachers: ${createdTeachers.length}`);
    console.log(`Students: ${createdStudents.length}`);

    console.log("\n=== CLASS-SUBJECT MAPPING ===");
    for (const cls of classes) {
      const availableSubjects = subjects.filter(subj => subj.level.includes(cls.level));
      console.log(`${cls.name} (Level ${cls.level}): ${availableSubjects.map(s => s.shortName).join(', ')}`);
    }

    console.log("\n=== TEACHER-SUBJECT MAPPING ===");
    for (const teacher of createdTeachers) {
      const teacherSubjects = subjects.filter(subj => teacher.subjectIds.includes(subj._id));
      console.log(`${(teacher as any).name}: ${teacherSubjects.map(s => s.shortName).join(', ')}`);
    }

    console.log("\n✅ Sample data created successfully!");
    console.log("You can now test the API endpoints with this data.");

  } catch (error) {
    logger.error("Failed to create sample data", { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

run().catch(async (err) => {
  logger.error("Sample data seeding failed", { error: err.message, stack: err.stack });
  await mongoose.disconnect();
  process.exit(1);
});
