import mongoose, { Document, Model } from "mongoose";
export interface ISubject extends Document {
    code: string;
    name: string;
    shortName: string;
    category: string;
    adminId: mongoose.Types.ObjectId;
    classIds: mongoose.Types.ObjectId[];
    isActive: boolean;
    description?: string;
    color?: string;
    referenceBook?: {
        fileName: string;
        originalName: string;
        filePath: string;
        fileSize: number;
        uploadedAt: Date;
        uploadedBy: mongoose.Types.ObjectId;
    };
}
export declare const Subject: Model<ISubject>;
//# sourceMappingURL=Subject.d.ts.map