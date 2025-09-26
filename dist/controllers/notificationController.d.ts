import type { Request, Response } from 'express';
export declare const getNotifications: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const markAsRead: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const acknowledgeNotification: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const dismissNotification: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createNotification: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getNotificationCounts: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const markAllAsRead: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteNotification: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getNotificationsByType: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=notificationController.d.ts.map