interface MigrationOptions {
    assignClassesBasedOnSubjects?: boolean;
    dryRun?: boolean;
}
declare function migrateTeachersWithClasses(options?: MigrationOptions): Promise<void>;
declare function runBasicMigration(): Promise<void>;
declare function runMigrationWithClasses(): Promise<void>;
declare function runDryRun(): Promise<void>;
export { migrateTeachersWithClasses, runBasicMigration, runMigrationWithClasses, runDryRun };
//# sourceMappingURL=migrateTeachersWithClasses.d.ts.map