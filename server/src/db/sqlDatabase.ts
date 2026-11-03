import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.ts';

export interface CustomerFamilyTreeRecord {
  customer_id: string;
  customer_name: string;
  customer_email: string;
  admin_code: string;
  admin_email: string;
  admin_password_hash: string;
  viewer_login_code: string;
  viewer_password_hash?: string;
  family_tree_name: string;
  family_tree_id: string;
  created_time: string;
}

class SqlDatabase {
  private static instance: SqlDatabase;
  private db: Database.Database | null = null;
  private dbPath: string;

  private constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        logger.warn({ err }, 'Failed to create data directory for sqlite');
      }
    }
    this.dbPath = path.join(dataDir, 'superadmin.sqlite');
    this.initialize();
  }

  public static getInstance(): SqlDatabase {
    if (!SqlDatabase.instance) {
      SqlDatabase.instance = new SqlDatabase();
    }
    return SqlDatabase.instance;
  }

  private initialize(): void {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');

      // Create customers_family_trees table with customer_email and admin_code
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS customers_family_trees (
          customer_id TEXT PRIMARY KEY,
          customer_name TEXT NOT NULL,
          customer_email TEXT NOT NULL DEFAULT '',
          admin_code TEXT NOT NULL DEFAULT '',
          admin_email TEXT NOT NULL,
          admin_password_hash TEXT NOT NULL,
          viewer_login_code TEXT NOT NULL,
          viewer_password_hash TEXT NOT NULL DEFAULT '',
          family_tree_name TEXT NOT NULL,
          family_tree_id TEXT NOT NULL,
          created_time DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS super_admin_credentials (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Initialize default Master Admin credentials if not present, and update existing default hash if needed
      try {
        const defaultMasterHash = '$2b$10$beUfGIBwaGnJVOTtZCGkbuxwhl/n5xh2/dXayqpKGhY47/KpW9ZtC'; // Hash for MasterAdmin@2026
        const existingSuper = this.db.prepare('SELECT * FROM super_admin_credentials WHERE id = 1').get() as { id: number; email: string; password_hash: string } | undefined;
        if (!existingSuper) {
          this.db.prepare(
            'INSERT INTO super_admin_credentials (id, email, password_hash) VALUES (1, ?, ?)'
          ).run('superadmin@familyroots.heritage', defaultMasterHash);
          logger.info('Initialized default Master Admin credentials (MasterAdmin@2026) in SQL database');
        } else {
          // If the password hash is still the old SuperAdmin#2026 hash or empty, update to MasterAdmin@2026 default
          const isOldDefault =
            existingSuper.password_hash === '$2a$10$wE0vj1N2u1zYF8bI7k8PneOqP9cKpKj9Nkmw4L2fM/gHqZ.eU1Sia' ||
            existingSuper.password_hash === '$2b$12$.L0Z3YBj2mHWG8w8s9slJO9UTyDwGALuaAa3q7FkafuTwU7d6eorm' ||
            !existingSuper.password_hash ||
            bcrypt.compareSync('SuperAdmin#2026', existingSuper.password_hash);

          if (isOldDefault) {
            this.db.prepare(
              'UPDATE super_admin_credentials SET password_hash = ? WHERE id = 1'
            ).run(defaultMasterHash);
            logger.info('Migrated super_admin_credentials password hash to MasterAdmin@2026 default');
          }
        }
      } catch (seedErr) {
        logger.warn({ seedErr }, 'Master admin credential initialization check');
      }

      // Column migrations for existing tables
      try {
        const columns = this.db.prepare("PRAGMA table_info(customers_family_trees)").all() as { name: string }[];
        const hasViewerPassword = columns.some((c) => c.name === 'viewer_password_hash');
        if (!hasViewerPassword && columns.length > 0) {
          this.db.exec("ALTER TABLE customers_family_trees ADD COLUMN viewer_password_hash TEXT NOT NULL DEFAULT ''");
          logger.info('Migrated SQLite table: added viewer_password_hash column');
        }

        const hasAdminCode = columns.some((c) => c.name === 'admin_code');
        if (!hasAdminCode && columns.length > 0) {
          this.db.exec("ALTER TABLE customers_family_trees ADD COLUMN admin_code TEXT NOT NULL DEFAULT ''");
          this.db.exec("UPDATE customers_family_trees SET admin_code = 'ADM-' || SUBSTR(customer_id, 6) WHERE admin_code = '' AND customer_id LIKE 'CUST-%'");
          this.db.exec("UPDATE customers_family_trees SET admin_code = 'ADM-1001' WHERE admin_code = ''");
          logger.info('Migrated SQLite table: added admin_code column');
        }

        const hasCustomerEmail = columns.some((c) => c.name === 'customer_email');
        if (!hasCustomerEmail && columns.length > 0) {
          this.db.exec("ALTER TABLE customers_family_trees ADD COLUMN customer_email TEXT NOT NULL DEFAULT ''");
          this.db.exec("UPDATE customers_family_trees SET customer_email = admin_email WHERE customer_email = ''");
          logger.info('Migrated SQLite table: added customer_email column');
        }

        // Create indexes after columns are guaranteed to exist
        this.db.exec(`
          CREATE INDEX IF NOT EXISTS idx_customers_email ON customers_family_trees(admin_email);
          CREATE INDEX IF NOT EXISTS idx_customers_admin_code ON customers_family_trees(admin_code);
          CREATE INDEX IF NOT EXISTS idx_customers_customer_email ON customers_family_trees(customer_email);
          CREATE INDEX IF NOT EXISTS idx_customers_viewer_code ON customers_family_trees(viewer_login_code);
          CREATE INDEX IF NOT EXISTS idx_customers_family_id ON customers_family_trees(family_tree_id);
        `);
      } catch (colErr) {
        logger.warn({ colErr }, 'Column migration check note');
      }

      logger.info({ path: this.dbPath }, 'SQLite SQL database initialized');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize SQLite database');
    }
  }

  public getSuperAdminCredentials(): { email: string; password_hash: string } {
    if (!this.db) {
      return {
        email: 'superadmin@familyroots.heritage',
        password_hash: '',
      };
    }
    try {
      const row = this.db.prepare('SELECT email, password_hash FROM super_admin_credentials WHERE id = 1').get() as { email: string; password_hash: string } | undefined;
      if (row && row.email) {
        return row;
      }
    } catch (err) {
      logger.error({ err }, 'Error querying super admin credentials from SQL database');
    }
    return {
      email: 'superadmin@familyroots.heritage',
      password_hash: '',
    };
  }

  public updateSuperAdminCredentials(email: string, passwordHash?: string): { email: string } {
    if (!this.db) throw new Error('SQL Database is not connected');
    const normalizedEmail = email.toLowerCase().trim();
    if (passwordHash && passwordHash.trim().length > 0) {
      this.db.prepare(`
        INSERT INTO super_admin_credentials (id, email, password_hash, updated_at)
        VALUES (1, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email,
          password_hash = excluded.password_hash,
          updated_at = CURRENT_TIMESTAMP
      `).run(normalizedEmail, passwordHash);
    } else {
      this.db.prepare(`
        UPDATE super_admin_credentials
        SET email = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(normalizedEmail);
    }
    return { email: normalizedEmail };
  }

  public getAllCustomers(): CustomerFamilyTreeRecord[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM customers_family_trees ORDER BY created_time DESC'
      );
      return stmt.all() as CustomerFamilyTreeRecord[];
    } catch (err) {
      logger.error({ err }, 'Error querying all customers from SQL database');
      return [];
    }
  }

  public getCustomerById(customerId: string): CustomerFamilyTreeRecord | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM customers_family_trees WHERE customer_id = ?'
      );
      const row = stmt.get(customerId);
      return (row as CustomerFamilyTreeRecord) || null;
    } catch (err) {
      logger.error({ err, customerId }, 'Error querying customer by ID from SQL database');
      return null;
    }
  }

  public getCustomerByEmail(identifier: string): CustomerFamilyTreeRecord | null {
    return this.getCustomerByAdminCodeOrEmail(identifier);
  }

  public getCustomerByAdminCodeOrEmail(identifier: string): CustomerFamilyTreeRecord | null {
    if (!this.db) return null;
    try {
      const raw = identifier.trim();
      const normalized = raw.toLowerCase();
      const upper = raw.toUpperCase();
      const stmt = this.db.prepare(`
        SELECT * FROM customers_family_trees
        WHERE UPPER(admin_code) = ?
           OR LOWER(admin_code) = ?
           OR LOWER(admin_email) = ?
           OR LOWER(customer_email) = ?
      `);
      const row = stmt.get(upper, normalized, normalized, normalized);
      return (row as CustomerFamilyTreeRecord) || null;
    } catch (err) {
      logger.error({ err, identifier }, 'Error querying customer by admin code/email from SQL database');
      return null;
    }
  }

  public getCustomerByViewerCodeOrEmail(identifier: string): CustomerFamilyTreeRecord | null {
    if (!this.db) return null;
    try {
      const raw = identifier.trim();
      const normalized = raw.toLowerCase();
      const upper = raw.toUpperCase();
      const stmt = this.db.prepare(`
        SELECT * FROM customers_family_trees
        WHERE UPPER(viewer_login_code) = ?
           OR LOWER(viewer_login_code) = ?
           OR UPPER(admin_code) = ?
           OR LOWER(admin_code) = ?
           OR LOWER(admin_email) = ?
           OR LOWER(customer_email) = ?
      `);
      const row = stmt.get(upper, normalized, upper, normalized, normalized, normalized);
      return (row as CustomerFamilyTreeRecord) || null;
    } catch (err) {
      logger.error({ err, identifier }, 'Error querying customer by viewer code/email from SQL database');
      return null;
    }
  }

  public getCustomerByViewerCode(viewerLoginCode: string): CustomerFamilyTreeRecord | null {
    if (!this.db) return null;
    try {
      const raw = viewerLoginCode.trim();
      const normalized = raw.toLowerCase();
      const upper = raw.toUpperCase();
      const stmt = this.db.prepare(
        'SELECT * FROM customers_family_trees WHERE UPPER(viewer_login_code) = ? OR LOWER(viewer_login_code) = ?'
      );
      const row = stmt.get(upper, normalized);
      return (row as CustomerFamilyTreeRecord) || null;
    } catch (err) {
      logger.error({ err, viewerLoginCode }, 'Error querying customer by viewer code from SQL database');
      return null;
    }
  }

  public getCustomerByFamilyTreeId(familyTreeId: string): CustomerFamilyTreeRecord | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM customers_family_trees WHERE family_tree_id = ?'
      );
      const row = stmt.get(familyTreeId);
      return (row as CustomerFamilyTreeRecord) || null;
    } catch (err) {
      logger.error({ err, familyTreeId }, 'Error querying customer by family tree ID from SQL database');
      return null;
    }
  }

  public createCustomer(data: {
    customer_id: string;
    customer_name: string;
    customer_email?: string;
    admin_code?: string;
    admin_email?: string;
    admin_password_hash: string;
    viewer_login_code: string;
    viewer_password_hash?: string;
    family_tree_name: string;
    family_tree_id: string;
    created_time?: string;
  }): CustomerFamilyTreeRecord {
    if (!this.db) throw new Error('SQL Database is not connected');

    const createdTime = data.created_time || new Date().toISOString();
    const viewerPasswordHash = data.viewer_password_hash || '';

    // Auto-derive Admin Code if not passed (e.g. ADM-1002 from CUST-1002)
    const numMatch = data.customer_id.match(/\d+/);
    const adminCode = (data.admin_code && data.admin_code.trim()) || `ADM-${numMatch ? numMatch[0] : '1001'}`;
    const customerEmail = (data.customer_email && data.customer_email.trim().toLowerCase()) || '';
    const adminEmail = (data.admin_email && data.admin_email.trim().toLowerCase()) ||
      (customerEmail ? customerEmail : `${adminCode.toLowerCase()}@familyroots.heritage`);

    const stmt = this.db.prepare(`
      INSERT INTO customers_family_trees (
        customer_id,
        customer_name,
        customer_email,
        admin_code,
        admin_email,
        admin_password_hash,
        viewer_login_code,
        viewer_password_hash,
        family_tree_name,
        family_tree_id,
        created_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.customer_id,
      data.customer_name.trim(),
      customerEmail,
      adminCode.toUpperCase().trim(),
      adminEmail,
      data.admin_password_hash,
      data.viewer_login_code.toUpperCase().trim(),
      viewerPasswordHash,
      data.family_tree_name.trim(),
      data.family_tree_id,
      createdTime
    );

    return {
      customer_id: data.customer_id,
      customer_name: data.customer_name.trim(),
      customer_email: customerEmail,
      admin_code: adminCode.toUpperCase().trim(),
      admin_email: adminEmail,
      admin_password_hash: data.admin_password_hash,
      viewer_login_code: data.viewer_login_code.toUpperCase().trim(),
      viewer_password_hash: viewerPasswordHash,
      family_tree_name: data.family_tree_name.trim(),
      family_tree_id: data.family_tree_id,
      created_time: createdTime,
    };
  }

  public deleteCustomer(customerId: string): boolean {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare(
        'DELETE FROM customers_family_trees WHERE customer_id = ?'
      );
      const res = stmt.run(customerId);
      return res.changes > 0;
    } catch (err) {
      logger.error({ err, customerId }, 'Error deleting customer from SQL database');
      return false;
    }
  }

  public getNextCustomerId(): string {
    if (!this.db) return 'CUST-1001';
    try {
      const rows = this.db
        .prepare('SELECT customer_id FROM customers_family_trees')
        .all() as { customer_id: string }[];

      let maxNum = 1000;
      for (const row of rows) {
        const match = row.customer_id.match(/CUST-(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      return `CUST-${maxNum + 1}`;
    } catch {
      return 'CUST-1001';
    }
  }

  public getNextAdminCode(): string {
    const custId = this.getNextCustomerId();
    const match = custId.match(/\d+/);
    return `ADM-${match ? match[0] : '1001'}`;
  }

  public getNextViewerCode(): string {
    const custId = this.getNextCustomerId();
    const match = custId.match(/\d+/);
    return `VIEW-${match ? match[0] : '1001'}`;
  }
}

export const sqlDatabase = SqlDatabase.getInstance();
