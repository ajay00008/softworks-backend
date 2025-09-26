import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import createHttpError from "http-errors";
import { Absenteeism } from "../models/Absenteeism";
import { Exam } from "../models/Exam";
import { Student } from "../models/Student";
import { Result } from "../models/Result";

const CreateAbsenteeismSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  type: z.enum(["ABSENT", "MISSING_SHEET", "LATE_SUBMISSION"]),
  reason: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM")
});

const UpdateAbsenteeismSchema = z.object({
  status: z.enum(["PENDING", "ACKNOWLEDGED", "RESOLVED", "ESCALATED"]).optional(),
  adminRemarks: z.string().optional(),
  escalatedTo: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional()
});

const GetAbsenteeismQuerySchema = z.object({
  page: z.union([z.string(), z.number()]).transform(Number).default(1),
  limit: z.union([z.string(), z.number()]).transform(Number).default(10),
  search: z.string().optional(),
  examId: z.string().optional(),
  studentId: z.string().optional(),
  type: z.enum(["ABSENT", "MISSING_SHEET", "LATE_SUBMISSION"]).optional(),
  status: z.enum(["PENDING", "ACKNOWLEDGED", "RESOLVED", "ESCALATED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  reportedBy: z.string().optional(),
  acknowledgedBy: z.string().optional(),
  isActive: z.string().transform(Boolean).optional()
});

// Report Absenteeism
export async function reportAbsenteeism(req: Request, res: Response, next: NextFunction) {
  try {
    const absenteeismData = CreateAbsenteeismSchema.parse(req.body);
    const userId = (req as any).user.id;
    
    // Validate exam and student exist
    const [exam, student] = await Promise.all([
      Exam.findById(absenteeismData.examId),
      Student.findOne({ userId: absenteeismData.studentId })
    ]);
    
    if (!exam) throw new createHttpError.NotFound("Exam not found");
    if (!student) throw new createHttpError.NotFound("Student not found");
    
    // Check if absenteeism already reported for this exam and student
    const existingAbsenteeism = await Absenteeism.findOne({
      examId: absenteeismData.examId,
      studentId: absenteeismData.studentId,
      isActive: true
    });
    
    if (existingAbsenteeism) {
      throw new createHttpError.Conflict("Absenteeism already reported for this exam and student");
    }
    
    const absenteeism = await Absenteeism.create({
      ...absenteeismData,
      reportedBy: userId
    });
    
    // Update result status if needed
    if (absenteeismData.type === "ABSENT") {
      await Result.findOneAndUpdate(
        { examId: absenteeismData.examId, studentId: absenteeismData.studentId },
        { 
          isAbsent: true,
          submissionStatus: "ABSENT",
          absentReason: absenteeismData.reason
        }
      );
    } else if (absenteeismData.type === "MISSING_SHEET") {
      await Result.findOneAndUpdate(
        { examId: absenteeismData.examId, studentId: absenteeismData.studentId },
        { 
          isMissingSheet: true,
          submissionStatus: "MISSING_SHEET",
          missingSheetReason: absenteeismData.reason
        }
      );
    }
    
    const populatedAbsenteeism = await Absenteeism.findById(absenteeism._id)
      .populate('examId', 'title examType scheduledDate')
      .populate('studentId', 'name email')
      .populate('reportedBy', 'name email')
      .populate('acknowledgedBy', 'name email')
      .populate('escalatedTo', 'name email');
    
    res.status(201).json({
      success: true,
      absenteeism: populatedAbsenteeism,
      message: "Absenteeism reported successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Get All Absenteeism Reports
export async function getAbsenteeismReports(req: Request, res: Response, next: NextFunction) {
  try {
    const queryParams = GetAbsenteeismQuerySchema.parse(req.query);
    const { page, limit, search, examId, studentId, type, status, priority, reportedBy, acknowledgedBy, isActive } = queryParams;
    
    const query: any = {};
    
    if (examId) query.examId = examId;
    if (studentId) query.studentId = studentId;
    if (type) query.type = type;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (reportedBy) query.reportedBy = reportedBy;
    if (acknowledgedBy) query.acknowledgedBy = acknowledgedBy;
    if (isActive !== undefined) query.isActive = isActive;
    
    if (search) {
      query.$or = [
        { reason: { $regex: search, $options: "i" } },
        { adminRemarks: { $regex: search, $options: "i" } }
      ];
    }
    
    const skip = (page - 1) * limit;
    
    const [absenteeismReports, total] = await Promise.all([
      Absenteeism.find(query)
        .populate('examId', 'title examType scheduledDate')
        .populate('studentId', 'name email')
        .populate('reportedBy', 'name email')
        .populate('acknowledgedBy', 'name email')
        .populate('escalatedTo', 'name email')
        .sort({ priority: 1, reportedAt: -1 })
        .skip(skip)
        .limit(limit),
      Absenteeism.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: absenteeismReports,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get Single Absenteeism Report
export async function getAbsenteeismReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const absenteeism = await Absenteeism.findById(id)
      .populate('examId', 'title examType scheduledDate')
      .populate('studentId', 'name email')
      .populate('reportedBy', 'name email')
      .populate('acknowledgedBy', 'name email')
      .populate('escalatedTo', 'name email');
    
    if (!absenteeism) throw new createHttpError.NotFound("Absenteeism report not found");
    
    res.json({
      success: true,
      absenteeism
    });
  } catch (err) {
    next(err);
  }
}

// Acknowledge Absenteeism (Admin only)
export async function acknowledgeAbsenteeism(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;
    const userId = (req as any).user.id;
    
    const absenteeism = await Absenteeism.findById(id);
    if (!absenteeism) throw new createHttpError.NotFound("Absenteeism report not found");
    
    if (absenteeism.status !== "PENDING") {
      throw new createHttpError.BadRequest("Absenteeism report is not in pending status");
    }
    
    const updatedAbsenteeism = await Absenteeism.findByIdAndUpdate(
      id,
      {
        status: "ACKNOWLEDGED",
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        adminRemarks
      },
      { new: true }
    ).populate('examId', 'title examType scheduledDate')
     .populate('studentId', 'name email')
     .populate('reportedBy', 'name email')
     .populate('acknowledgedBy', 'name email')
     .populate('escalatedTo', 'name email');
    
    res.json({
      success: true,
      absenteeism: updatedAbsenteeism,
      message: "Absenteeism acknowledged successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Resolve Absenteeism
export async function resolveAbsenteeism(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { adminRemarks } = req.body;
    const userId = (req as any).user.id;
    
    const absenteeism = await Absenteeism.findById(id);
    if (!absenteeism) throw new createHttpError.NotFound("Absenteeism report not found");
    
    if (absenteeism.status === "RESOLVED") {
      throw new createHttpError.BadRequest("Absenteeism report is already resolved");
    }
    
    const updatedAbsenteeism = await Absenteeism.findByIdAndUpdate(
      id,
      {
        status: "RESOLVED",
        resolvedAt: new Date(),
        adminRemarks: adminRemarks || absenteeism.adminRemarks
      },
      { new: true }
    ).populate('examId', 'title examType scheduledDate')
     .populate('studentId', 'name email')
     .populate('reportedBy', 'name email')
     .populate('acknowledgedBy', 'name email')
     .populate('escalatedTo', 'name email');
    
    res.json({
      success: true,
      absenteeism: updatedAbsenteeism,
      message: "Absenteeism resolved successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Escalate Absenteeism
export async function escalateAbsenteeism(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { escalatedTo, adminRemarks } = req.body;
    const userId = (req as any).user.id;
    
    const absenteeism = await Absenteeism.findById(id);
    if (!absenteeism) throw new createHttpError.NotFound("Absenteeism report not found");
    
    if (absenteeism.status === "RESOLVED") {
      throw new createHttpError.BadRequest("Cannot escalate resolved absenteeism report");
    }
    
    const updatedAbsenteeism = await Absenteeism.findByIdAndUpdate(
      id,
      {
        status: "ESCALATED",
        escalatedTo,
        escalatedAt: new Date(),
        adminRemarks: adminRemarks || absenteeism.adminRemarks
      },
      { new: true }
    ).populate('examId', 'title examType scheduledDate')
     .populate('studentId', 'name email')
     .populate('reportedBy', 'name email')
     .populate('acknowledgedBy', 'name email')
     .populate('escalatedTo', 'name email');
    
    res.json({
      success: true,
      absenteeism: updatedAbsenteeism,
      message: "Absenteeism escalated successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Update Absenteeism
export async function updateAbsenteeism(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const updateData = UpdateAbsenteeismSchema.parse(req.body);
    
    const absenteeism = await Absenteeism.findById(id);
    if (!absenteeism) throw new createHttpError.NotFound("Absenteeism report not found");
    
    const updatedAbsenteeism = await Absenteeism.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('examId', 'title examType scheduledDate')
     .populate('studentId', 'name email')
     .populate('reportedBy', 'name email')
     .populate('acknowledgedBy', 'name email')
     .populate('escalatedTo', 'name email');
    
    res.json({
      success: true,
      absenteeism: updatedAbsenteeism
    });
  } catch (err) {
    next(err);
  }
}

// Delete Absenteeism
export async function deleteAbsenteeism(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    
    const absenteeism = await Absenteeism.findById(id);
    if (!absenteeism) throw new createHttpError.NotFound("Absenteeism report not found");
    
    await Absenteeism.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: "Absenteeism report deleted successfully"
    });
  } catch (err) {
    next(err);
  }
}

// Get Absenteeism Statistics
export async function getAbsenteeismStatistics(req: Request, res: Response, next: NextFunction) {
  try {
    const { examId, startDate, endDate } = req.query;
    
    const matchQuery: any = { isActive: true };
    if (examId) matchQuery.examId = examId;
    if (startDate) matchQuery.reportedAt = { $gte: new Date(startDate as string) };
    if (endDate) matchQuery.reportedAt = { ...matchQuery.reportedAt, $lte: new Date(endDate as string) };
    
    const stats = await Absenteeism.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          byType: {
            $push: "$type"
          },
          byStatus: {
            $push: "$status"
          },
          byPriority: {
            $push: "$priority"
          },
          pendingReports: {
            $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] }
          },
          acknowledgedReports: {
            $sum: { $cond: [{ $eq: ["$status", "ACKNOWLEDGED"] }, 1, 0] }
          },
          resolvedReports: {
            $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] }
          },
          escalatedReports: {
            $sum: { $cond: [{ $eq: ["$status", "ESCALATED"] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          totalReports: 1,
          pendingReports: 1,
          acknowledgedReports: 1,
          resolvedReports: 1,
          escalatedReports: 1,
          typeDistribution: {
            $reduce: {
              input: "$byType",
              initialValue: { ABSENT: 0, MISSING_SHEET: 0, LATE_SUBMISSION: 0 },
              in: {
                $mergeObjects: [
                  "$$value",
                  {
                    $arrayToObject: [
                      [{
                        k: "$$this",
                        v: {
                          $add: [
                            { $ifNull: [{ $getField: { field: "$$this", input: "$$value" } }, 0] },
                            1
                          ]
                        }
                      }]
                    ]
                  }
                ]
              }
            }
          },
          statusDistribution: {
            $reduce: {
              input: "$byStatus",
              initialValue: { PENDING: 0, ACKNOWLEDGED: 0, RESOLVED: 0, ESCALATED: 0 },
              in: {
                $mergeObjects: [
                  "$$value",
                  {
                    $arrayToObject: [
                      [{
                        k: "$$this",
                        v: {
                          $add: [
                            { $ifNull: [{ $getField: { field: "$$this", input: "$$value" } }, 0] },
                            1
                          ]
                        }
                      }]
                    ]
                  }
                ]
              }
            }
          },
          priorityDistribution: {
            $reduce: {
              input: "$byPriority",
              initialValue: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 },
              in: {
                $mergeObjects: [
                  "$$value",
                  {
                    $arrayToObject: [
                      [{
                        k: "$$this",
                        v: {
                          $add: [
                            { $ifNull: [{ $getField: { field: "$$this", input: "$$value" } }, 0] },
                            1
                          ]
                        }
                      }]
                    ]
                  }
                ]
              }
            }
          }
        }
      }
    ]);
    
    res.json({
      success: true,
      statistics: stats[0] || {
        totalReports: 0,
        pendingReports: 0,
        acknowledgedReports: 0,
        resolvedReports: 0,
        escalatedReports: 0,
        typeDistribution: { ABSENT: 0, MISSING_SHEET: 0, LATE_SUBMISSION: 0 },
        statusDistribution: { PENDING: 0, ACKNOWLEDGED: 0, RESOLVED: 0, ESCALATED: 0 },
        priorityDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 }
      }
    });
  } catch (err) {
    next(err);
  }
}
