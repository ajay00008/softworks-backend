/**
 * Utility functions for validating class-subject consistency
 */
export interface ClassSubjectMapping {
    classId: string;
    className: string;
    level: number;
    availableSubjects: Array<{
        id: string;
        code: string;
        name: string;
        category: string;
    }>;
}
/**
 * Get all subjects available for a specific class level
 */
export declare function getSubjectsForClassLevel(level: number, adminId: string): Promise<Array<{
    id: string;
    code: string;
    name: string;
    shortName: string;
    category: string;
    level: number[];
}>>;
/**
 * Get all classes with their available subjects for a specific admin
 */
export declare function getAllClassSubjectMappings(adminId: string): Promise<ClassSubjectMapping[]>;
/**
 * Validate if a teacher can teach a specific class based on their subjects
 */
export declare function canTeacherTeachClass(teacherId: string, classId: string): Promise<{
    canTeach: boolean;
    availableSubjects: string[];
    missingSubjects: string[];
}>;
/**
 * Get all teachers who can teach a specific class
 */
export declare function getTeachersForClass(classId: string): Promise<Array<{
    id: string;
    name: string;
    email: string;
    availableSubjects: string[];
    department?: string | undefined;
}>>;
/**
 * Get all classes a teacher can teach (both assigned and compatible)
 */
export declare function getClassesForTeacher(teacherId: string): Promise<Array<{
    id: string;
    name: string;
    displayName: string;
    level: number;
    section: string;
    availableSubjects: string[];
    isAssigned: boolean;
}>>;
/**
 * Get only assigned classes for a teacher
 */
export declare function getAssignedClassesForTeacher(teacherId: string): Promise<Array<{
    id: string;
    name: string;
    displayName: string;
    level: number;
    section: string;
    availableSubjects: string[];
}>>;
/**
 * Validate data consistency across all models
 */
export declare function validateDataConsistency(): Promise<{
    isValid: boolean;
    issues: string[];
    statistics: {
        totalClasses: number;
        totalSubjects: number;
        totalStudents: number;
        totalTeachers: number;
        studentsWithValidClasses: number;
        teachersWithSubjects: number;
    };
}>;
//# sourceMappingURL=classSubjectValidator.d.ts.map