import { Class } from "../models/Class";
import { Subject } from "../models/Subject";
import { Teacher } from "../models/Teacher";
import { Student } from "../models/Student";
/**
 * Get all subjects available for a specific class level
 */
export async function getSubjectsForClassLevel(level, adminId) {
    const subjects = await Subject.find({
        level: { $in: [level] },
        isActive: true,
        adminId
    }).select('code name shortName category level');
    return subjects.map(subject => ({
        id: subject._id.toString(),
        code: subject.code,
        name: subject.name,
        shortName: subject.shortName,
        category: subject.category,
        level: subject.level
    }));
}
/**
 * Get all classes with their available subjects for a specific admin
 */
export async function getAllClassSubjectMappings(adminId) {
    const classes = await Class.find({ isActive: true, adminId });
    const mappings = [];
    for (const classItem of classes) {
        const availableSubjects = await getSubjectsForClassLevel(classItem.level, adminId);
        mappings.push({
            classId: classItem._id.toString(),
            className: classItem.name,
            level: classItem.level,
            availableSubjects: availableSubjects.map(subject => ({
                id: subject.id,
                code: subject.code,
                name: subject.name,
                category: subject.category
            }))
        });
    }
    return mappings;
}
/**
 * Validate if a teacher can teach a specific class based on their subjects
 */
export async function canTeacherTeachClass(teacherId, classId) {
    const teacher = await Teacher.findById(teacherId).populate('subjectIds');
    const classItem = await Class.findById(classId);
    if (!teacher || !classItem) {
        return {
            canTeach: false,
            availableSubjects: [],
            missingSubjects: []
        };
    }
    const teacherSubjects = teacher.subjectIds.map((subject) => ({
        id: subject._id.toString(),
        code: subject.code,
        level: subject.level
    }));
    const classLevelSubjects = await getSubjectsForClassLevel(classItem.level);
    const availableSubjects = teacherSubjects
        .filter(ts => classLevelSubjects.some(cs => cs.id === ts.id))
        .map(ts => ts.code);
    const missingSubjects = classLevelSubjects
        .filter(cs => !teacherSubjects.some(ts => ts.id === cs.id))
        .map(cs => cs.code);
    return {
        canTeach: availableSubjects.length > 0,
        availableSubjects,
        missingSubjects
    };
}
/**
 * Get all teachers who can teach a specific class
 */
export async function getTeachersForClass(classId) {
    const classItem = await Class.findById(classId);
    if (!classItem)
        return [];
    const classLevelSubjects = await getSubjectsForClassLevel(classItem.level);
    const classSubjectIds = classLevelSubjects.map(s => s.id);
    const teachers = await Teacher.find({
        subjectIds: { $in: classSubjectIds }
    }).populate('userId', 'name email');
    const result = [];
    for (const teacher of teachers) {
        const teacherSubjects = teacher.subjectIds.map((subject) => ({
            id: subject._id.toString(),
            code: subject.code
        }));
        const availableSubjects = teacherSubjects
            .filter(ts => classSubjectIds.includes(ts.id))
            .map(ts => ts.code);
        if (availableSubjects.length > 0) {
            result.push({
                id: teacher.userId._id.toString(),
                name: teacher.userId.name,
                email: teacher.userId.email,
                availableSubjects,
                department: teacher.department
            });
        }
    }
    return result;
}
/**
 * Get all classes a teacher can teach (both assigned and compatible)
 */
