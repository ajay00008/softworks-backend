import type { Request, Response } from 'express';
import { StaffAccess } from '../models/StaffAccess';
import { User } from '../models/User';
import { Class } from '../models/Class';
import { Subject } from '../models/Subject';
import { logger } from '../utils/logger';

// Create staff access
export const createStaffAccess = async (req: Request, res: Response) => {
  try {
    const { staffId, classAccess, subjectAccess, globalPermissions, expiresAt, notes } = req.body;
    const assignedBy = (req as any).auth?.sub;

    if (!assignedBy) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify staff exists and is a teacher
    const staff = await User.findById(staffId);
    if (!staff || staff.role !== 'TEACHER') {
      return res.status(400).json({ success: false, error: 'Invalid staff member' });
    }

    // Verify classes exist
    for (const classAccessItem of classAccess) {
      const classExists = await Class.findById(classAccessItem.classId);
      if (!classExists) {
        return res.status(400).json({ success: false, error: `Class ${classAccessItem.classId} not found` });
      }
    }

    // Verify subjects exist
    for (const subjectAccessItem of subjectAccess) {
      const subjectExists = await Subject.findById(subjectAccessItem.subjectId);
      if (!subjectExists) {
        return res.status(400).json({ success: false, error: `Subject ${subjectAccessItem.subjectId} not found` });
      }
    }

    // Check if access already exists
    const existingAccess = await StaffAccess.findOne({ staffId, isActive: true });
    if (existingAccess) {
      return res.status(400).json({ success: false, error: 'Staff access already exists' });
    }

    const staffAccess = new StaffAccess({
      staffId,
      assignedBy,
      classAccess,
      subjectAccess,
      globalPermissions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      notes
    });

    await staffAccess.save();

    logger.info(`Staff access created: ${staffAccess._id} for staff ${staffId} by ${assignedBy}`);

    res.status(201).json({
      success: true,
      data: staffAccess
    });
  } catch (error) {
    logger.error('Error creating staff access:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get staff access by staff ID
export const getStaffAccess = async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const staffAccess = await StaffAccess.findOne({ staffId, isActive: true })
      .populate('staffId', 'name email role')
      .populate('assignedBy', 'name email')
      .populate('classAccess.classId', 'name')
      .populate('subjectAccess.subjectId', 'name code');

    if (!staffAccess) {
      return res.status(404).json({ success: false, error: 'Staff access not found' });
    }

    res.json({
      success: true,
      data: staffAccess
    });
  } catch (error) {
    logger.error('Error fetching staff access:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Update staff access
export const updateStaffAccess = async (req: Request, res: Response) => {
  try {
    const { staffAccessId } = req.params;
    const { classAccess, subjectAccess, globalPermissions, expiresAt, notes } = req.body;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const staffAccess = await StaffAccess.findById(staffAccessId);
    if (!staffAccess) {
      return res.status(404).json({ success: false, error: 'Staff access not found' });
    }

    // Verify classes exist
    if (classAccess) {
      for (const classAccessItem of classAccess) {
        const classExists = await Class.findById(classAccessItem.classId);
        if (!classExists) {
          return res.status(400).json({ success: false, error: `Class ${classAccessItem.classId} not found` });
        }
      }
    }

    // Verify subjects exist
    if (subjectAccess) {
      for (const subjectAccessItem of subjectAccess) {
        const subjectExists = await Subject.findById(subjectAccessItem.subjectId);
        if (!subjectExists) {
          return res.status(400).json({ success: false, error: `Subject ${subjectAccessItem.subjectId} not found` });
        }
      }
    }

    if (classAccess) staffAccess.classAccess = classAccess;
    if (subjectAccess) staffAccess.subjectAccess = subjectAccess;
    if (globalPermissions) staffAccess.globalPermissions = globalPermissions;
    if (expiresAt !== undefined) staffAccess.expiresAt = expiresAt ? new Date(expiresAt) : undefined;
    if (notes !== undefined) staffAccess.notes = notes;

    await staffAccess.save();

    logger.info(`Staff access updated: ${staffAccessId} by ${userId}`);

    res.json({
      success: true,
      data: staffAccess
    });
  } catch (error) {
    logger.error('Error updating staff access:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get all staff access records
export const getAllStaffAccess = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const query: any = { isActive: true };

    if (search) {
      query.$or = [
        { 'staffId': { $regex: search, $options: 'i' } },
        { 'notes': { $regex: search, $options: 'i' } }
      ];
    }

    const staffAccessList = await StaffAccess.find(query)
      .populate('staffId', 'name email role')
      .populate('assignedBy', 'name email')
      .populate('classAccess.classId', 'name')
      .populate('subjectAccess.subjectId', 'name code')
      .sort({ createdAt: -1 })
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit));

    const total = await StaffAccess.countDocuments(query);

    res.json({
      success: true,
      data: staffAccessList,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching all staff access:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Deactivate staff access
export const deactivateStaffAccess = async (req: Request, res: Response) => {
  try {
    const { staffAccessId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const staffAccess = await StaffAccess.findById(staffAccessId);
    if (!staffAccess) {
      return res.status(404).json({ success: false, error: 'Staff access not found' });
    }

    staffAccess.isActive = false;
    await staffAccess.save();

    logger.info(`Staff access deactivated: ${staffAccessId} by ${userId}`);

    res.json({
      success: true,
      data: { message: 'Staff access deactivated successfully' }
    });
  } catch (error) {
    logger.error('Error deactivating staff access:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Check if staff has access to specific class
export const checkClassAccess = async (req: Request, res: Response) => {
  try {
    const { classId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      'classAccess.classId': classId,
      isActive: true
    });

    if (!staffAccess) {
      return res.json({
        success: true,
        data: { hasAccess: false }
      });
    }

    const classAccess = staffAccess.classAccess.find(ca => ca.classId.toString() === classId);

    res.json({
      success: true,
      data: {
        hasAccess: true,
        accessLevel: classAccess?.accessLevel,
        canUploadSheets: classAccess?.canUploadSheets,
        canMarkAbsent: classAccess?.canMarkAbsent,
        canMarkMissing: classAccess?.canMarkMissing,
        canOverrideAI: classAccess?.canOverrideAI
      }
    });
  } catch (error) {
    logger.error('Error checking class access:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Check if staff has access to specific subject
export const checkSubjectAccess = async (req: Request, res: Response) => {
  try {
    const { subjectId } = req.params;
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      'subjectAccess.subjectId': subjectId,
      isActive: true
    });

    if (!staffAccess) {
      return res.json({
        success: true,
        data: { hasAccess: false }
      });
    }

    const subjectAccess = staffAccess.subjectAccess.find(sa => sa.subjectId.toString() === subjectId);

    res.json({
      success: true,
      data: {
        hasAccess: true,
        accessLevel: subjectAccess?.accessLevel,
        canCreateQuestions: subjectAccess?.canCreateQuestions,
        canUploadSyllabus: subjectAccess?.canUploadSyllabus
      }
    });
  } catch (error) {
    logger.error('Error checking subject access:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get staff's accessible classes
export const getStaffClasses = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      isActive: true
    }).populate('classAccess.classId', 'name');

    if (!staffAccess) {
      return res.json({
        success: true,
        data: []
      });
    }

    res.json({
      success: true,
      data: staffAccess.classAccess
    });
  } catch (error) {
    logger.error('Error fetching staff classes:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Get staff's accessible subjects
export const getStaffSubjects = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth?.sub;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const staffAccess = await StaffAccess.findOne({
      staffId: userId,
      isActive: true
    }).populate('subjectAccess.subjectId', 'name code');

    if (!staffAccess) {
      return res.json({
        success: true,
        data: []
      });
    }

    res.json({
      success: true,
      data: staffAccess.subjectAccess
    });
  } catch (error) {
    logger.error('Error fetching staff subjects:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
