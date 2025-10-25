import mongoose, { Document } from 'mongoose';
export interface ISamplePaper extends Document {
    title: string;
    description?: string;
    subjectId: mongoose.Types.ObjectId;
    adminId: mongoose.Types.ObjectId;
    uploadedBy: mongoose.Types.ObjectId;
    sampleFile: {
        fileName: string;
        filePath: string;
        fileSize: number;
        uploadedAt: Date;
        downloadUrl: string;
    };
    analysis: {
        totalQuestions: number;
        questionTypes: string[];
        markDistribution: {
            oneMark: number;
            twoMark: number;
            threeMark: number;
            fiveMark: number;
            totalMarks: number;
        };
        difficultyLevels: string[];
        bloomsDistribution: {
            remember: number;
            understand: number;
            apply: number;
            analyze: number;
            evaluate: number;
            create: number;
        };
        timeDistribution: {
            totalTime: number;
            perQuestion: number;
        };
        sections: Array<{
            name: string;
            questions: number;
            marks: number;
        }>;
        designPattern: {
            layout: string;
            formatting: string;
            questionNumbering: string;
            sectionHeaders: string[];
        };
    };
    templateSettings: {
        useAsTemplate: boolean;
        followDesign: boolean;
        maintainStructure: boolean;
        customInstructions?: string;
    };
    isActive: boolean;
    version: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<ISamplePaper, {}, {}, {}, mongoose.Document<unknown, {}, ISamplePaper, {}, {}> & ISamplePaper & Required<{
    _id: unknown;
}> & {
    __v: number;
}, any>;
export default _default;
//# sourceMappingURL=SamplePaper.d.ts.map