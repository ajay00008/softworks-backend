import { Document, Model } from "mongoose";
export interface IClass extends Document {
    name: string;
    displayName: string;
    level: number;
    section: string;
    academicYear: string;
    isActive: boolean;
    description?: string;
}
export declare const Class: Model<IClass>;
//# sourceMappingURL=Class.d.ts.map