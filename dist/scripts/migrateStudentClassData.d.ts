/**
 * Migration script to update existing student data from className to classId
 * This script will:
 * 1. Find students with className field (old format)
 * 2. Match className to existing Class records
 * 3. Update students to use classId instead
 * 4. Handle cases where class doesn't exist
 */
declare function migrateStudentClassData(): Promise<void>;
declare function createMissingClasses(): Promise<void>;
export { migrateStudentClassData, createMissingClasses };
//# sourceMappingURL=migrateStudentClassData.d.ts.map