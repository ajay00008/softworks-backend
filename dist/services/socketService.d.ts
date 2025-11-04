import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
export declare class SocketService {
    private static io;
    private static userSocketMap;
    private static adminSocketMap;
    /**
     * Initialize Socket.IO server
     */
    static initialize(httpServer: HttpServer): SocketIOServer;
    /**
     * Handle new socket connection
     */
    private static handleConnection;
    /**
     * Send notification to a specific user
     */
    static sendNotificationToUser(userId: string, notification: any): Promise<boolean>;
    /**
     * Send notification to admin (all sockets connected to that admin)
     */
    static sendNotificationToAdmin(adminId: string, notification: any): Promise<boolean>;
    /**
     * Send notification to teacher and their admin
     */
    static sendNotificationToTeacherAndAdmin(teacherId: string, notification: any): Promise<boolean>;
    /**
     * Broadcast notification to all connected clients (for system-wide announcements)
     */
    static broadcastNotification(notification: any): Promise<boolean>;
    /**
     * Get active connections count for a user
     */
    static getActiveConnections(userId: string): number;
    /**
     * Get active connections count for an admin
     */
    static getAdminActiveConnections(adminId: string): number;
}
//# sourceMappingURL=socketService.d.ts.map