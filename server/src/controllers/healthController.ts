import { Request, Response } from 'express';
import { database } from '../config/database.ts';

export const getHealth = (req: Request, res: Response) => {
  const dbStatus = database.getStatus();

  // Exact expected format from prompt:
  // { "success": true, "message": "FamilyRoots API is running" }
  return res.status(200).json({
    success: true,
    message: 'FamilyRoots API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: {
      connected: dbStatus.isConnected,
      status: dbStatus.isConnected ? 'connected' : 'offline_fallback',
    },
  });
};
