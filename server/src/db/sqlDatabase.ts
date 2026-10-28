import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.ts';

export interface CustomerFamilyTreeRecord {
  customer_id: string;
  customer_name: string;
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

      // Create customers_family_trees table according to schema requirements
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS customers_family_trees (
          customer_id TEXT PRIMARY KEY,
          customer_name TEXT NOT NULL,
          admin_email TEXT NOT NULL UNIQUE,
          admin_password_hash TEXT NOT NULL,
          viewer_login_code TEXT NOT NULL,
          viewer_password_hash TEXT NOT NULL DEFAULT '',
          family_tree_name TEXT NOT NULL,
          family_tree_id TEXT NOT NULL,
          created_time DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_customers_email ON customers_family_trees(admin_email);
        CREATE INDEX IF NOT EXISTS idx_customers_viewer_code ON customers_family_trees(viewer_login_code);
        CREATE INDEX IF NOT EXISTS idx_customers_family_id ON customers_family_trees(family_tree_id);

        CREATE TABLE IF NOT EXISTS super_admin_credentials (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Initialize default Super Admin credentials if not present
      try {
        const existingSuper = this.db.prepare('SELECT * FROM super_admin_credentials WHERE id = 1').get();
        if (!existingSuper) {
          // Default pre-seeded Super Admin
          this.db.prepare(
            'INSERT INTO super_admin_credentials (id, email, password_hash) VALUES (1, ?, ?)'
          ).run('superadmin@familyroots.heritage', '$2a$10$wE0vj1N2u1zYF8bI7k8PneOqP9cKpKj9Nkmw4L2fM/gHqZ.eU1Sia');
        }
      } catch (seedErr) {
        logger.warn({ seedErr }, 'Super admin credential initialization check');
      }

      // Ensure column viewer_password_hash exists if upgrading existing DB
      try {
        const columns = this.db.prepare("PRAGMA table_info(customers_family_trees)").all() as { name: string }[];
        const hasViewerPassword = columns.some((c) => c.name === 'viewer_password_hash');
        if (!hasViewerPassword && columns.length > 0) {
          this.db.exec("ALTER TABLE customers_family_trees ADD COLUMN viewer_password_hash TEXT NOT NULL DEFAULT ''");
          logger.info('Migrated SQLite table: added viewer_password_hash column');
        }
      } catch (colErr) {
        logger.warn({ colErr }, 'Column migration check note');
      }

      logger.info({ path: this.dbPath }, 'SQLite SQL database initialized with tables: customers_family_trees, super_admin_credentials');
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

  public getCustomerByEmail(email: string): CustomerFamilyTreeRecord | null {
    if (!this.db) return null;
    try {
      const normalized = email.toLowerCase().trim();
      const stmt = this.db.prepare(
        'SELECT * FROM customers_family_trees WHERE LOWER(admin_email) = ?'
      );
      const row = stmt.get(normalized);
      return (row as CustomerFamilyTreeRecord) || null;
    } catch (err) {
      logger.error({ err, email }, 'Error querying customer by email from SQL database');
      return null;
    }
  }

  public getCustomerByViewerCodeOrEmail(identifier: string): CustomerFamilyTreeRecord | null {
    if (!this.db) return null;
    try {
      const normalized = identifier.toLowerCase().trim();
      const stmt = this.db.prepare(
        'SELECT * FROM customers_family_trees WHERE LOWER(viewer_login_code) = ? OR LOWER(admin_email) = ?'
      );
      const row = stmt.get(normalized, normalized);
      return (row as CustomerFamilyTreeRecord) || null;
    } catch (err) {
      logger.error({ err, identifier }, 'Error querying customer by viewer code from SQL database');
      return null;
    }
  }

  public getCustomerByViewerCode(viewerLoginCode: string): CustomerFamilyTreeRecord | null {
    if (!this.db) return null;
    try {
      const normalized = viewerLoginCode.toLowerCase().trim();
      const stmt = this.db.prepare(
        'SELECT * FROM customers_family_trees WHERE LOWER(viewer_login_code) = ?'
      );
      const row = stmt.get(normalized);
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
    admin_email: string;
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

    const stmt = this.db.prepare(`
      INSERT INTO customers_family_trees (
        customer_id,
        customer_name,
        admin_email,
        admin_password_hash,
        viewer_login_code,
        viewer_password_hash,
        family_tree_name,
        family_tree_id,
        created_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.customer_id,
      data.customer_name.trim(),
      data.admin_email.toLowerCase().trim(),
      data.admin_password_hash,
      data.viewer_login_code.trim(),
      viewerPasswordHash,
      data.family_tree_name.trim(),
      data.family_tree_id,
      createdTime
    );

    return {
      customer_id: data.customer_id,
      customer_name: data.customer_name.trim(),
      admin_email: data.admin_email.toLowerCase().trim(),
      admin_password_hash: data.admin_password_hash,
      viewer_login_code: data.viewer_login_code.trim(),
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
}

export const sqlDatabase = SqlDatabase.getInstance();
