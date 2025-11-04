import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Teacher } from '../models/Teacher.js';
import { User } from '../models/User.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  adminId?: string;
  role?: string;
}

export class SocketService {
  private static io: SocketIOServer | null = null;
  private static userSocketMap: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private static adminSocketMap: Map<string, Set<string>> = new Map(); // adminId -> Set of socketIds

  /**
   * Initialize Socket.IO server
   */
  static initialize(httpServer: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io'
    });

    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token as string, env.JWT_SECRET) as any;
        
        socket.userId = decoded.sub;
        socket.role = decoded.role;

        // If user is a teacher, get their adminId
        if (decoded.role === 'TEACHER') {
          const teacher = await Teacher.findOne({ userId: decoded.sub });
          if (teacher) {
            socket.adminId = teacher.adminId.toString();
          }
        } else if (decoded.role === 'ADMIN') {
          // For admin, adminId is their own userId (admin notifications go to themselves)
          socket.adminId = decoded.sub; // Admin's own userId
        }

        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });

    logger.info('Socket.IO server initialized');
    return this.io;
  }

  /**
   * Handle new socket connection
   */
  private static handleConnection(socket: AuthenticatedSocket) {
    if (!socket.userId) {
      socket.disconnect();
      return;
    }

    console.log('[SOCKET] ✅ Sender: User connecting', {
      socketId: socket.id,
      userId: socket.userId,
      role: socket.role,
      adminId: socket.adminId,
      timestamp: new Date().toISOString()
    });

    // Add socket to user mapping
    if (!this.userSocketMap.has(socket.userId)) {
      this.userSocketMap.set(socket.userId, new Set());
    }
    this.userSocketMap.get(socket.userId)!.add(socket.id);

    // If user has adminId, add to admin mapping
    if (socket.adminId) {
      if (!this.adminSocketMap.has(socket.adminId)) {
        this.adminSocketMap.set(socket.adminId, new Set());
      }
      this.adminSocketMap.get(socket.adminId)!.add(socket.id);
    }

    // Join room for user-specific notifications (all users including admins)
    socket.join(`user:${socket.userId}`);
    console.log('[SOCKET] 📥 Receiver: User joined user room', {
      userId: socket.userId,
      room: `user:${socket.userId}`,
      role: socket.role,
      timestamp: new Date().toISOString()
    });
    
    // For teachers: join their admin's room (so they can receive admin notifications if needed)
    // For admins: adminId equals their userId, so they already have user room access
    if (socket.adminId && socket.role === 'TEACHER') {
      // Only teachers join their admin's room (admins don't need to join their own admin room)
      socket.join(`admin:${socket.adminId}`);
      console.log('[SOCKET] 📥 Receiver: Teacher joined admin room', {
        userId: socket.userId,
        role: socket.role,
        adminId: socket.adminId,
        room: `admin:${socket.adminId}`,
        timestamp: new Date().toISOString()
      });
    }

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('[SOCKET] ❌ Sender: User disconnecting', {
        socketId: socket.id,
        userId: socket.userId,
        role: socket.role,
        timestamp: new Date().toISOString()
      });
      
      // Remove from user mapping
      const userSockets = this.userSocketMap.get(socket.userId!);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          this.userSocketMap.delete(socket.userId!);
        }
      }

      // Remove from admin mapping
      if (socket.adminId) {
        const adminSockets = this.adminSocketMap.get(socket.adminId);
        if (adminSockets) {
          adminSockets.delete(socket.id);
          if (adminSockets.size === 0) {
            this.adminSocketMap.delete(socket.adminId);
          }
        }
      }
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  }

  /**
   * Send notification to a specific user
   * ONLY sends to user room, NOT admin room (to prevent teachers from receiving admin notifications)
   */
  static async sendNotificationToUser(userId: string, notification: any): Promise<boolean> {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }

    try {
      // Get all sockets in the user room to log who receives it
      const userRoom = this.io.sockets.adapter.rooms.get(`user:${userId}`);
      const recipientSockets = userRoom ? Array.from(userRoom) : [];
      
      console.log('[SOCKET] 📤 Sender: Sending notification to USER', {
        recipientUserId: userId,
        room: `user:${userId}`,
        notificationType: notification.type,
        notificationId: notification.id,
        recipientSocketCount: recipientSockets.length,
        recipientSocketIds: recipientSockets,
        timestamp: new Date().toISOString()
      });

      // Send ONLY to user room (NOT admin room to prevent teachers from receiving)
      this.io.to(`user:${userId}`).emit('notification', notification);
      
      return true;
    } catch (error) {
      logger.error('Error sending notification to user:', error);
      return false;
    }
  }

  /**
   * Send notification to admin (all sockets connected to that admin)
   * This sends to admin room, which includes both the admin and their teachers
   */
  static async sendNotificationToAdmin(adminId: string, notification: any): Promise<boolean> {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }

    try {
      // Get all sockets in the admin room to log who receives it
      const adminRoom = this.io.sockets.adapter.rooms.get(`admin:${adminId}`);
      const recipientSockets = adminRoom ? Array.from(adminRoom) : [];
      
      console.log('[SOCKET] 📤 Sender: Sending notification to ADMIN', {
        recipientAdminId: adminId,
        room: `admin:${adminId}`,
        notificationType: notification.type,
        notificationId: notification.id,
        recipientSocketCount: recipientSockets.length,
        recipientSocketIds: recipientSockets,
        timestamp: new Date().toISOString()
      });

      this.io.to(`admin:${adminId}`).emit('notification', notification);
      return true;
    } catch (error) {
      logger.error('Error sending notification to admin:', error);
      return false;
    }
  }

  /**
   * Send notification to teacher and their admin
   */
  static async sendNotificationToTeacherAndAdmin(teacherId: string, notification: any): Promise<boolean> {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }

    try {
      console.log('[SOCKET] 📤 Sender: Sending notification to TEACHER AND ADMIN', {
        teacherId,
        notificationType: notification.type,
        notificationId: notification.id,
        timestamp: new Date().toISOString()
      });

      // Send to teacher (user room only)
      await this.sendNotificationToUser(teacherId, notification);

      // Get teacher's adminId and send to admin
      const teacher = await Teacher.findOne({ userId: teacherId });
      if (teacher && teacher.adminId) {
        await this.sendNotificationToAdmin(teacher.adminId.toString(), {
          ...notification,
          metadata: {
            ...notification.metadata,
            teacherId,
            fromTeacher: true
          }
        });
      }

      return true;
    } catch (error) {
      logger.error('Error sending notification to teacher and admin:', error);
      return false;
    }
  }

  /**
   * Broadcast notification to all connected clients (for system-wide announcements)
   */
  static async broadcastNotification(notification: any): Promise<boolean> {
    if (!this.io) {
      logger.warn('Socket.IO not initialized');
      return false;
    }

    try {
      this.io.emit('notification', notification);
      logger.info(`Broadcast notification: ${notification.type}`);
      return true;
    } catch (error) {
      logger.error('Error broadcasting notification:', error);
      return false;
    }
  }

  /**
   * Get active connections count for a user
   */
  static getActiveConnections(userId: string): number {
    return this.userSocketMap.get(userId)?.size || 0;
  }

  /**
   * Get active connections count for an admin
   */
  static getAdminActiveConnections(adminId: string): number {
    return this.adminSocketMap.get(adminId)?.size || 0;
  }
}

