import mongoose, { Document, Model } from "mongoose";
export interface ITeacher extends Document {
    userId: mongoose.Types.ObjectId;
    adminId: mongoose.Types.ObjectId;
    subjectIds: mongoose.Types.ObjectId[];
    classIds: mongoose.Types.ObjectId[];
    phone?: string;
    address?: string;
    qualification?: string;
    experience?: string;
    department?: string;
}
export declare const Teacher: Model<ITeacher>;
//# sourceMappingURL=Teacher.d.ts.map