import { Request, Response, NextFunction } from 'express';
import { eventService } from '../services/eventService.ts';
import { EventType } from '../constants/index.ts';

export class EventController {
  private getUserId(req: Request): string {
    return req.user?.userId || 'guest';
  }

  async getTimeline(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
      const eventType = (req.query.eventType || req.query.type) as EventType | undefined;
      const memberId = req.query.memberId as string | undefined;
      const branchId = req.query.branchId as string | undefined;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const era = req.query.era as string | undefined;
      const search = req.query.search as string | undefined;
      const view = req.query.view as any;

      const result = await eventService.getTimeline(familyId, userId, {
        page,
        limit,
        eventType,
        memberId,
        branchId,
        year,
        era,
        search,
        view,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async createEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const event = await eventService.createEvent(familyId, userId, req.body);
      res.status(201).json({
        success: true,
        data: event,
        message: 'Family milestone event created successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async getEventById(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, eventId } = req.params;
      const userId = this.getUserId(req);

      const event = await eventService.getEventById(familyId, eventId, userId);
      res.status(200).json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, eventId } = req.params;
      const userId = this.getUserId(req);

      const event = await eventService.updateEvent(familyId, eventId, userId, req.body);
      res.status(200).json({
        success: true,
        data: event,
        message: 'Family event updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId, eventId } = req.params;
      const userId = this.getUserId(req);

      const result = await eventService.deleteEvent(familyId, eventId, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Family event deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async getOnThisDay(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const events = await eventService.getOnThisDay(familyId, userId);
      res.status(200).json({
        success: true,
        data: events,
      });
    } catch (err) {
      next(err);
    }
  }

  async getUpcomingAnniversaries(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const anniversaries = await eventService.getUpcomingAnniversaries(familyId, userId);
      res.status(200).json({
        success: true,
        data: anniversaries,
      });
    } catch (err) {
      next(err);
    }
  }

  async getStoryChapters(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const chapters = await eventService.getFamilyStoryChapters(familyId, userId);
      res.status(200).json({
        success: true,
        data: chapters,
      });
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------
  // Milestone Endpoints (Phase 6)
  // -------------------------------------------------------------

  async getMilestones(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const timeframe = (req.query.timeframe as any) || 'all';
      const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;
      const eventType = (req.query.eventType || req.query.type) as string | undefined;
      const importance = req.query.importance as string | undefined;
      const memberId = req.query.memberId as string | undefined;
      const branchId = req.query.branchId as string | undefined;
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

      const result = await eventService.getMilestones(familyId, userId, {
        timeframe,
        month,
        year,
        eventType,
        importance,
        memberId,
        branchId,
        search,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result.milestones,
        grouped: result.grouped,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  }

  async createMilestone(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const milestone = await eventService.createEvent(familyId, userId, {
        ...req.body,
        isMilestone: req.body.isMilestone !== undefined ? req.body.isMilestone : true,
      });

      res.status(201).json({
        success: true,
        data: milestone,
        message: 'Family milestone created successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async getMilestoneById(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const milestoneId = req.params.milestoneId || req.params.id;
      const userId = this.getUserId(req);

      const milestone = await eventService.getMilestoneById(familyId, milestoneId, userId);
      res.status(200).json({
        success: true,
        data: milestone,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateMilestone(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const milestoneId = req.params.milestoneId || req.params.id;
      const userId = this.getUserId(req);

      const updated = await eventService.updateEvent(familyId, milestoneId, userId, req.body);
      res.status(200).json({
        success: true,
        data: updated,
        message: 'Milestone updated successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteMilestone(req: Request, res: Response, next: NextFunction) {
    try {
      const { familyId } = req.params;
      const milestoneId = req.params.milestoneId || req.params.id;
      const userId = this.getUserId(req);

      const result = await eventService.deleteEvent(familyId, milestoneId, userId);
      res.status(200).json({
        success: true,
        data: result,
        message: 'Milestone deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  async getTodayMilestones(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const result = await eventService.getTodayMilestones(familyId, userId);
      res.status(200).json({
        success: true,
        data: result.milestones,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  }

  async getUpcomingMilestones(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await eventService.getUpcomingMilestones(familyId, userId, limit);
      res.status(200).json({
        success: true,
        data: result.milestones,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  }

  async getMonthMilestones(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);
      const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
      const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

      const result = await eventService.getThisMonthMilestones(familyId, userId, month, year);
      res.status(200).json({
        success: true,
        data: result.milestones,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  }

  async getHistoricalAnniversaries(req: Request, res: Response, next: NextFunction) {
    try {
      const familyId = req.params.familyId;
      const userId = this.getUserId(req);

      const result = await eventService.getHistoricalAnniversaries(familyId, userId);
      res.status(200).json({
        success: true,
        data: result.milestones,
        summary: result.summary,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const eventController = new EventController();
