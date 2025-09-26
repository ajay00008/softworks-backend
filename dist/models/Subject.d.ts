import { Document, Model } from "mongoose";
export interface ISubject extends Document {
    code: string;
    name: string;
    shortName: string;
    category: string;
    level: number[];
    isActive: boolean;
    description?: string;
    color?: string;
}
export declare const Subject: Model<ISubject>;
//# sourceMappingURL=Subject.d.ts.map