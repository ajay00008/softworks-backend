import mongoose, { Document, Model } from "mongoose";
export interface IStudent extends Document {
    userId: mongoose.Types.ObjectId;
    rollNumber: string;
    classId: mongoose.Types.ObjectId;
    fatherName?: string;
    motherName?: string;
    dateOfBirth?: string;
    parentsPhone?: string;
    parentsEmail?: string;
    address?: string;
    whatsappNumber?: string;
}
export declare const Student: Model<IStudent>;
//# sourceMappingURL=Student.d.ts.map