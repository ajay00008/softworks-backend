/**
 * Migration script to ensure data consistency between Class, Subject, Teacher, and Student models
 * This script will:
 * 1. Validate and fix any orphaned references
 * 2. Ensure all students have valid class references
 * 3. Ensure all teachers have valid subject references
 * 4. Clean up any invalid data
 */
declare function migrateDataConsistency(): Promise<void>;
export { migrateDataConsistency };
//# sourceMappingURL=migrateDataConsistency.d.ts.map