import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { sqlDatabase } from '../db/sqlDatabase.ts';
import { Family } from '../models/Family.ts';
import { FamilyMember } from '../models/FamilyMember.ts';
import { FamilyMembership } from '../models/FamilyMembership.ts';
import { User } from '../models/User.ts';
import { Memory } from '../models/Memory.ts';
import { SecurityUtils } from '../utils/security.ts';
import { sendSuccess } from '../utils/apiResponse.ts';
import { ValidationError, ConflictError, NotFoundError } from '../utils/errors.ts';
import { Role, DEFAULT_ROLE_PERMISSIONS, UserStatus } from '../constants/index.ts';

export class SuperAdminController {
  /**
   * GET /api/super-admin/customers
   * Returns list of all customers and assigned family trees from SQL database with live stats.
   */
  async getCustomers(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customers = sqlDatabase.getAllCustomers();

      // Enrich with live MongoDB tree stats
      const enriched = await Promise.all(
        customers.map(async (cust) => {
          let memberCount = 0;
          let memoryCount = 0;
          try {
            if (cust.family_tree_id) {
              const [members, memories] = await Promise.all([
                FamilyMember.countDocuments({ familyId: cust.family_tree_id }).exec(),
                Memory.countDocuments({ familyId: cust.family_tree_id }).exec(),
              ]);
              memberCount = members;
              memoryCount = memories;
            }
          } catch {
            // Ignore stats error for resilient display
          }

          return {
            customer_id: cust.customer_id,
            customer_name: cust.customer_name,
            admin_email: cust.admin_email,
            viewer_login_code: cust.viewer_login_code,
            family_tree_name: cust.family_tree_name,
            family_tree_id: cust.family_tree_id,
            created_time: cust.created_time,
            member_count: memberCount,
            memory_count: memoryCount,
          };
        })
      );

      sendSuccess(res, enriched);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/super-admin/customers
   * Inserts record into SQL database, establishes a dedicated family tree,
   * and creates Admin and Shared Viewer accounts.
   */
  async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer_name = req.body.customer_name || req.body.customerName;
      const admin_email = req.body.admin_email || req.body.adminEmail;
      const admin_password = req.body.admin_password || req.body.adminPassword;
      const family_tree_name = req.body.family_tree_name || req.body.familyTreeName;
      const customer_id = req.body.customer_id || req.body.customerId;
      const viewer_login_code = req.body.viewer_login_code || req.body.viewerLoginCode;
      const viewer_password = req.body.viewer_password || req.body.viewerPassword;

      if (!customer_name || !customer_name.trim()) {
        throw new ValidationError('Customer Name (Admin) is required');
      }
      if (!admin_email || !admin_email.trim()) {
        throw new ValidationError('Admin Email is required');
      }
      if (!family_tree_name || !family_tree_name.trim()) {
        throw new ValidationError('Family Tree Name is required');
      }

      const cleanEmail = admin_email.toLowerCase().trim();
      const existing = sqlDatabase.getCustomerByEmail(cleanEmail);
      if (existing) {
        throw new ConflictError(`An admin account with email ${cleanEmail} already exists in the SQL database.`);
      }

      // Generate or validate customer_id
      const finalCustomerId = (customer_id && customer_id.trim()) || sqlDatabase.getNextCustomerId();
      const numMatch = finalCustomerId.match(/\d+/);
      const finalViewerCode = (viewer_login_code && viewer_login_code.trim()) ||
        `VIEW-${numMatch ? numMatch[0] : '1001'}`;

      const rawAdminPassword = (admin_password && admin_password.trim()) || 'AdminPassword#2026';
      const adminPasswordHash = await SecurityUtils.hashPassword(rawAdminPassword);

      // 1. Establish the dedicated family tree in the database
      const newFamily = await Family.create({
        name: family_tree_name.trim(),
        description: `Family tree established for ${customer_name.trim()}`,
        originPlace: '',
        motto: 'Heritage & Legacy',
        createdBy: (req as any).user?.userId || new Types.ObjectId(),
        settings: {
          defaultMemberVisibility: 'FAMILY',
          allowMemberInvitations: true,
          allowPublicProfiles: false,
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
        },
      });

      const familyTreeId = newFamily._id.toString();

      // 2. Create or sync Admin User in MongoDB
      let adminUser = await User.findOne({ email: cleanEmail });
      if (!adminUser) {
        adminUser = await User.create({
          email: cleanEmail,
          passwordHash: adminPasswordHash,
          displayName: customer_name.trim(),
          role: Role.ADMIN,
          familyTreeId,
          status: UserStatus.ACTIVE,
        });
      } else {
        adminUser.passwordHash = adminPasswordHash;
        adminUser.displayName = customer_name.trim();
        adminUser.role = Role.ADMIN;
        adminUser.familyTreeId = familyTreeId;
        await adminUser.save();
      }

      // Admin Membership
      const existingAdminMem = await FamilyMembership.findOne({
        userId: adminUser._id,
        familyId: newFamily._id,
      });
      if (!existingAdminMem) {
        await FamilyMembership.create({
          userId: adminUser._id,
          familyId: newFamily._id,
          role: Role.ADMIN,
          status: 'ACTIVE',
          permissions: DEFAULT_ROLE_PERMISSIONS[Role.ADMIN],
        });
      }

      // 3. Create or sync Shared Viewer account for this tree
      const viewerEmail = `${finalViewerCode.toLowerCase()}@familyroots.heritage`;
      const rawViewerPassword = (viewer_password && viewer_password.trim()) || 'FamilyRoots#2026';
      const viewerPasswordHash = await SecurityUtils.hashPassword(rawViewerPassword);
      let viewerUser = await User.findOne({ email: viewerEmail });
      if (!viewerUser) {
        viewerUser = await User.create({
          email: viewerEmail,
          passwordHash: viewerPasswordHash,
          displayName: `${family_tree_name.trim()} Viewer`,
          role: Role.VIEWER,
          familyTreeId,
          status: UserStatus.ACTIVE,
        });
      } else {
        viewerUser.passwordHash = viewerPasswordHash;
        viewerUser.role = Role.VIEWER;
        viewerUser.familyTreeId = familyTreeId;
        await viewerUser.save();
      }

      // Viewer Membership
      const existingViewerMem = await FamilyMembership.findOne({
        userId: viewerUser._id,
        familyId: newFamily._id,
      });
      if (!existingViewerMem) {
        await FamilyMembership.create({
          userId: viewerUser._id,
          familyId: newFamily._id,
          role: Role.VIEWER,
          status: 'ACTIVE',
          permissions: DEFAULT_ROLE_PERMISSIONS[Role.VIEWER],
        });
      }

      // 4. Save into SQLite SQL database
      const createdRecord = sqlDatabase.createCustomer({
        customer_id: finalCustomerId,
        customer_name: customer_name.trim(),
        admin_email: cleanEmail,
        admin_password_hash: adminPasswordHash,
        viewer_login_code: finalViewerCode,
        viewer_password_hash: viewerPasswordHash,
        family_tree_name: family_tree_name.trim(),
        family_tree_id: familyTreeId,
      });

      sendSuccess(
        res,
        {
          ...createdRecord,
          member_count: 0,
          memory_count: 0,
        },
        'Customer record and family tree initialized successfully in SQL database',
        201
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/super-admin/customers/:customerId
   */
  async deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { customerId } = req.params;
      const existing = sqlDatabase.getCustomerById(customerId);
      if (!existing) {
        throw new NotFoundError(`Customer with ID ${customerId} not found`);
      }

      const deleted = sqlDatabase.deleteCustomer(customerId);
      if (!deleted) {
        throw new NotFoundError('Failed to delete customer from SQL database');
      }

      sendSuccess(res, { customer_id: customerId }, 'Customer deleted from SQL database successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/super-admin/stats
   */
  async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customers = sqlDatabase.getAllCustomers();
      const totalTrees = await Family.countDocuments().exec();
      const totalMembers = await FamilyMember.countDocuments().exec();
      const totalUsers = await User.countDocuments().exec();

      sendSuccess(res, {
        totalCustomers: customers.length,
        totalTrees,
        totalMembers,
        totalUsers,
        databaseType: 'SQLite (better-sqlite3)',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/super-admin/account
   */
  async getAccount(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const creds = sqlDatabase.getSuperAdminCredentials();
      sendSuccess(res, {
        email: creds.email,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/super-admin/account
   */
  async updateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const email = req.body.email || req.body.adminEmail;
      const password = req.body.password || req.body.adminPassword;

      if (!email || !email.trim()) {
        throw new ValidationError('Super Admin email is required');
      }

      const { authService } = await import('../services/authService.ts');
      const updated = await authService.updateSuperAdminAccount({
        email: email.trim(),
        password: password ? password.trim() : undefined,
      });

      sendSuccess(res, updated, 'Super Admin credentials updated successfully in SQL database');
    } catch (err) {
      next(err);
    }
  }
}

export const superAdminController = new SuperAdminController();