export async function getClassesForTeacher(teacherId) {
    const teacher = await Teacher.findById(teacherId).populate('subjectIds').populate('classIds');
    if (!teacher)
        return [];
    const teacherSubjects = teacher.subjectIds.map((subject) => ({
        id: subject._id.toString(),
        code: subject.code,
        level: subject.level
    }));
    // Get assigned classes
    const assignedClasses = teacher.classIds.map((classItem) => ({
        id: classItem._id.toString(),
        name: classItem.name,
        displayName: classItem.displayName,
        level: classItem.level,
        section: classItem.section,
        isAssigned: true
    }));
    // Get all unique levels from teacher's subjects
    const teacherLevels = [...new Set(teacherSubjects.flatMap(ts => ts.level))];
    const compatibleClasses = await Class.find({
        level: { $in: teacherLevels },
        isActive: true
    });
    const result = [];
    // Add assigned classes first
    for (const assignedClass of assignedClasses) {
        const classLevelSubjects = await getSubjectsForClassLevel(assignedClass.level);
        const availableSubjects = teacherSubjects
            .filter(ts => classLevelSubjects.some(cs => cs.id === ts.id))
            .map(ts => ts.code);
        if (availableSubjects.length > 0) {
            result.push({
                ...assignedClass,
                availableSubjects
            });
        }
    }
    // Add compatible but not assigned classes
    for (const classItem of compatibleClasses) {
        // Skip if already assigned
        if (assignedClasses.some(ac => ac.id === classItem._id.toString())) {
            continue;
        }
        const classLevelSubjects = await getSubjectsForClassLevel(classItem.level);
        const availableSubjects = teacherSubjects
            .filter(ts => classLevelSubjects.some(cs => cs.id === ts.id))
            .map(ts => ts.code);
        if (availableSubjects.length > 0) {
            result.push({
                id: classItem._id.toString(),
                name: classItem.name,
                displayName: classItem.displayName,
                level: classItem.level,
                section: classItem.section,
                availableSubjects,
                isAssigned: false
            });
        }
    }
    return result;
}
/**
 * Get only assigned classes for a teacher
 */
export async function getAssignedClassesForTeacher(teacherId) {
    const teacher = await Teacher.findById(teacherId).populate('subjectIds').populate('classIds');
    if (!teacher)
        return [];
    const teacherSubjects = teacher.subjectIds.map((subject) => ({
        id: subject._id.toString(),
        code: subject.code,
        level: subject.level
    }));
    const result = [];
    for (const classItem of teacher.classIds) {
        const classLevelSubjects = await getSubjectsForClassLevel(classItem.level);
        const availableSubjects = teacherSubjects
            .filter(ts => classLevelSubjects.some(cs => cs.id === ts.id))
            .map(ts => ts.code);
        if (availableSubjects.length > 0) {
            result.push({
                id: classItem._id.toString(),
                name: classItem.name,
                displayName: classItem.displayName,
                level: classItem.level,
                section: classItem.section,
                availableSubjects
            });
        }
    }
    return result;
}
/**
 * Validate data consistency across all models
 */
export async function validateDataConsistency() {
    const issues = [];
    // Get statistics
    const statistics = {
        totalClasses: await Class.countDocuments(),
        totalSubjects: await Subject.countDocuments(),
        totalStudents: await Student.countDocuments(),
        totalTeachers: await Teacher.countDocuments(),
        studentsWithValidClasses: await Student.countDocuments({
            classId: { $exists: true, $ne: null }
        }),
        teachersWithSubjects: await Teacher.countDocuments({
            subjectIds: { $exists: true, $not: { $size: 0 } }
        })
    };
    // Check for students without classes
    const studentsWithoutClass = statistics.totalStudents - statistics.studentsWithValidClasses;
    if (studentsWithoutClass > 0) {
        issues.push(`${studentsWithoutClass} students are not assigned to any class`);
    }
    // Check for teachers without subjects
    const teachersWithoutSubjects = statistics.totalTeachers - statistics.teachersWithSubjects;
    if (teachersWithoutSubjects > 0) {
        issues.push(`${teachersWithoutSubjects} teachers are not assigned to any subjects`);
    }
    // Check for orphaned references
    const studentsWithInvalidClasses = await Student.find({
        classId: { $exists: true }
    }).populate('classId');
    const invalidStudentClasses = studentsWithInvalidClasses.filter(s => !s.classId);
    if (invalidStudentClasses.length > 0) {
        issues.push(`${invalidStudentClasses.length} students have invalid class references`);
    }
    return {
        isValid: issues.length === 0,
        issues,
        statistics
    };
}
//# sourceMappingURL=classSubjectValidator.js.map