import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";

// Host is local for cPanel Node.js setup, database credentials:
const MYSQL_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "sportixbikeshop_adv",
  password: process.env.DB_PASSWORD || "@Sportix",
  database: process.env.DB_NAME || "sportixbikeshop_adv",
};

const JSON_DB_DIR = path.join(process.cwd(), "data");

// Dual-engine detection
let useMySQL = false;
let mysqlPool: mysql.Pool | null = null;

async function initDB() {
  try {
    // If we have proper env or in cPanel, try to initialize MySQL
    if (process.env.NODE_ENV === "production" || process.env.USE_MYSQL === "true" || process.env.DB_HOST) {
      mysqlPool = mysql.createPool({
        ...MYSQL_CONFIG,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
      // Test connection
      const conn = await mysqlPool.getConnection();
      console.log("Successfully connected to MySQL database: " + MYSQL_CONFIG.database);
      conn.release();
      useMySQL = true;

      // Create Tables in MySQL if they do not exist
      await createMySQLTables();
    } else {
      console.log("MySQL connection skipped. Running in Local JSON Database mode for the development environment.");
      ensureJsonDbDir();
    }
  } catch (err: any) {
    console.warn("Could not connect to MySQL (" + err.message + "). Falling back to Local JSON Database for development stability.");
    ensureJsonDbDir();
    useMySQL = false;
  }
}

function ensureJsonDbDir() {
  if (!fs.existsSync(JSON_DB_DIR)) {
    fs.mkdirSync(JSON_DB_DIR, { recursive: true });
  }
  // Initialize files with empty arrays if not exists
  const files = [
    "law_firms.json",
    "users.json",
    "clients.json",
    "processes.json",
    "movements.json",
    "events.json",
    "documents.json",
    "financial.json",
    "workflows.json",
    "audit_logs.json",
    "smtp_settings.json",
    "cloud_accounts.json",
  ];
  files.forEach((file) => {
    const filePath = path.join(JSON_DB_DIR, file);
    if (!fs.existsSync(filePath)) {
      // Seed initial data
      if (file === "law_firms.json") {
        fs.writeFileSync(
          filePath,
          JSON.stringify(
            [
              {
                id: "1",
                name: "AALL Advogados",
                cnpj: "98.765.432/0001-21",
                licenses: 5,
                active: true,
                logo_url: "",
                primary_color: "#0f766e",
                secondary_color: "#111827",
                created_at: new Date().toISOString(),
              }
            ],
            null,
            2
          )
        );
      } else if (file === "users.json") {
        // Default admin: rodrigo.cardoso@sportix.com.br / password: @Sportix
        fs.writeFileSync(
          filePath,
          JSON.stringify(
            [
              {
                id: "1",
                name: "Rodrigo Cardoso",
                email: "rodrigo.cardoso@sportix.com.br",
                password: "@Sportix",
                role: "admin",
                permissions: ["all"],
                active: true,
                law_firm_id: "1",
                created_at: new Date().toISOString(),
              }
            ],
            null,
            2
          )
        );
      } else if (file === "smtp_settings.json") {
        // Seed default SMTP settings
        fs.writeFileSync(
          filePath,
          JSON.stringify(
            [
              {
                id: "1",
                host: "smtp.legalprime.com.br",
                port: 587,
                secure: false,
                user: "notificacoes@legalprime.com.br",
                password: "SenhaSeguraSMTP123",
                sender_name: "Legal Prime",
                created_at: new Date().toISOString(),
              }
            ],
            null,
            2
          )
        );
      } else {
        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
      }
    }
  });
}

async function createMySQLTables() {
  if (!mysqlPool) return;
  const queries = [
    `CREATE TABLE IF NOT EXISTS law_firms (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      cnpj VARCHAR(50),
      licenses INT DEFAULT 5,
      active TINYINT(1) DEFAULT 1,
      logo_url TEXT,
      primary_color VARCHAR(50),
      secondary_color VARCHAR(50),
      cloud_provider VARCHAR(50),
      dropbox_client_id TEXT,
      dropbox_client_secret TEXT,
      dropbox_access_token TEXT,
      dropbox_refresh_token TEXT,
      dropbox_token_expires_at VARCHAR(100),
      gdrive_client_id TEXT,
      gdrive_client_secret TEXT,
      gdrive_access_token TEXT,
      gdrive_refresh_token TEXT,
      gdrive_token_expires_at VARCHAR(100),
      onedrive_client_id TEXT,
      onedrive_client_secret TEXT,
      onedrive_access_token TEXT,
      onedrive_refresh_token TEXT,
      onedrive_token_expires_at VARCHAR(100),
      smtp_host TEXT,
      smtp_port INT,
      smtp_user TEXT,
      smtp_pass TEXT,
      smtp_sender TEXT,
      smtp_secure TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      permissions TEXT,
      active TINYINT(1) DEFAULT 1,
      law_firm_id VARCHAR(255),
      oab VARCHAR(100),
      dropbox_access_token TEXT,
      dropbox_refresh_token TEXT,
      dropbox_token_expires_at VARCHAR(100),
      dropbox_client_id TEXT,
      dropbox_client_secret TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(10) NOT NULL,
      document VARCHAR(50),
      email VARCHAR(255),
      phone VARCHAR(50),
      address TEXT,
      contacts TEXT,
      notes TEXT,
      law_firm_id VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS processes (
      id VARCHAR(255) PRIMARY KEY,
      cnj VARCHAR(100) UNIQUE NOT NULL,
      title VARCHAR(255) NOT NULL,
      client_id VARCHAR(255),
      area VARCHAR(100),
      court VARCHAR(100),
      comarca VARCHAR(100),
      vara VARCHAR(100),
      status VARCHAR(50),
      lawyers TEXT,
      description TEXT,
      value DECIMAL(15,2),
      law_firm_id VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS movements (
      id VARCHAR(255) PRIMARY KEY,
      process_id VARCHAR(255) NOT NULL,
      date DATETIME NOT NULL,
      description TEXT NOT NULL,
      source VARCHAR(50),
      law_firm_id VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS events (
      id VARCHAR(255) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      status VARCHAR(50) NOT NULL,
      process_id VARCHAR(255),
      assigned_to TEXT,
      alerts_sent TINYINT(1) DEFAULT 0,
      law_firm_id VARCHAR(255),
      google_event_id VARCHAR(255),
      calendar_id VARCHAR(255),
      location TEXT,
      sync_status VARCHAR(50) DEFAULT 'synced',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS financial (
      id VARCHAR(255) PRIMARY KEY,
      description VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      type VARCHAR(50) NOT NULL,
      category VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      due_date DATE NOT NULL,
      payment_date DATE,
      client_id VARCHAR(255),
      process_id VARCHAR(255),
      recurrence VARCHAR(50),
      pix_code TEXT,
      law_firm_id VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS documents (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100) NOT NULL,
      file_path TEXT NOT NULL,
      version INT DEFAULT 1,
      process_id VARCHAR(255),
      client_id VARCHAR(255),
      created_by VARCHAR(255),
      signatures TEXT,
      law_firm_id VARCHAR(255),
      d4sign_id VARCHAR(255),
      d4sign_status VARCHAR(100),
      d4sign_signers TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS workflows (
      id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      trigger_event VARCHAR(100) NOT NULL,
      actions TEXT NOT NULL,
      active TINYINT(1) DEFAULT 1,
      law_firm_id VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255),
      user_name VARCHAR(255),
      action VARCHAR(255) NOT NULL,
      table_name VARCHAR(100),
      record_id VARCHAR(255),
      details TEXT,
      law_firm_id VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS smtp_settings (
      id VARCHAR(255) PRIMARY KEY,
      host VARCHAR(255) NOT NULL,
      port INT NOT NULL,
      secure TINYINT(1) DEFAULT 0,
      user VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      sender_name VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS cloud_accounts (
      id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      provider VARCHAR(50) NOT NULL,
      email VARCHAR(255),
      storage_name VARCHAR(255),
      access_token TEXT,
      refresh_token TEXT,
      expires_at VARCHAR(100),
      connected TINYINT(1) DEFAULT 1,
      calendar_id TEXT,
      google_user_id VARCHAR(255),
      sync_status VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  ];

  for (const query of queries) {
    await mysqlPool.query(query);
  }

  // Safe table alterations to add new Google Calendar columns if tables already exist
  const alterations = [
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS google_event_id VARCHAR(255)",
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS calendar_id VARCHAR(255)",
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS location TEXT",
    "ALTER TABLE events ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'synced'",
    "ALTER TABLE cloud_accounts ADD COLUMN IF NOT EXISTS calendar_id TEXT",
    "ALTER TABLE cloud_accounts ADD COLUMN IF NOT EXISTS google_user_id VARCHAR(255)",
    "ALTER TABLE cloud_accounts ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50)"
  ];

  for (const alt of alterations) {
    try {
      await mysqlPool.query(alt);
    } catch (e: any) {
      // Fallback if IF NOT EXISTS is not supported by MySQL server version
      try {
        const standardAlt = alt.replace("IF NOT EXISTS ", "");
        await mysqlPool.query(standardAlt);
      } catch (innerErr) {
        // Column probably already exists, safe to ignore
      }
    }
  }
}

// Low-level helper JSON read/write routines
function readJsonFile(filename: string): any[] {
  ensureJsonDbDir();
  const filePath = path.join(JSON_DB_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJsonFile(filename: string, data: any[]) {
  ensureJsonDbDir();
  const filePath = path.join(JSON_DB_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Thread-safe Repository Engine Wrapper
export const DB = {
  async init() {
    await initDB();
  },

  isMySQLActive() {
    return useMySQL;
  },

  // Dynamic Generic Table Driver
  table(tableName: string) {
    const filename = `${tableName}.json`;

    return {
      async find(filterFn?: (item: any) => boolean): Promise<any[]> {
        if (useMySQL && mysqlPool) {
          // Simplistic general query handler for production mysql compat
          let query = `SELECT * FROM ${tableName}`;
          const [rows]: any = await mysqlPool.query(query);

          // Parse JSON fields before returning from mysql
          return rows.map((row: any) => {
            const parsedRow = { ...row };
            // Auto parse JSON text fields
            ["address", "contacts", "lawyers", "assigned_to", "permissions", "actions", "signatures"].forEach((col) => {
              if (parsedRow[col] && typeof parsedRow[col] === "string") {
                try {
                  parsedRow[col] = JSON.parse(parsedRow[col]);
                } catch {
                  // Keep as string
                }
              }
            });
            return parsedRow;
          }).filter(filterFn || (() => true));
        } else {
          const items = readJsonFile(filename);
          return filterFn ? items.filter(filterFn) : items;
        }
      },

      async findOne(filterFn: (item: any) => boolean): Promise<any | null> {
        const results = await this.find(filterFn);
        return results.length > 0 ? results[0] : null;
      },

      async insert(data: any): Promise<any> {
        const id = data.id || Math.random().toString(36).substr(2, 9);
        const record = { ...data, id };
        if (!record.created_at) {
          record.created_at = new Date().toISOString();
        }

        if (useMySQL && mysqlPool) {
          // Build safe MySQL insert statement dynamically
          const columns = Object.keys(record);
          const values = columns.map((col) => {
            const val = record[col];
            if (val !== null && typeof val === "object") {
              return JSON.stringify(val); // serialize json objects
            }
            return val;
          });

          const placeholders = columns.map(() => "?").join(", ");
          const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
          await mysqlPool.query(sql, values);
          return record;
        } else {
          const items = readJsonFile(filename);
          items.push(record);
          writeJsonFile(filename, items);
          return record;
        }
      },

      async update(id: string, updatedData: any): Promise<any | null> {
        if (useMySQL && mysqlPool) {
          const updateFields = Object.keys(updatedData);
          if (updateFields.length === 0) return null;

          const values = updateFields.map((col) => {
            const val = updatedData[col];
            if (val !== null && typeof val === "object") {
              return JSON.stringify(val);
            }
            return val;
          });

          const setStatement = updateFields.map((col) => `${col} = ?`).join(", ");
          const sql = `UPDATE ${tableName} SET ${setStatement} WHERE id = ?`;
          await mysqlPool.query(sql, [...values, id]);

          // Fetch fresh record
          const [rows]: any = await mysqlPool.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
          if (rows.length === 0) return null;
          const updatedRecord = { ...rows[0] };
          ["address", "contacts", "lawyers", "assigned_to", "permissions", "actions", "signatures"].forEach((col) => {
            if (updatedRecord[col] && typeof updatedRecord[col] === "string") {
              try {
                updatedRecord[col] = JSON.parse(updatedRecord[col]);
              } catch {}
            }
          });
          return updatedRecord;
        } else {
          const items = readJsonFile(filename);
          const index = items.findIndex((item) => item.id === id);
          if (index === -1) return null;
          items[index] = { ...items[index], ...updatedData };
          writeJsonFile(filename, items);
          return items[index];
        }
      },

      async delete(id: string): Promise<boolean> {
        if (useMySQL && mysqlPool) {
          const [result]: any = await mysqlPool.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
          return result.affectedRows > 0;
        } else {
          const items = readJsonFile(filename);
          const initialLength = items.length;
          const filtered = items.filter((item) => item.id !== id);
          if (filtered.length === initialLength) return false;
          writeJsonFile(filename, filtered);
          return true;
        }
      },
    };
  },
};
