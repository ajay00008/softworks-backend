export interface ExamContextData {
    exam: any;
    accessibleClasses: any[];
    accessibleSubjects: any[];
    students: any[];
    evaluationSettings?: any;
    teacherAccess: {
        canUpload: boolean;
        canEvaluate: boolean;
        canViewResults: boolean;
    };
}
export declare class ExamContextService {
    /**
     * Get comprehensive exam context data for a teacher
     */
    static getExamContext(examId: string, teacherId: string): Promise<ExamContextData>;
    /**
     * Get exams accessible to a teacher with context data
     */
    static getTeacherExamsWithContext(teacherId: string): Promise<any[]>;
    /**
     * Validate teacher access to specific exam operations
     */
    static validateTeacherAccess(examId: string, teacherId: string, operation: 'upload' | 'evaluate' | 'view'): Promise<boolean>;
}
//# sourceMappingURL=examContextService.d.ts.map