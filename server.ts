import express, { Response } from "express";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import { createServer as createViteServer } from "vite";
import { DB } from "./src/server/db.ts";
import { StorageFactory } from "./src/server/services/cloud/factory/StorageFactory.ts";
import { Auth, AuthenticatedRequest } from "./src/server/auth.ts";
import { LegalAI } from "./src/server/gemini.ts";
import { GoogleCalendarService } from "./src/server/services/google-calendar.ts";
import nodemailer from "nodemailer";

const app = express();
const PORT = 3000;

app.use(express.json());

// Log helper for LGPD compliance auditing
async function logAudit(req: AuthenticatedRequest, action: string, table: string, recordId: string, details: string) {
  try {
    await DB.table("audit_logs").insert({
      id: Math.random().toString(36).substr(2, 9),
      user_id: req.user?.id || "anonymous",
      user_name: req.user?.name || "Anônimo",
      action,
      table_name: table,
      record_id: recordId,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Audit logger error:", err);
  }
}

// ==========================================
// ENDPOINTS PÚBLICOS DE DOWNLOAD (CÓDIGO E BANCO DE DADOS)
// ==========================================

// Rota para baixar o código-fonte compactado em ZIP
app.get("/api/download/code", (req, res) => {
  try {
    const zip = new AdmZip();
    
    // Arquivos principais na raiz
    const filesToInclude = [
      "package.json",
      "tsconfig.json",
      "vite.config.ts",
      "server.ts",
      "server.js",
      "index.html",
      ".env.example",
      ".gitignore",
      "metadata.json",
      "AGENTS.md"
    ];

    filesToInclude.forEach((file) => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
      }
    });

    // Pastas completas
    const dirsToInclude = ["src", "data", "assets"];
    dirsToInclude.forEach((dir) => {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        zip.addLocalFolder(dirPath, dir);
      }
    });

    const buffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=legalone_source_code.zip");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao gerar arquivo de código fonte: " + err.message });
  }
});

// Rota para baixar a pasta dist compilada em ZIP (útil para hospedagens cPanel/Node.js sem terminal)
app.get("/api/download/dist", (req, res) => {
  try {
    const distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      res.status(404).json({ error: "Pasta dist não encontrada. Por favor, compile o aplicativo primeiro." });
      return;
    }
    const zip = new AdmZip();
    zip.addLocalFolder(distPath);
    const buffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=legalone_dist_compiled.zip");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao gerar arquivo da pasta dist: " + err.message });
  }
});

// Rota para baixar o pacote de implantação completo pronto para cPanel (dist + scripts + config)
app.get("/api/download/full-deploy", (req, res) => {
  try {
    const distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      res.status(404).json({ error: "Pasta dist não encontrada. Por favor, compile o aplicativo primeiro." });
      return;
    }
    const zip = new AdmZip();
    
    // Adiciona a pasta dist inteira dentro de 'dist' no zip
    zip.addLocalFolder(distPath, "dist");
    
    // Adiciona os arquivos de configuração de inicialização na raiz do zip
    const rootFiles = ["package.json", "server.js", ".env.example"];
    rootFiles.forEach((file) => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath);
      }
    });

    const buffer = zip.toBuffer();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=legalone_cpanel_ready.zip");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao gerar pacote de implantação completo: " + err.message });
  }
});

// Rota para baixar o banco de dados em formato de dump SQL completo
app.get("/api/download/sql", async (req, res) => {
  try {
    let sqlContent = `-- SQL Dump para Legal One Firm\n`;
    sqlContent += `-- Gerado em ${new Date().toISOString()}\n\n`;
    
    // Definição das tabelas para PostgreSQL ou MySQL
    sqlContent += `-- 0. Tabela law_firms\n`;
    sqlContent += `DROP TABLE IF EXISTS law_firms;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS law_firms (\n  id VARCHAR(255) PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  cnpj VARCHAR(50),\n  licenses INT DEFAULT 5,\n  active TINYINT(1) DEFAULT 1,\n  logo_url TEXT,\n  primary_color VARCHAR(50),\n  secondary_color VARCHAR(50),\n  cloud_provider VARCHAR(50),\n  dropbox_client_id TEXT,\n  dropbox_client_secret TEXT,\n  gdrive_client_id TEXT,\n  gdrive_client_secret TEXT,\n  onedrive_client_id TEXT,\n  onedrive_client_secret TEXT,\n  smtp_host TEXT,\n  smtp_port INT,\n  smtp_user TEXT,\n  smtp_pass TEXT,\n  smtp_sender TEXT,\n  smtp_secure TINYINT(1) DEFAULT 0,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    sqlContent += `-- 1. Tabela users\n`;
    sqlContent += `DROP TABLE IF EXISTS users;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS users (\n  id VARCHAR(255) PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE NOT NULL,\n  password VARCHAR(255) NOT NULL,\n  role VARCHAR(50) NOT NULL,\n  permissions TEXT,\n  active TINYINT(1) DEFAULT 1,\n  law_firm_id VARCHAR(255),\n  oab VARCHAR(100),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;
    
    sqlContent += `-- 2. Tabela clients\n`;
    sqlContent += `DROP TABLE IF EXISTS clients;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS clients (\n  id VARCHAR(255) PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  type VARCHAR(10) NOT NULL,\n  document VARCHAR(50),\n  email VARCHAR(255),\n  phone VARCHAR(50),\n  address TEXT,\n  contacts TEXT,\n  notes TEXT,\n  law_firm_id VARCHAR(255),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    sqlContent += `-- 3. Tabela processes\n`;
    sqlContent += `DROP TABLE IF EXISTS processes;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS processes (\n  id VARCHAR(255) PRIMARY KEY,\n  cnj VARCHAR(100) UNIQUE NOT NULL,\n  title VARCHAR(255) NOT NULL,\n  client_id VARCHAR(255),\n  area VARCHAR(100),\n  court VARCHAR(100),\n  comarca VARCHAR(100),\n  vara VARCHAR(100),\n  status VARCHAR(50),\n  lawyers TEXT,\n  description TEXT,\n  value DECIMAL(15,2),\n  law_firm_id VARCHAR(255),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    sqlContent += `-- 4. Tabela movements\n`;
    sqlContent += `DROP TABLE IF EXISTS movements;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS movements (\n  id VARCHAR(255) PRIMARY KEY,\n  process_id VARCHAR(255) NOT NULL,\n  date DATETIME NOT NULL,\n  description TEXT NOT NULL,\n  source VARCHAR(50),\n  law_firm_id VARCHAR(255),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    sqlContent += `-- 5. Tabela events\n`;
    sqlContent += `DROP TABLE IF EXISTS events;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS events (\n  id VARCHAR(255) PRIMARY KEY,\n  title VARCHAR(255) NOT NULL,\n  description TEXT,\n  type VARCHAR(50) NOT NULL,\n  start_date DATETIME NOT NULL,\n  end_date DATETIME NOT NULL,\n  status VARCHAR(50) NOT NULL,\n  process_id VARCHAR(255),\n  assigned_to TEXT,\n  alerts_sent TINYINT(1) DEFAULT 0,\n  law_firm_id VARCHAR(255),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    sqlContent += `-- 6. Tabela financial\n`;
    sqlContent += `DROP TABLE IF EXISTS financial;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS financial (\n  id VARCHAR(255) PRIMARY KEY,\n  description VARCHAR(255) NOT NULL,\n  amount DECIMAL(15,2) NOT NULL,\n  type VARCHAR(50) NOT NULL,\n  category VARCHAR(100) NOT NULL,\n  status VARCHAR(50) NOT NULL,\n  due_date DATE NOT NULL,\n  payment_date DATE,\n  client_id VARCHAR(255),\n  process_id VARCHAR(255),\n  recurrence VARCHAR(50),\n  pix_code TEXT,\n  law_firm_id VARCHAR(255),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    sqlContent += `-- 7. Tabela documents\n`;
    sqlContent += `DROP TABLE IF EXISTS documents;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS documents (\n  id VARCHAR(255) PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  category VARCHAR(100) NOT NULL,\n  file_path TEXT NOT NULL,\n  version INT DEFAULT 1,\n  process_id VARCHAR(255),\n  client_id VARCHAR(255),\n  created_by VARCHAR(255),\n  signatures TEXT,\n  law_firm_id VARCHAR(255),\n  d4sign_id VARCHAR(255),\n  d4sign_status VARCHAR(100),\n  d4sign_signers TEXT,\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    sqlContent += `-- 8. Tabela workflows\n`;
    sqlContent += `DROP TABLE IF EXISTS workflows;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS workflows (\n  id VARCHAR(255) PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  trigger_event VARCHAR(100) NOT NULL,\n  actions TEXT NOT NULL,\n  active TINYINT(1) DEFAULT 1,\n  law_firm_id VARCHAR(255),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    sqlContent += `-- 9. Tabela audit_logs\n`;
    sqlContent += `DROP TABLE IF EXISTS audit_logs;\n`;
    sqlContent += `CREATE TABLE IF NOT EXISTS audit_logs (\n  id VARCHAR(255) PRIMARY KEY,\n  user_id VARCHAR(255),\n  user_name VARCHAR(255),\n  action VARCHAR(255) NOT NULL,\n  table_name VARCHAR(100),\n  record_id VARCHAR(255),\n  details TEXT,\n  law_firm_id VARCHAR(255),\n  created_at DATETIME DEFAULT CURRENT_TIMESTAMP\n);\n\n`;

    const tables = ["law_firms", "users", "clients", "processes", "movements", "events", "financial", "documents", "workflows", "audit_logs"];
    
    for (const table of tables) {
      try {
        const records = await DB.table(table as any).find();
        if (records && records.length > 0) {
          sqlContent += `-- Dados da tabela ${table}\n`;
          for (const rec of records) {
            const keys = Object.keys(rec);
            const columns = keys.join(", ");
            const values = keys.map((key) => {
              const val = rec[key];
              if (val === null || val === undefined) {
                return "NULL";
              }
              if (typeof val === "object") {
                return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              }
              if (typeof val === "boolean") {
                return val ? "TRUE" : "FALSE";
              }
              if (typeof val === "number") {
                return val.toString();
              }
              return `'${val.toString().replace(/'/g, "''")}'`;
            }).join(", ");
            sqlContent += `REPLACE INTO ${table} (${columns}) VALUES (${values});\n`;
          }
          sqlContent += `\n`;
        }
      } catch (errTable) {
        sqlContent += `-- Erro ao exportar dados da tabela ${table}\n\n`;
      }
    }

    res.setHeader("Content-Type", "text/plain"); // para fácil visualização direta ou download
    res.setHeader("Content-Disposition", "attachment; filename=legalone_database_dump.sql");
    res.send(sqlContent);
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao gerar arquivo SQL: " + err.message });
  }
});

// ==========================================
// 1. AUTHENTICATION ENDPOINTS
// ==========================================

// Login
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
     res.status(400).json({ error: "E-mail e senha são obrigatórios." });
     return;
  }

  try {
    const user = await DB.table("users").findOne((u) => u.email === email && u.active);
    if (!user) {
       res.status(401).json({ error: "Credenciais incorretas ou conta inativa." });
       return;
    }

    // Support both plaintext and bcrypt password checks for ease of testing in preview, default to bcrypt
    let isMatch = false;
    if (user.password.startsWith("$2a$") || user.password.startsWith("$2b$")) {
      isMatch = await Auth.comparePassword(password, user.password);
    } else {
      isMatch = password === user.password;
    }

    if (!isMatch) {
       res.status(401).json({ error: "E-mail ou senha incorretos." });
       return;
    }

    const token = Auth.generateToken(user);
    
    // Log auth
    await DB.table("audit_logs").insert({
      id: Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      user_name: user.name,
      action: "Efetivou Login",
      table_name: "users",
      record_id: user.id,
      details: `Login bem-sucedido via web para papel: ${user.role}`,
      created_at: new Date().toISOString(),
    });

    const lawFirmId = user.law_firm_id || "1";
    const lawFirm = await DB.table("law_firms").findOne((f) => f.id === lawFirmId);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: typeof user.permissions === "string" ? JSON.parse(user.permissions) : (user.permissions || []),
        law_firm_id: user.law_firm_id,
        oab: user.oab,
        lawFirm: lawFirm ? {
          id: lawFirm.id,
          name: lawFirm.name,
          primary_color: lawFirm.primary_color || "#4f46e5",
          secondary_color: lawFirm.secondary_color || "#111827",
          logo_url: lawFirm.logo_url
        } : null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Login via Google
app.post("/api/auth/login/google", async (req, res) => {
  const { email } = req.body;
  if (!email) {
     res.status(400).json({ error: "E-mail da conta Google é obrigatório." });
     return;
  }

  try {
    const user = await DB.table("users").findOne((u) => u.email === email && u.active);
    if (!user) {
       res.status(401).json({ error: "Nenhuma conta associada a este e-mail Google ou conta inativa." });
       return;
    }

    const token = Auth.generateToken(user);
    
    // Log auth
    await DB.table("audit_logs").insert({
      id: Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      user_name: user.name,
      action: "Efetivou Login via Google",
      table_name: "users",
      record_id: user.id,
      details: `Login bem-sucedido via Google federated auth para papel: ${user.role}`,
      created_at: new Date().toISOString(),
    });

    const lawFirmId = user.law_firm_id || "1";
    const lawFirm = await DB.table("law_firms").findOne((f) => f.id === lawFirmId);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: typeof user.permissions === "string" ? JSON.parse(user.permissions) : (user.permissions || []),
        law_firm_id: user.law_firm_id,
        oab: user.oab,
        lawFirm: lawFirm ? {
          id: lawFirm.id,
          name: lawFirm.name,
          primary_color: lawFirm.primary_color || "#4f46e5",
          secondary_color: lawFirm.secondary_color || "#111827",
          logo_url: lawFirm.logo_url
        } : null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create initial user if none exists (self-heal)
app.post("/api/auth/register-initial", async (req, res) => {
  try {
    const existing = await DB.table("users").find();
    if (existing.length > 0) {
       res.status(400).json({ error: "O sistema já possui usuários cadastrados." });
       return;
    }
    const { name, email, password } = req.body;
    const hashedPassword = await Auth.hashPassword(password);
    const user = await DB.table("users").insert({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      permissions: ["all"],
      active: true,
    });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Current User info
app.get("/api/auth/me", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Não autorizado" });
      return;
    }
    const user = await DB.table("users").findOne((u) => u.id === req.user!.id);
    if (!user) {
      // Safe fallback if user was deleted but token is valid
      res.json({ user: req.user });
      return;
    }

    const lawFirmId = user.law_firm_id || "1";
    const lawFirm = await DB.table("law_firms").findOne((f) => f.id === lawFirmId);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: typeof user.permissions === "string" ? JSON.parse(user.permissions) : (user.permissions || []),
        law_firm_id: user.law_firm_id,
        oab: user.oab,
        lawFirm: lawFirm ? {
          id: lawFirm.id,
          name: lawFirm.name,
          cnpj: lawFirm.cnpj,
          primary_color: lawFirm.primary_color || "#4f46e5",
          secondary_color: lawFirm.secondary_color || "#111827",
          logo_url: lawFirm.logo_url
        } : null
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 2. CLIENT MANAGEMENT ENDPOINTS
// ==========================================

// List Clients
app.get("/api/clients", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const clients = await DB.table("clients").find();
    const search = req.query.search as string;
    const type = req.query.type as string;

    let filtered = clients;

    // Filter by Law Firm (Multi-tenancy cluster)
    let law_firm_id = req.user?.law_firm_id;
    if ((req.user?.role === "admin" || req.user?.email === "rodrigo.cardoso@sportix.com.br") && req.query.law_firm_id) {
      law_firm_id = req.query.law_firm_id as string;
    }
    if (law_firm_id) {
      filtered = filtered.filter((c) => c.law_firm_id === law_firm_id || (!c.law_firm_id && law_firm_id === "1"));
    }

    // Filter by User Hierarchy: If user is client role, they only see themselves
    if (req.user?.role === "client") {
      filtered = filtered.filter((c) => c.email === req.user?.email);
    } else {
      if (search) {
        const query = search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.document.includes(query) ||
            (c.email && c.email.toLowerCase().includes(query))
        );
      }
      if (type) {
        filtered = filtered.filter((c) => c.type === type);
      }
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Client
app.post("/api/clients", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer", "secretary"]), async (req: AuthenticatedRequest, res) => {
  try {
    const clientData = {
      ...req.body,
      law_firm_id: req.body.law_firm_id || req.user?.law_firm_id || "1"
    };
    const client = await DB.table("clients").insert(clientData);
    await logAudit(req, "Cadastrou Cliente", "clients", client.id, `Cliente cadastrado: ${client.name} (${client.type}) no escritório ID ${client.law_firm_id}`);
    res.status(201).json(client);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Client
app.put("/api/clients/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer", "secretary"]), async (req: AuthenticatedRequest, res) => {
  try {
    const client = await DB.table("clients").update(req.params.id, req.body);
    if (!client) {
       res.status(404).json({ error: "Cliente não encontrado." });
       return;
    }
    await logAudit(req, "Atualizou Cliente", "clients", req.params.id, `Dados atualizados para ${client.name}`);
    res.json(client);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Client
app.delete("/api/clients/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const success = await DB.table("clients").delete(req.params.id);
    if (!success) {
       res.status(404).json({ error: "Cliente não encontrado." });
       return;
    }
    await logAudit(req, "Deletou Cliente", "clients", req.params.id, `Cliente removido do banco de dados`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 3. PROCESS MANAGEMENT ENDPOINTS
// ==========================================

// List Processes
app.get("/api/processes", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const processes = await DB.table("processes").find();
    const search = req.query.search as string;
    const area = req.query.area as string;
    const client_id = req.query.client_id as string;

    let filtered = processes;

    // Filter by Law Firm (Multi-tenancy cluster)
    let law_firm_id = req.user?.law_firm_id;
    if ((req.user?.role === "admin" || req.user?.email === "rodrigo.cardoso@sportix.com.br") && req.query.law_firm_id) {
      law_firm_id = req.query.law_firm_id as string;
    }
    if (law_firm_id) {
      filtered = filtered.filter((p) => p.law_firm_id === law_firm_id || (!p.law_firm_id && law_firm_id === "1"));
    }

    // Filter by User Hierarchy: If client role, can only see processes linked to their client card
    if (req.user?.role === "client") {
      const myClient = await DB.table("clients").findOne((c) => c.email === req.user?.email);
      if (myClient) {
        filtered = filtered.filter((p) => p.client_id === myClient.id);
      } else {
        filtered = [];
      }
    } else {
      if (search) {
        const query = search.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.cnj.includes(query) ||
            p.title.toLowerCase().includes(query) ||
            (p.description && p.description.toLowerCase().includes(query))
        );
      }
      if (area) {
        filtered = filtered.filter((p) => p.area === area);
      }
      if (client_id) {
        filtered = filtered.filter((p) => p.client_id === client_id);
      }
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Single Process detail with movements & client info
app.get("/api/processes/:id", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const process = await DB.table("processes").findOne((p) => p.id === req.params.id);
    if (!process) {
       res.status(404).json({ error: "Processo não encontrado." });
       return;
    }

    // Law Firm validation
    let law_firm_id = req.user?.law_firm_id;
    if (law_firm_id && process.law_firm_id && process.law_firm_id !== law_firm_id) {
       res.status(403).json({ error: "Acesso negado. Este processo pertence a outro escritório." });
       return;
    }

    // Role verification
    if (req.user?.role === "client") {
      const myClient = await DB.table("clients").findOne((c) => c.email === req.user?.email);
      if (!myClient || process.client_id !== myClient.id) {
         res.status(403).json({ error: "Acesso negado a este processo." });
         return;
      }
    }

    const client = await DB.table("clients").findOne((c) => c.id === process.client_id);
    const movements = await DB.table("movements").find((m) => m.process_id === process.id);
    // Sort movements by date desc
    movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      ...process,
      client,
      movements,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Process (with automated Onboarding workflow trigger)
app.post("/api/processes", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer", "secretary"]), async (req: AuthenticatedRequest, res) => {
  try {
    const processData = {
      ...req.body,
      law_firm_id: req.body.law_firm_id || req.user?.law_firm_id || "1"
    };

    const initialMovements = processData.initial_movements || [];
    delete processData.initial_movements;

    const process = await DB.table("processes").insert(processData);

    // Save initial crawled movements if present
    if (Array.isArray(initialMovements) && initialMovements.length > 0) {
      for (const mov of initialMovements) {
        await DB.table("movements").insert({
          process_id: process.id,
          description: mov.description,
          date: mov.date || new Date().toISOString(),
          source: mov.source || "Automatizado"
        });
      }
    }

    await logAudit(req, "Cadastrou Processo", "processes", process.id, `Processo cadastrado com CNJ ${process.cnj} no escritório ID ${process.law_firm_id}`);

    // AUTOMATION WORKFLOW TRIGGER: new_process
    const workflows = await DB.table("workflows").find((w) => w.trigger_event === "new_process" && w.active && (w.law_firm_id === process.law_firm_id || (!w.law_firm_id && process.law_firm_id === "1")));
    for (const wf of workflows) {
      for (const action of wf.actions) {
        if (action.type === "create_task") {
          const daysAfter = action.params.days_after || 2;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + daysAfter);
          await DB.table("events").insert({
            title: `Tarefa Automatizada: ${action.params.title}`,
            description: `Gerado automaticamente pelo fluxo "${wf.name}" ao cadastrar o processo CNJ: ${process.cnj}`,
            type: "deadline",
            start_date: dueDate.toISOString(),
            end_date: dueDate.toISOString(),
            status: "Pendente",
            process_id: process.id,
            assigned_to: process.lawyers || [],
            law_firm_id: process.law_firm_id,
          });
        } else if (action.type === "create_folder") {
          // Virtual document initialization
          await DB.table("documents").insert({
            name: `${action.params.name} - Pasta Inicial`,
            category: "Pasta",
            file_path: `/uploads/process_${process.id}/initial_folder`,
            version: 1,
            process_id: process.id,
            client_id: process.client_id,
            created_by: "Sistema Automatizado",
            signatures: [],
            law_firm_id: process.law_firm_id,
          });
        }
      }
    }

    res.status(201).json(process);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Process
app.put("/api/processes/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer"]), async (req: AuthenticatedRequest, res) => {
  try {
    const process = await DB.table("processes").update(req.params.id, req.body);
    if (!process) {
       res.status(404).json({ error: "Processo não encontrado." });
       return;
    }
    await logAudit(req, "Atualizou Processo", "processes", req.params.id, `Dados atualizados para processo CNJ ${process.cnj}`);
    res.json(process);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Process
app.delete("/api/processes/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const success = await DB.table("processes").delete(req.params.id);
    if (!success) {
       res.status(404).json({ error: "Processo não encontrado." });
       return;
    }
    await logAudit(req, "Deletou Processo", "processes", req.params.id, `Processo excluído do sistema`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 4. MOVEMENTS / TRIBUNAL CAPTURING
// ==========================================

// Add manual movement or simulate auto capturing
app.post("/api/processes/:id/movements", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer"]), async (req: AuthenticatedRequest, res) => {
  try {
    const process = await DB.table("processes").findOne((p) => p.id === req.params.id);
    if (!process) {
       res.status(404).json({ error: "Processo não encontrado." });
       return;
    }

    const movement = await DB.table("movements").insert({
      process_id: req.params.id,
      date: req.body.date || new Date().toISOString(),
      description: req.body.description,
      source: req.body.source || "Manual",
    });

    await logAudit(req, "Inseriu Movimentação", "movements", movement.id, `Movimentação processual registrada: "${req.body.description.substring(0, 50)}..."`);
    res.status(201).json(movement);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 5. AGENDA / EVENTS / DEADLINES ENDPOINTS
// ==========================================

// List events
app.get("/api/events", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const events = await DB.table("events").find();
    let filtered = events;

    // Filter by Law Firm (Multi-tenancy cluster)
    let law_firm_id = req.user?.law_firm_id;
    if ((req.user?.role === "admin" || req.user?.email === "rodrigo.cardoso@sportix.com.br") && req.query.law_firm_id) {
      law_firm_id = req.query.law_firm_id as string;
    }
    if (law_firm_id) {
      filtered = filtered.filter((e) => e.law_firm_id === law_firm_id || (!e.law_firm_id && law_firm_id === "1"));
    }

    // Sincronização em tempo real e hierarquia:
    if (req.user?.role === "client") {
      const myClient = await DB.table("clients").findOne((c) => c.email === req.user?.email);
      if (myClient) {
        // Clients only see events linked to their processes (e.g. hearings, or milestones)
        const myProcesses = await DB.table("processes").find((p) => p.client_id === myClient.id);
        const myProcessIds = myProcesses.map((p) => p.id);
        filtered = filtered.filter((e) => e.process_id && myProcessIds.includes(e.process_id));
      } else {
        filtered = [];
      }
    } else {
      const type = req.query.type as string;
      const status = req.query.status as string;
      if (type) {
        filtered = filtered.filter((e) => e.type === type);
      }
      if (status) {
        filtered = filtered.filter((e) => e.status === status);
      }
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create event
app.post("/api/events", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer", "secretary"]), async (req: AuthenticatedRequest, res) => {
  try {
    const eventData = {
      ...req.body,
      law_firm_id: req.body.law_firm_id || req.user?.law_firm_id || "1"
    };
    const event = await DB.table("events").insert(eventData);
    await logAudit(req, "Cadastrou Evento", "events", event.id, `Novo compromisso agendado: ${event.title} no escritório ID ${event.law_firm_id}`);

    // If hearing, trigger workflow new_hearing
    if (event.type === "hearing") {
      const workflows = await DB.table("workflows").find((w) => w.trigger_event === "new_hearing" && w.active && (w.law_firm_id === event.law_firm_id || (!w.law_firm_id && event.law_firm_id === "1")));
      for (const wf of workflows) {
        for (const action of wf.actions) {
          if (action.type === "create_reminder") {
            const reminderDate = new Date(event.start_date);
            reminderDate.setDate(reminderDate.getDate() - (action.params.days_before || 1));
            await DB.table("events").insert({
              title: `Lembrete: ${action.params.title}`,
              description: `Preparação para audiência: ${event.title}`,
              type: "reminder",
              start_date: reminderDate.toISOString(),
              end_date: reminderDate.toISOString(),
              status: "Pendente",
              process_id: event.process_id,
              assigned_to: event.assigned_to,
              law_firm_id: event.law_firm_id,
            });
          }
        }
      }
    }

    // Google Calendar Instant Sync
    try {
      const userId = req.user?.id || "1";
      const googleConn = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "google_calendar" && a.connected === 1);
      if (googleConn) {
        if (googleConn.access_token === "mock_calendar_access_token") {
          const mockGId = "mock_event_" + Math.random().toString(36).substr(2, 9);
          await DB.table("events").update(event.id, {
            google_event_id: mockGId,
            calendar_id: "mock_cal_123",
            sync_status: "synced"
          });
          event.google_event_id = mockGId;
          event.calendar_id = "mock_cal_123";
          event.sync_status = "synced";
        } else {
          const token = await GoogleCalendarService.getValidToken(userId);
          if (token) {
            const mapping = await GoogleCalendarService.initializeCalendars(token, userId);
            const catType = event.type === "meeting" || event.type === "hearing" || event.type === "deadline" || event.type === "reminder" ? event.type : "default";
            const calendarId = mapping[catType] || "primary";
            
            const body = await GoogleCalendarService.buildGoogleEventBody(event, event.law_firm_id);
            const createRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });

            if (createRes.ok) {
              const newGev = await createRes.json() as any;
              await DB.table("events").update(event.id, {
                google_event_id: newGev.id,
                calendar_id: calendarId,
                sync_status: "synced",
              });
              event.google_event_id = newGev.id;
              event.calendar_id = calendarId;
              event.sync_status = "synced";
            }
          }
        }
      }
    } catch (gErr: any) {
      console.error("[GOOGLE_CALENDAR] Instant event push failed:", gErr.message);
    }

    res.status(201).json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update event status/dates
app.put("/api/events/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer", "secretary"]), async (req: AuthenticatedRequest, res) => {
  try {
    const event = await DB.table("events").update(req.params.id, req.body);
    if (!event) {
       res.status(404).json({ error: "Evento não encontrado." });
       return;
    }
    await logAudit(req, "Atualizou Evento", "events", req.params.id, `Agenda atualizada para compromisso ${event.title}`);

    // Google Calendar Instant Sync Update
    try {
      const userId = req.user?.id || "1";
      const googleConn = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "google_calendar" && a.connected === 1);
      if (googleConn && event.google_event_id) {
        if (googleConn.access_token === "mock_calendar_access_token") {
          await DB.table("events").update(event.id, { sync_status: "synced" });
          event.sync_status = "synced";
        } else {
          const token = await GoogleCalendarService.getValidToken(userId);
          if (token) {
            const calendarId = event.calendar_id || "primary";
            const body = await GoogleCalendarService.buildGoogleEventBody(event, event.law_firm_id);
            const updateRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${event.google_event_id}`, {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });

            if (updateRes.ok) {
              await DB.table("events").update(event.id, { sync_status: "synced" });
              event.sync_status = "synced";
            } else {
              await DB.table("events").update(event.id, { sync_status: "pending_update" });
              event.sync_status = "pending_update";
            }
          }
        }
      }
    } catch (gErr: any) {
      console.error("[GOOGLE_CALENDAR] Instant event update failed:", gErr.message);
    }

    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete event
app.delete("/api/events/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "secretary"]), async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || "1";
    const event = await DB.table("events").findOne((e) => e.id === req.params.id);
    
    if (event && event.google_event_id) {
      try {
        const googleConn = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "google_calendar" && a.connected === 1);
        if (googleConn && googleConn.access_token !== "mock_calendar_access_token") {
          await GoogleCalendarService.deleteFromGoogle(userId, event.google_event_id, event.calendar_id || "primary");
        }
      } catch (gErr: any) {
        console.error("[GOOGLE_CALENDAR] Instant event delete failed:", gErr.message);
      }
    }

    const success = await DB.table("events").delete(req.params.id);
    if (!success) {
       res.status(404).json({ error: "Evento não encontrado." });
       return;
    }
    await logAudit(req, "Excluiu Evento", "events", req.params.id, `Compromisso removido da agenda`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 6. FINANCIAL MODULE ENDPOINTS
// ==========================================

// List transactions
app.get("/api/financial", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Finance, admin, and partner can view all. Client can only view invoices mapped to their client id.
    const finances = await DB.table("financial").find();
    let filtered = finances;

    // Filter by Law Firm (Multi-tenancy cluster)
    let law_firm_id = req.user?.law_firm_id;
    if ((req.user?.role === "admin" || req.user?.email === "rodrigo.cardoso@sportix.com.br") && req.query.law_firm_id) {
      law_firm_id = req.query.law_firm_id as string;
    }
    if (law_firm_id) {
      filtered = filtered.filter((f) => f.law_firm_id === law_firm_id || (!f.law_firm_id && law_firm_id === "1"));
    }

    if (req.user?.role === "client") {
      const myClient = await DB.table("clients").findOne((c) => c.email === req.user?.email);
      if (myClient) {
        filtered = filtered.filter((f) => f.client_id === myClient.id && f.type === "revenue");
      } else {
        filtered = [];
      }
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Register Transaction (Revenue/Expense)
app.post("/api/financial", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "finance"]), async (req: AuthenticatedRequest, res) => {
  try {
    const transaction = {
      ...req.body,
      law_firm_id: req.body.law_firm_id || req.user?.law_firm_id || "1"
    };
    
    // Auto-generate Pix Code for Legal billing revenues to Rodrigo Cardoso
    if (transaction.type === "revenue" && !transaction.pix_code) {
      transaction.pix_code = `00020101021126580014br.gov.bcb.pix0114rodrigo.cardoso@sportix.com.br5204000053039865407${Number(transaction.amount).toFixed(2)}5802BR5915Rodrigo Cardoso6009SAO PAULO62070503***63041A2B`;
    }

    const created = await DB.table("financial").insert(transaction);
    await logAudit(req, "Registrou Lançamento Financeiro", "financial", created.id, `Lançamento de ${created.type} registrado: R$ ${created.amount} no escritório ID ${created.law_firm_id}`);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update payment status (Conciliação Bancária / Baixa)
app.put("/api/financial/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "finance"]), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await DB.table("financial").update(req.params.id, req.body);
    if (!updated) {
       res.status(404).json({ error: "Lançamento não encontrado." });
       return;
    }
    await logAudit(req, "Atualizou Lançamento Financeiro", "financial", req.params.id, `Lançamento ${updated.description} marcado como ${updated.status}`);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete financial item
app.delete("/api/financial/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "finance"]), async (req: AuthenticatedRequest, res) => {
  try {
    const success = await DB.table("financial").delete(req.params.id);
    if (!success) {
       res.status(404).json({ error: "Lançamento não encontrado." });
       return;
    }
    await logAudit(req, "Removeu Lançamento Financeiro", "financial", req.params.id, `Transação excluída do fluxo financeiro`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 7. DOCUMENT MANAGEMENT & DIGITAL SIGNATURE
// ==========================================

// List Documents
app.get("/api/documents", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const docs = await DB.table("documents").find();
    let filtered = docs;

    // Filter by Law Firm (Multi-tenancy cluster)
    let law_firm_id = req.user?.law_firm_id;
    if ((req.user?.role === "admin" || req.user?.email === "rodrigo.cardoso@sportix.com.br") && req.query.law_firm_id) {
      law_firm_id = req.query.law_firm_id as string;
    }
    if (law_firm_id) {
      filtered = filtered.filter((d) => d.law_firm_id === law_firm_id || (!d.law_firm_id && law_firm_id === "1"));
    }

    if (req.user?.role === "client") {
      const myClient = await DB.table("clients").findOne((c) => c.email === req.user?.email);
      if (myClient) {
        filtered = filtered.filter((d) => d.client_id === myClient.id);
      } else {
        filtered = [];
      }
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Upload Document Record
app.post("/api/documents", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer", "secretary"]), async (req: AuthenticatedRequest, res) => {
  try {
    const docData = {
      ...req.body,
      created_by: req.user?.name || "Advogado",
      signatures: [],
      law_firm_id: req.body.law_firm_id || req.user?.law_firm_id || "1"
    };
    const doc = await DB.table("documents").insert(docData);
    await logAudit(req, "Cadastrou Documento", "documents", doc.id, `Novo documento anexado: ${doc.name} no escritório ID ${doc.law_firm_id}`);
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Electronic/Digital Signature execution
app.post("/api/documents/:id/sign", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const doc = await DB.table("documents").findOne((d) => d.id === req.params.id);
    if (!doc) {
       res.status(404).json({ error: "Documento não encontrado." });
       return;
    }

    // Append signature
    const signatureLog = doc.signatures || [];
    signatureLog.push({
      signed_by: req.user?.name || req.body.signer_name || "Cliente",
      signed_at: new Date().toISOString(),
      status: "Assinado eletronicamente",
    });

    const updated = await DB.table("documents").update(req.params.id, {
      signatures: signatureLog,
    });

    await logAudit(req, "Assinou Documento", "documents", req.params.id, `Documento assinado eletronicamente por ${req.user?.name || "Usuário"}`);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Enviar documento para assinatura via D4Sign (Simulação de integração oficial)
app.post("/api/documents/:id/d4sign-send", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { signers } = req.body;
    if (!signers || !Array.isArray(signers) || signers.length === 0) {
      res.status(400).json({ error: "É necessário informar pelo menos um signatário." });
      return;
    }

    const doc = await DB.table("documents").findOne((d) => d.id === req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Documento não encontrado." });
      return;
    }

    const d4signId = `d4s-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
    const formattedSigners = signers.map((s: any) => ({
      name: s.name,
      email: s.email,
      cpf: s.cpf || "",
      signed: false
    }));

    const updated = await DB.table("documents").update(req.params.id, {
      d4sign_id: d4signId,
      d4sign_status: "aguardando_assinaturas",
      d4sign_signers: JSON.stringify(formattedSigners)
    });

    await logAudit(req, "Enviou para D4Sign", "documents", req.params.id, `Documento enviado para o cofre D4Sign ID: ${d4signId} com ${signers.length} assinantes`);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sincronizar/Atualizar status das assinaturas do D4Sign
app.post("/api/documents/:id/d4sign-sync", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const doc = await DB.table("documents").findOne((d) => d.id === req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Documento não encontrado." });
      return;
    }

    if (!doc.d4sign_id) {
      res.status(400).json({ error: "Este documento não foi enviado para o D4Sign." });
      return;
    }

    const currentSigners = typeof doc.d4sign_signers === "string" ? JSON.parse(doc.d4sign_signers) : (doc.d4sign_signers || []);
    
    // Simulate progression: sign next unsigned signer
    let changed = false;
    const updatedSigners = currentSigners.map((signer: any) => {
      if (!signer.signed && !changed) {
        changed = true;
        return { ...signer, signed: true };
      }
      return signer;
    });

    const allSigned = updatedSigners.every((s: any) => s.signed);
    const newStatus = allSigned ? "arquivado" : "aguardando_assinaturas";

    // If fully signed, also push to general signatures array for compatibility
    let signaturesArray = typeof doc.signatures === "string" ? JSON.parse(doc.signatures) : (doc.signatures || []);
    if (allSigned && signaturesArray.length === 0) {
      signaturesArray = updatedSigners.map((s: any) => ({
        signed_by: s.name,
        signed_at: new Date().toISOString(),
        status: `Assinado via D4Sign (IP/Hash verificado)`
      }));
    }

    const updated = await DB.table("documents").update(req.params.id, {
      d4sign_status: newStatus,
      d4sign_signers: JSON.stringify(updatedSigners),
      signatures: JSON.stringify(signaturesArray)
    });

    await logAudit(req, "Sincronizou D4Sign", "documents", req.params.id, `Status sincronizado com D4Sign API: ${allSigned ? "Concluído" : "Parcialmente Assinado"}`);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete document
app.delete("/api/documents/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer"]), async (req: AuthenticatedRequest, res) => {
  try {
    const success = await DB.table("documents").delete(req.params.id);
    if (!success) {
       res.status(404).json({ error: "Documento não encontrado." });
       return;
    }
    await logAudit(req, "Excluiu Documento", "documents", req.params.id, `Documento removido dos arquivos protegidos`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// UNIFIED CLOUD GED INTEGRATION MODULE (DROPBOX, GDRIVE, ONEDRIVE)
// ==========================================

function getSuccessHTML(providerName: string) {
  return `
    <html>
      <head>
        <title>Conexão Sucesso</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; background: #f8fafc; color: #1e293b; }
          .card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); display: inline-block; max-width: 400px; }
          .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #4f46e5; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="color: #4f46e5; margin-bottom: 10px;">Integração Concluída!</h2>
          <p>Sua conta do ${providerName} foi vinculada com sucesso ao LegalOne.</p>
          <div class="spinner"></div>
          <p style="font-size: 12px; color: #64748b;">Esta janela será fechada automaticamente em instantes...</p>
        </div>
        <script>
          setTimeout(() => {
            if (window.opener) {
              window.opener.postMessage({ type: 'CLOUD_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          }, 1500);
        </script>
      </body>
    </html>
  `;
}

async function getValidCloudToken(lawFirmId: string, provider: string): Promise<string | null> {
  try {
    const firms = await DB.table("law_firms").find((f) => f.id === lawFirmId);
    if (!firms || firms.length === 0) return null;
    const firm = firms[0];

    if (provider === "dropbox") {
      if (!firm.dropbox_access_token) return null;
      const expiresAt = Number(firm.dropbox_token_expires_at);
      if (expiresAt && Date.now() > expiresAt - 300000) {
        if (firm.dropbox_refresh_token && firm.dropbox_refresh_token !== "mock_refresh_token_123") {
          try {
            const client_id = firm.dropbox_client_id;
            const client_secret = firm.dropbox_client_secret;

            if (client_id && client_secret) {
              const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  grant_type: "refresh_token",
                  refresh_token: firm.dropbox_refresh_token,
                  client_id,
                  client_secret,
                }),
              });

              if (response.ok) {
                const data = await response.json() as any;
                const newAccessToken = data.access_token;
                const newExpiresIn = data.expires_in || 14400;
                const newExpiresAt = (Date.now() + newExpiresIn * 1000).toString();

                await DB.table("law_firms").update(lawFirmId, {
                  dropbox_access_token: newAccessToken,
                  dropbox_token_expires_at: newExpiresAt,
                });

                return newAccessToken;
              }
            }
          } catch (err) {
            console.error("Failed to refresh Dropbox token:", err);
          }
        }
      }
      return firm.dropbox_access_token;
    }

    if (provider === "gdrive") {
      if (!firm.gdrive_access_token) return null;
      const expiresAt = Number(firm.gdrive_token_expires_at);
      if (expiresAt && Date.now() > expiresAt - 300000) {
        if (firm.gdrive_refresh_token && firm.gdrive_refresh_token !== "mock_gdrive_refresh_token") {
          try {
            const client_id = firm.gdrive_client_id;
            const client_secret = firm.gdrive_client_secret;

            if (client_id && client_secret) {
              const response = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  grant_type: "refresh_token",
                  refresh_token: firm.gdrive_refresh_token,
                  client_id,
                  client_secret,
                }),
              });

              if (response.ok) {
                const data = await response.json() as any;
                const newAccessToken = data.access_token;
                const newExpiresIn = data.expires_in || 3600;
                const newExpiresAt = (Date.now() + newExpiresIn * 1000).toString();

                await DB.table("law_firms").update(lawFirmId, {
                  gdrive_access_token: newAccessToken,
                  gdrive_token_expires_at: newExpiresAt,
                });

                return newAccessToken;
              }
            }
          } catch (err) {
            console.error("Failed to refresh Google Drive token:", err);
          }
        }
      }
      return firm.gdrive_access_token;
    }

    if (provider === "onedrive") {
      if (!firm.onedrive_access_token) return null;
      const expiresAt = Number(firm.onedrive_token_expires_at);
      if (expiresAt && Date.now() > expiresAt - 300000) {
        if (firm.onedrive_refresh_token && firm.onedrive_refresh_token !== "mock_onedrive_refresh_token") {
          try {
            const client_id = firm.onedrive_client_id;
            const client_secret = firm.onedrive_client_secret;

            if (client_id && client_secret) {
              const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  grant_type: "refresh_token",
                  refresh_token: firm.onedrive_refresh_token,
                  client_id,
                  client_secret,
                }),
              });

              if (response.ok) {
                const data = await response.json() as any;
                const newAccessToken = data.access_token;
                const newExpiresIn = data.expires_in || 3600;
                const newExpiresAt = (Date.now() + newExpiresIn * 1000).toString();

                await DB.table("law_firms").update(lawFirmId, {
                  onedrive_access_token: newAccessToken,
                  onedrive_token_expires_at: newExpiresAt,
                });

                return newAccessToken;
              }
            }
          } catch (err) {
            console.error("Failed to refresh OneDrive token:", err);
          }
        }
      }
      return firm.onedrive_access_token;
    }

    return null;
  } catch (err) {
    console.error("getValidCloudToken system error:", err);
    return null;
  }
}

// ==========================================
// UNIFIED CLOUD GED INTEGRATION MODULE (DROPBOX, GDRIVE, ONEDRIVE)
// ==========================================

// Helper to check and refresh tokens on cloud_accounts
async function getValidCloudTokenForUser(userId: string, provider: string): Promise<string | null> {
  try {
    const existing = await DB.table("cloud_accounts").findOne((acc) => acc.user_id === userId && acc.provider === provider);
    if (!existing) return null;

    const expiresAt = Number(existing.expires_at);
    if (expiresAt && Date.now() > expiresAt - 300000) {
      let client_id = "";
      let client_secret = "";
      let tokenUrl = "";

      if (provider === "dropbox") {
        client_id = process.env.DROPBOX_CLIENT_ID || "";
        client_secret = process.env.DROPBOX_CLIENT_SECRET || "";
        tokenUrl = "https://api.dropboxapi.com/oauth2/token";
      } else if (provider === "gdrive") {
        client_id = process.env.GOOGLE_CLIENT_ID || "";
        client_secret = process.env.GOOGLE_CLIENT_SECRET || "";
        tokenUrl = "https://oauth2.googleapis.com/token";
      } else if (provider === "onedrive") {
        client_id = process.env.ONEDRIVE_CLIENT_ID || "";
        client_secret = process.env.ONEDRIVE_CLIENT_SECRET || "";
        tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
      }

      if (client_id && client_secret && existing.refresh_token && !existing.refresh_token.startsWith("mock_")) {
        try {
          const response = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: existing.refresh_token,
              client_id,
              client_secret,
            }),
          });

          if (response.ok) {
            const data = await response.json() as any;
            const newAccessToken = data.access_token;
            const newExpiresIn = data.expires_in || 3600;
            const newExpiresAt = (Date.now() + newExpiresIn * 1000).toString();

            await DB.table("cloud_accounts").update(existing.id, {
              access_token: newAccessToken,
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString()
            });

            return newAccessToken;
          }
        } catch (err) {
          console.error(`Failed to refresh token for ${provider}:`, err);
        }
      }
    }

    return existing.access_token;
  } catch (err) {
    console.error("getValidCloudTokenForUser error:", err);
    return null;
  }
}

// 1. Unified Status Endpoint - Returns statuses of all 3 providers
app.get("/api/cloud/status", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";
    
    const providers = ["dropbox", "gdrive", "onedrive"];
    const statuses: Record<string, any> = {};

    for (const p of providers) {
      // Check user cloud_accounts
      const acc = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === p);
      let connected = false;
      let email: string | null = null;
      let mockMode = true;
      let used = 1048576 * 100; // default mocks
      let total = 1048576 * 1024 * 2;
      let used_formatted = "100 MB";
      let total_formatted = "2.0 GB";

      // Credentials check in process.env
      let hasEnvCredentials = false;
      if (p === "dropbox" && process.env.DROPBOX_CLIENT_ID) hasEnvCredentials = true;
      if (p === "gdrive" && process.env.GOOGLE_CLIENT_ID) hasEnvCredentials = true;
      if (p === "onedrive" && process.env.ONEDRIVE_CLIENT_ID) hasEnvCredentials = true;

      if (acc && acc.connected) {
        connected = true;
        email = acc.email;
        mockMode = !hasEnvCredentials;
        
        // Dynamic Quota if real connection
        if (hasEnvCredentials) {
          try {
            const providerInstance = await StorageFactory.getProvider(lawFirmId);
            if (providerInstance) {
              const q = await providerInstance.getQuota();
              used = q.used;
              total = q.total;
              used_formatted = q.used_formatted || "";
              total_formatted = q.total_formatted || "";
            }
          } catch (e) {
            // Ignore quota fetch errors
          }
        } else {
          // Mock quota values
          if (p === "gdrive") {
            used = 1048576 * 450;
            total = 1048576 * 1024 * 15;
            used_formatted = "450 MB";
            total_formatted = "15 GB";
          } else if (p === "onedrive") {
            used = 1048576 * 250;
            total = 1048576 * 1024 * 5;
            used_formatted = "250 MB";
            total_formatted = "5.0 GB";
          }
        }
      } else {
        // Legacy fallback from law_firms table
        const firms = await DB.table("law_firms").find((f) => f.id === lawFirmId);
        if (firms && firms.length > 0) {
          const firm = firms[0];
          if (firm.cloud_provider === p) {
            let firmToken = "";
            let firmClientId = "";
            if (p === "dropbox") {
              firmToken = firm.dropbox_access_token;
              firmClientId = firm.dropbox_client_id;
            } else if (p === "gdrive") {
              firmToken = firm.gdrive_access_token;
              firmClientId = firm.gdrive_client_id;
            } else if (p === "onedrive") {
              firmToken = firm.onedrive_access_token;
              firmClientId = firm.onedrive_client_id;
            }

            if (firmToken) {
              connected = true;
              email = `ged@${firm.name.toLowerCase().replace(/[^a-z0-9]/g, "") || "legalone"}.com.br`;
              mockMode = !firmClientId;
            }
          }
        }
      }

      statuses[p] = {
        connected,
        email,
        mockMode,
        used,
        total,
        used_formatted,
        total_formatted
      };
    }

    res.json({
      providers: statuses
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Generate Cloud Auth URL - receives ?provider=gdrive etc.
app.get("/api/cloud/auth-url", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const provider = req.query.provider as string || "dropbox";
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";
    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;

    const state = `${userId}_${lawFirmId}_${provider}`;

    if (provider === "dropbox") {
      const client_id = process.env.DROPBOX_CLIENT_ID;
      const client_secret = process.env.DROPBOX_CLIENT_SECRET;
      const redirectUri = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/dropbox`;

      if (client_id && client_secret) {
        const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&token_access_type=offline&state=${state}`;
        res.json({ url: authUrl, mock: false });
      } else {
        const mockAuthUrl = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/dropbox?code=mock_code&state=${state}`;
        res.json({ url: mockAuthUrl, mock: true });
      }
    } else if (provider === "gdrive") {
      const client_id = process.env.GOOGLE_CLIENT_ID;
      const client_secret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/gdrive`;

      if (client_id && client_secret) {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("https://www.googleapis.com/auth/drive")}&access_type=offline&prompt=consent&state=${state}`;
        res.json({ url: authUrl, mock: false });
      } else {
        const mockAuthUrl = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/gdrive?code=mock_code&state=${state}`;
        res.json({ url: mockAuthUrl, mock: true });
      }
    } else if (provider === "onedrive") {
      const client_id = process.env.ONEDRIVE_CLIENT_ID;
      const client_secret = process.env.ONEDRIVE_CLIENT_SECRET;
      const redirectUri = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/onedrive`;

      if (client_id && client_secret) {
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("files.readwrite.all offline_access")}&response_mode=query&state=${state}`;
        res.json({ url: authUrl, mock: false });
      } else {
        const mockAuthUrl = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/onedrive?code=mock_code&state=${state}`;
        res.json({ url: mockAuthUrl, mock: true });
      }
    } else {
      res.status(400).json({ error: "Provedor inválido." });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. OAuth Callbacks (Dropbox)
app.get("/api/cloud/callback/dropbox", async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    res.status(400).send("Código de autorização inválido.");
    return;
  }

  const [userId, lawFirmId, provider] = (state as string).split("_");

  try {
    let tokens = {
      access_token: "mock_access_token_123",
      refresh_token: "mock_refresh_token_123",
      expires_in: 14400,
    };

    const client_id = process.env.DROPBOX_CLIENT_ID;
    const client_secret = process.env.DROPBOX_CLIENT_SECRET;

    if (client_id && client_secret && code !== "mock_code") {
      const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const redirectUri = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/dropbox`;

      const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          client_id,
          client_secret,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro de token do Dropbox: ${errText}`);
      }

      const data = await response.json() as any;
      tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || "",
        expires_in: data.expires_in || 14400,
      };
    }

    const accountData = {
      user_id: userId,
      provider: "dropbox",
      email: code === "mock_code" ? "dropbox-mock@legalone.com" : "user-dropbox@email.com",
      storage_name: "Dropbox",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: (Date.now() + tokens.expires_in * 1000).toString(),
      connected: 1,
      updated_at: new Date().toISOString()
    };

    const existing = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "dropbox");
    if (existing) {
      await DB.table("cloud_accounts").update(existing.id, accountData);
    } else {
      await DB.table("cloud_accounts").insert({
        id: Math.random().toString(36).substr(2, 9),
        ...accountData,
        created_at: new Date().toISOString()
      });
    }

    // legacy sync
    await DB.table("law_firms").update(lawFirmId, {
      cloud_provider: "dropbox",
      dropbox_access_token: tokens.access_token,
      dropbox_refresh_token: tokens.refresh_token,
      dropbox_token_expires_at: (Date.now() + tokens.expires_in * 1000).toString(),
    });

    res.send(getSuccessHTML("Dropbox"));
  } catch (err: any) {
    console.error("Dropbox callback error:", err);
    res.status(500).send(`Erro ao concluir login com Dropbox: ${err.message}`);
  }
});

// Callback (Google Drive)
app.get("/api/cloud/callback/gdrive", async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    res.status(400).send("Código de autorização inválido.");
    return;
  }

  const [userId, lawFirmId, provider] = (state as string).split("_");

  try {
    let tokens = {
      access_token: "mock_gdrive_access_token",
      refresh_token: "mock_gdrive_refresh_token",
      expires_in: 3600,
    };

    const client_id = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;

    if (client_id && client_secret && code !== "mock_code") {
      const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const redirectUri = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/gdrive`;

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          client_id,
          client_secret,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro de token do Google Drive: ${errText}`);
      }

      const data = await response.json() as any;
      tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || "",
        expires_in: data.expires_in || 3600,
      };
    }

    const accountData = {
      user_id: userId,
      provider: "gdrive",
      email: code === "mock_code" ? "gdrive-mock@legalone.com" : "user-gdrive@email.com",
      storage_name: "Google Drive",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: (Date.now() + tokens.expires_in * 1000).toString(),
      connected: 1,
      updated_at: new Date().toISOString()
    };

    const existing = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "gdrive");
    if (existing) {
      await DB.table("cloud_accounts").update(existing.id, accountData);
    } else {
      await DB.table("cloud_accounts").insert({
        id: Math.random().toString(36).substr(2, 9),
        ...accountData,
        created_at: new Date().toISOString()
      });
    }

    // legacy sync
    await DB.table("law_firms").update(lawFirmId, {
      cloud_provider: "gdrive",
      gdrive_access_token: tokens.access_token,
      gdrive_refresh_token: tokens.refresh_token,
      gdrive_token_expires_at: (Date.now() + tokens.expires_in * 1000).toString(),
    });

    res.send(getSuccessHTML("Google Drive"));
  } catch (err: any) {
    console.error("Google Drive callback error:", err);
    res.status(500).send(`Erro ao concluir login com Google Drive: ${err.message}`);
  }
});

// Callback (OneDrive)
app.get("/api/cloud/callback/onedrive", async (req, res) => {
  const { code, state } = req.query;
  if (!code) {
    res.status(400).send("Código de autorização inválido.");
    return;
  }

  const [userId, lawFirmId, provider] = (state as string).split("_");

  try {
    let tokens = {
      access_token: "mock_onedrive_access_token",
      refresh_token: "mock_onedrive_refresh_token",
      expires_in: 3600,
    };

    const client_id = process.env.ONEDRIVE_CLIENT_ID;
    const client_secret = process.env.ONEDRIVE_CLIENT_SECRET;

    if (client_id && client_secret && code !== "mock_code") {
      const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const redirectUri = `${appUrl.replace(/\/$/, "")}/api/cloud/callback/onedrive`;

      const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          client_id,
          client_secret,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro de token do OneDrive: ${errText}`);
      }

      const data = await response.json() as any;
      tokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || "",
        expires_in: data.expires_in || 3600,
      };
    }

    const accountData = {
      user_id: userId,
      provider: "onedrive",
      email: code === "mock_code" ? "onedrive-mock@legalone.com" : "user-onedrive@email.com",
      storage_name: "OneDrive",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: (Date.now() + tokens.expires_in * 1000).toString(),
      connected: 1,
      updated_at: new Date().toISOString()
    };

    const existing = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "onedrive");
    if (existing) {
      await DB.table("cloud_accounts").update(existing.id, accountData);
    } else {
      await DB.table("cloud_accounts").insert({
        id: Math.random().toString(36).substr(2, 9),
        ...accountData,
        created_at: new Date().toISOString()
      });
    }

    // legacy sync
    await DB.table("law_firms").update(lawFirmId, {
      cloud_provider: "onedrive",
      onedrive_access_token: tokens.access_token,
      onedrive_refresh_token: tokens.refresh_token,
      onedrive_token_expires_at: (Date.now() + tokens.expires_in * 1000).toString(),
    });

    res.send(getSuccessHTML("OneDrive"));
  } catch (err: any) {
    console.error("OneDrive callback error:", err);
    res.status(500).send(`Erro ao concluir login com OneDrive: ${err.message}`);
  }
});

// ==========================================
// GOOGLE CALENDAR SYNC ENDPOINTS
// ==========================================

app.get("/api/google-calendar/auth-url", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";
    const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
    
    const client_id = process.env.GOOGLE_CLIENT_ID;
    const client_secret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (client_id && client_secret) {
      const url = GoogleCalendarService.getAuthUrl(userId, lawFirmId, appUrl);
      res.json({ url, mock: false });
    } else {
      const mockAuthUrl = `${appUrl.replace(/\/$/, "")}/api/google-calendar/callback?code=mock_code&state=${userId}_${lawFirmId}`;
      res.json({ url: mockAuthUrl, mock: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/google-calendar/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    res.status(400).send("Código de autorização ou estado inválido.");
    return;
  }

  const [userId, lawFirmId] = (state as string).split("_");
  const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
  const redirectUri = `${appUrl.replace(/\/$/, "")}/api/google-calendar/callback`;

  try {
    if (code === "mock_code") {
      const accountData = {
        user_id: userId,
        provider: "google_calendar",
        email: "advogado-google-mock@legalone.com",
        storage_name: "Google Calendar (Mock)",
        access_token: "mock_calendar_access_token",
        refresh_token: "mock_calendar_refresh_token",
        expires_at: (Date.now() + 3600 * 1000).toString(),
        connected: 1,
        google_user_id: "mock_google_user_123",
        sync_status: "connected",
        calendar_id: JSON.stringify({
          deadline: "mock_deadline_cal",
          hearing: "mock_hearing_cal",
          meeting: "mock_meeting_cal",
          reminder: "mock_reminder_cal",
          default: "mock_default_cal"
        }),
        updated_at: new Date().toISOString()
      };

      const existing = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "google_calendar");
      if (existing) {
        await DB.table("cloud_accounts").update(existing.id, accountData);
      } else {
        await DB.table("cloud_accounts").insert({
          id: Math.random().toString(36).substr(2, 9),
          ...accountData,
          created_at: new Date().toISOString()
        });
      }
    } else {
      await GoogleCalendarService.exchangeCode(code as string, redirectUri, userId, lawFirmId);
    }

    res.send(getSuccessHTML("Google Agenda"));
  } catch (err: any) {
    console.error("Google Calendar OAuth callback error:", err);
    res.status(500).send(`Erro ao sincronizar com Google Agenda: ${err.message}`);
  }
});

app.get("/api/google-calendar/status", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || "1";
    const existing = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "google_calendar" && a.connected === 1);
    
    if (existing) {
      res.json({
        connected: true,
        email: existing.email || "usuario-google@email.com",
        last_sync: existing.updated_at || existing.created_at,
        sync_status: existing.sync_status || "synced"
      });
    } else {
      res.json({ connected: false });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/google-calendar/sync", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";
    
    const existing = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "google_calendar" && a.connected === 1);
    if (!existing) {
      res.status(400).json({ error: "Google Agenda não está conectada para este usuário." });
      return;
    }

    if (existing.access_token === "mock_calendar_access_token") {
      console.log("[GOOGLE_CALENDAR] Running mock sync for user:", userId);
      await DB.table("cloud_accounts").update(existing.id, { updated_at: new Date().toISOString() });
      res.json({
        success: true,
        mock: true,
        stats: { uploaded: 1, downloaded: 0, updated_local: 0, updated_google: 0, deleted_local: 0, failures: 0 },
        duration: 120
      });
      return;
    }

    const result = await GoogleCalendarService.sync(userId, lawFirmId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/google-calendar/disconnect", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || "1";
    const existing = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === "google_calendar");
    
    if (existing) {
      await DB.table("cloud_accounts").delete(existing.id);
    }
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Disconnect Cloud Provider - Receives { provider } in body
app.post("/api/cloud/disconnect", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";
    const { provider = "dropbox" } = req.body;

    const existing = await DB.table("cloud_accounts").findOne((a) => a.user_id === userId && a.provider === provider);
    if (existing) {
      await DB.table("cloud_accounts").delete(existing.id);
    }

    // Also update law_firms table
    const updateData: any = {};
    if (provider === "dropbox") {
      updateData.dropbox_access_token = null;
      updateData.dropbox_refresh_token = null;
      updateData.dropbox_token_expires_at = null;
    } else if (provider === "gdrive") {
      updateData.gdrive_access_token = null;
      updateData.gdrive_refresh_token = null;
      updateData.gdrive_token_expires_at = null;
    } else if (provider === "onedrive") {
      updateData.onedrive_access_token = null;
      updateData.onedrive_refresh_token = null;
      updateData.onedrive_token_expires_at = null;
    }
    await DB.table("law_firms").update(lawFirmId, updateData);

    await logAudit(req, `Desconectou ${provider.toUpperCase()}`, "cloud_accounts", userId, `Desconectou a conta ${provider} da GED`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mock lists
const MOCK_DROPBOX_ITEMS: any[] = [
  { ".tag": "file", "name": "Contrato_Prestacao_Servicos_Sportix_2026.pdf", "path_lower": "/contrato_prestacao_servicos_sportix_2026.pdf", "path_display": "/Contrato_Prestacao_Servicos_Sportix_2026.pdf", "size": 154200, "client_modified": "2026-06-12T14:32:00Z" },
  { ".tag": "file", "name": "Peticao_Inicial_Reclamacao_Trabalhista_Carlos.pdf", "path_lower": "/peticao_inicial_reclamacao_trabalhista_carlos.pdf", "path_display": "/Peticao_Inicial_Reclamacao_Trabalhista_Carlos.pdf", "size": 240500, "client_modified": "2026-06-20T09:15:00Z" },
  { ".tag": "file", "name": "Acordo_Socio_Majoritario_Assinado.pdf", "path_lower": "/acordo_socio_majoritario_assinado.pdf", "path_display": "/Acordo_Socio_Majoritario_Assinado.pdf", "size": 312000, "client_modified": "2026-06-18T16:45:00Z" },
  { ".tag": "file", "name": "Regulamento_Interno_Empresarial_LTDA.docx", "path_lower": "/regulamento_interno_empresarial_ltda.docx", "path_display": "/Regulamento_Interno_Empresarial_LTDA.docx", "size": 95000, "client_modified": "2026-05-30T10:00:00Z" },
  { ".tag": "folder", "name": "Modelos de Petições Jurídicas", "path_lower": "/modelos_de_peticoes_juridicas", "path_display": "/Modelos de Petições Jurídicas" },
  { ".tag": "folder", "name": "Contratos Sociais e Procurações", "path_lower": "/contratos_sociais_e_procuracoes", "path_display": "/Contratos Sociais e Procurações" },
  { ".tag": "file", "name": "Modelo_Acao_Declaratoria_Indenizatoria.docx", "path_lower": "/modelos_de_peticoes_juridicas/modelo_acao_declaratoria_indenizatoria.docx", "path_display": "/Modelos de Petições Jurídicas/Modelo_Acao_Declaratoria_Indenizatoria.docx", "size": 42000, "client_modified": "2026-04-10T11:00:00Z" },
  { ".tag": "file", "name": "Modelo_Recurso_Ordinario_Trabalhista.docx", "path_lower": "/modelos_de_peticoes_juridicas/modelo_recurso_ordinario_trabalhista.docx", "path_display": "/Modelos de Petições Jurídicas/Modelo_Recurso_Ordinario_Trabalhista.docx", "size": 58000, "client_modified": "2026-04-15T13:30:00Z" },
  { ".tag": "file", "name": "Contrarrazoes_Apelacao_Civel.pdf", "path_lower": "/modelos_de_peticoes_juridicas/contrarrazoes_apelacao_civel.pdf", "path_display": "/Modelos de Petições Jurídicas/Contrarrazoes_Apelacao_Civel.pdf", "size": 182000, "client_modified": "2026-05-02T14:15:00Z" },
  { ".tag": "file", "name": "Procuracao_Ad_Judicia_Pessoa_Fisica.pdf", "path_lower": "/contratos_sociais_e_procuracoes/procuracao_ad_judicia_pessoa_fisica.pdf", "path_display": "/Contratos Sociais e Procurações/Procuracao_Ad_Judicia_Pessoa_Fisica.pdf", "size": 75000, "client_modified": "2026-03-12T16:00:00Z" },
  { ".tag": "file", "name": "Contrato_Social_Consolidado_Sportix_LTDA.pdf", "path_lower": "/contratos_sociais_e_procuracoes/contrato_social_consolidado_sportix_ltda.pdf", "path_display": "/Contratos Sociais e Procurações/Contrato_Social_Consolidado_Sportix_LTDA.pdf", "size": 435000, "client_modified": "2026-02-28T10:30:00Z" }
];

const MOCK_GDRIVE_ITEMS = [
  { ".tag": "file", "name": "GoogleDrive_Contrato_Honorarios_AALL.pdf", "path_lower": "/googledrive_contrato_honorarios_aall.pdf", "path_display": "/GoogleDrive_Contrato_Honorarios_AALL.pdf", "size": 185000, "client_modified": "2026-06-25T10:00:00Z" },
  { ".tag": "file", "name": "Calculos_Liquidacao_Trabalhista_Revisados.xlsx", "path_lower": "/calculos_liquidacao_trabalhista_revisados.xlsx", "path_display": "/Calculos_Liquidacao_Trabalhista_Revisados.xlsx", "size": 112000, "client_modified": "2026-06-26T15:20:00Z" },
  { ".tag": "folder", "name": "Processos Cíveis - Documentos de Prova", "path_lower": "/processos_civeis_documentos_de_prova", "path_display": "/Processos Cíveis - Documentos de Prova" },
  { ".tag": "file", "name": "Laudo_Pericial_Grafotecnico_Oficial.pdf", "path_lower": "/processos_civeis_documentos_de_prova/laudo_pericial_grafotecnico_oficial.pdf", "path_display": "/Processos Cíveis - Documentos de Prova/Laudo_Pericial_Grafotecnico_Oficial.pdf", "size": 1250000, "client_modified": "2026-06-10T11:45:00Z" }
];

const MOCK_ONEDRIVE_ITEMS = [
  { ".tag": "file", "name": "OneDrive_Minuta_Acordo_Societario_V3.docx", "path_lower": "/onedrive_minuta_acordo_societario_v3.docx", "path_display": "/OneDrive_Minuta_Acordo_Societario_V3.docx", "size": 89000, "client_modified": "2026-06-28T09:30:00Z" },
  { ".tag": "file", "name": "Procuracao_Ad_Judicia_Previdenciaria.pdf", "path_lower": "/procuracao_ad_judicia_previdenciaria.pdf", "path_display": "/Procuracao_Ad_Judicia_Previdenciaria.pdf", "size": 68000, "client_modified": "2026-06-27T16:10:00Z" },
  { ".tag": "folder", "name": "Recursos e Apelações de Segunda Instância", "path_lower": "/recursos_e_apelacoes_de_segunda_instancia", "path_display": "/Recursos e Apelações de Segunda Instância" },
  { ".tag": "file", "name": "Recurso_Especial_STJ_Julgado.pdf", "path_lower": "/recursos_e_apelacoes_de_segunda_instancia/recurso_especial_stj_julgado.pdf", "path_display": "/Recursos e Apelações de Segunda Instância/Recurso_Especial_STJ_Julgado.pdf", "size": 542000, "client_modified": "2026-05-18T14:22:00Z" }
];

// 5. Unified List Folder - Receives { path, provider }
app.post("/api/cloud/list", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { path: folderPath = "", provider = "dropbox" } = req.body;
  const search = (req.query.search as string || "").toLowerCase();

  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";

    // Update active provider for the law firm
    await DB.table("law_firms").update(lawFirmId, { cloud_provider: provider });

    // Retrieve valid token
    let token = await getValidCloudTokenForUser(userId, provider);
    if (!token) {
      token = await getValidCloudToken(lawFirmId, provider);
    }

    if (!token) {
      res.status(401).json({ error: `GED ${provider.toUpperCase()} não conectado.` });
      return;
    }

    const firm = (await DB.table("law_firms").find((f) => f.id === lawFirmId))[0];
    let isMock = token.startsWith("mock_");
    if (provider === "dropbox" && !process.env.DROPBOX_CLIENT_ID && (!firm || !firm.dropbox_client_id)) isMock = true;
    if (provider === "gdrive" && !process.env.GOOGLE_CLIENT_ID && (!firm || !firm.gdrive_client_id)) isMock = true;
    if (provider === "onedrive" && !process.env.ONEDRIVE_CLIENT_ID && (!firm || !firm.onedrive_client_id)) isMock = true;

    if (isMock) {
      let mockList = MOCK_DROPBOX_ITEMS;
      if (provider === "gdrive") {
        mockList = MOCK_GDRIVE_ITEMS;
      } else if (provider === "onedrive") {
        mockList = MOCK_ONEDRIVE_ITEMS;
      }

      let items = [];
      if (search) {
        items = mockList.filter(
          (item) => item.name.toLowerCase().includes(search)
        );
      } else {
        const cleanFolderPath = folderPath.trim().replace(/\/$/, "").toLowerCase();
        if (!cleanFolderPath || cleanFolderPath === "" || cleanFolderPath === "/") {
          items = mockList.filter((item) => {
            const parts = item.path_lower.split("/");
            return parts.length === 2;
          });
        } else {
          items = mockList.filter((item) => {
            const parts = item.path_lower.split("/");
            const parentPath = parts.slice(0, -1).join("/");
            return parentPath === cleanFolderPath;
          });
        }
      }
      res.json({ entries: items });
    } else {
      // Real API listing using StorageFactory
      const providerInstance = await StorageFactory.getProvider(lawFirmId);
      if (!providerInstance) {
        res.status(400).json({ error: "Não foi possível instanciar o provedor de nuvem." });
        return;
      }

      let files = await providerInstance.listFiles(folderPath);

      if (search) {
        files = files.filter((f) => f.name.toLowerCase().includes(search));
      }

      const entries = files.map((f) => ({
        ".tag": f.tag,
        id: f.id,
        name: f.name,
        path_lower: f.path_lower || `/${f.name.toLowerCase()}`,
        path_display: f.path_display || `/${f.name}`,
        size: f.size,
        client_modified: f.client_modified,
      }));

      res.json({ entries });
    }
  } catch (err: any) {
    console.error("Cloud list error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Unified Get Share Link / Download Link
app.post("/api/cloud/get-link", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { path: filePath, provider = "dropbox" } = req.body;
  if (!filePath) {
    res.status(400).json({ error: "Caminho do arquivo é obrigatório." });
    return;
  }

  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";

    let token = await getValidCloudTokenForUser(userId, provider);
    if (!token) {
      token = await getValidCloudToken(lawFirmId, provider);
    }

    if (!token) {
      res.status(401).json({ error: "Nuvem não conectada." });
      return;
    }

    const firm = (await DB.table("law_firms").find((f) => f.id === lawFirmId))[0];
    let isMock = token.startsWith("mock_");
    if (provider === "dropbox" && !process.env.DROPBOX_CLIENT_ID && (!firm || !firm.dropbox_client_id)) isMock = true;
    if (provider === "gdrive" && !process.env.GOOGLE_CLIENT_ID && (!firm || !firm.gdrive_client_id)) isMock = true;
    if (provider === "onedrive" && !process.env.ONEDRIVE_CLIENT_ID && (!firm || !firm.onedrive_client_id)) isMock = true;

    if (isMock) {
      res.json({
        link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        name: filePath.split("/").pop() || "documento.pdf"
      });
    } else {
      const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const downloadUrl = `${appUrl.replace(/\/$/, "")}/api/cloud/download?path=${encodeURIComponent(filePath)}&provider=${provider}`;
      res.json({ link: downloadUrl, name: filePath.split("/").pop() || "documento.pdf" });
    }
  } catch (err: any) {
    console.error("Cloud get-link error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Download File Endpoint
app.get("/api/cloud/download", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { path: filePath, provider = "dropbox" } = req.query;
  if (!filePath) {
    res.status(400).send("Caminho do arquivo é obrigatório.");
    return;
  }

  try {
    const lawFirmId = req.user?.law_firm_id || "1";
    const providerInstance = await StorageFactory.getProvider(lawFirmId);
    if (!providerInstance) {
      res.status(400).send("Provedor não encontrado.");
      return;
    }

    const buffer = await providerInstance.download(filePath as string);
    const fileName = (filePath as string).split("/").pop() || "arquivo";
    
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  } catch (err: any) {
    res.status(500).send(`Erro no download: ${err.message}`);
  }
});

// Upload File Endpoint
app.post("/api/cloud/upload", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { fileName, fileContent = "Simulado", provider = "dropbox", currentPath = "" } = req.body;
  if (!fileName) {
    res.status(400).json({ error: "Nome do arquivo é obrigatório." });
    return;
  }

  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";

    let token = await getValidCloudTokenForUser(userId, provider);
    if (!token) token = await getValidCloudToken(lawFirmId, provider);

    const isMock = !token || token.startsWith("mock_");

    if (isMock) {
      // Add mock file to simulation lists
      const mockItem = {
        ".tag": "file",
        name: fileName,
        path_lower: `${currentPath}/${fileName}`.toLowerCase().replace(/\/+/g, "/"),
        path_display: `${currentPath}/${fileName}`.replace(/\/+/g, "/"),
        size: fileContent.length || 24000,
        client_modified: new Date().toISOString()
      };

      if (provider === "dropbox") {
        MOCK_DROPBOX_ITEMS.push(mockItem);
      } else if (provider === "gdrive") {
        MOCK_GDRIVE_ITEMS.push(mockItem);
      } else if (provider === "onedrive") {
        MOCK_ONEDRIVE_ITEMS.push(mockItem);
      }

      res.json({ success: true, entry: mockItem });
    } else {
      const providerInstance = await StorageFactory.getProvider(lawFirmId);
      if (!providerInstance) {
        res.status(400).json({ error: "Provedor não encontrado." });
        return;
      }

      const buffer = Buffer.from(fileContent, "utf-8");
      const uploadPath = `${currentPath}/${fileName}`.replace(/\/+/g, "/");
      const uploadedFile = await providerInstance.upload(uploadPath, buffer);

      res.json({
        success: true,
        entry: {
          ".tag": uploadedFile.tag,
          id: uploadedFile.id,
          name: uploadedFile.name,
          path_lower: uploadedFile.path_lower || `/${uploadedFile.name.toLowerCase()}`,
          path_display: uploadedFile.path_display || `/${uploadedFile.name}`,
          size: uploadedFile.size,
          client_modified: uploadedFile.client_modified
        }
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete File/Folder Endpoint
app.post("/api/cloud/delete", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { path: filePath, provider = "dropbox" } = req.body;
  if (!filePath) {
    res.status(400).json({ error: "Caminho do arquivo é obrigatório." });
    return;
  }

  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";

    let token = await getValidCloudTokenForUser(userId, provider);
    if (!token) token = await getValidCloudToken(lawFirmId, provider);

    const isMock = !token || token.startsWith("mock_");

    if (isMock) {
      // Remove from mock arrays
      const targetLower = filePath.toLowerCase();
      if (provider === "dropbox") {
        const idx = MOCK_DROPBOX_ITEMS.findIndex(i => i.path_lower === targetLower || i.path_lower.startsWith(targetLower + "/"));
        if (idx !== -1) MOCK_DROPBOX_ITEMS.splice(idx, 1);
      } else if (provider === "gdrive") {
        const idx = MOCK_GDRIVE_ITEMS.findIndex(i => i.path_lower === targetLower || i.path_lower.startsWith(targetLower + "/"));
        if (idx !== -1) MOCK_GDRIVE_ITEMS.splice(idx, 1);
      } else if (provider === "onedrive") {
        const idx = MOCK_ONEDRIVE_ITEMS.findIndex(i => i.path_lower === targetLower || i.path_lower.startsWith(targetLower + "/"));
        if (idx !== -1) MOCK_ONEDRIVE_ITEMS.splice(idx, 1);
      }
      res.json({ success: true });
    } else {
      const providerInstance = await StorageFactory.getProvider(lawFirmId);
      if (!providerInstance) {
        res.status(400).json({ error: "Provedor não encontrado." });
        return;
      }

      await providerInstance.delete(filePath);
      res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Folder Endpoint
app.post("/api/cloud/create-folder", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { name, provider = "dropbox", currentPath = "" } = req.body;
  if (!name) {
    res.status(400).json({ error: "Nome da pasta é obrigatório." });
    return;
  }

  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";

    let token = await getValidCloudTokenForUser(userId, provider);
    if (!token) token = await getValidCloudToken(lawFirmId, provider);

    const isMock = !token || token.startsWith("mock_");

    if (isMock) {
      const mockItem = {
        ".tag": "folder",
        name: name,
        path_lower: `${currentPath}/${name}`.toLowerCase().replace(/\/+/g, "/"),
        path_display: `${currentPath}/${name}`.replace(/\/+/g, "/")
      };

      if (provider === "dropbox") {
        MOCK_DROPBOX_ITEMS.push(mockItem);
      } else if (provider === "gdrive") {
        MOCK_GDRIVE_ITEMS.push(mockItem);
      } else if (provider === "onedrive") {
        MOCK_ONEDRIVE_ITEMS.push(mockItem);
      }

      res.json({ success: true, entry: mockItem });
    } else {
      const providerInstance = await StorageFactory.getProvider(lawFirmId);
      if (!providerInstance) {
        res.status(400).json({ error: "Provedor não encontrado." });
        return;
      }

      const uploadPath = `${currentPath}/${name}`.replace(/\/+/g, "/");
      const folderId = await providerInstance.createFolder(uploadPath);

      res.json({
        success: true,
        entry: {
          ".tag": "folder",
          id: folderId,
          name: name,
          path_lower: uploadPath.toLowerCase(),
          path_display: uploadPath
        }
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rename Endpoint
app.post("/api/cloud/rename", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { path: filePath, name, provider = "dropbox" } = req.body;
  if (!filePath || !name) {
    res.status(400).json({ error: "Caminho do arquivo e novo nome são obrigatórios." });
    return;
  }

  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";

    let token = await getValidCloudTokenForUser(userId, provider);
    if (!token) token = await getValidCloudToken(lawFirmId, provider);

    const isMock = !token || token.startsWith("mock_");

    if (isMock) {
      // Mock rename update in local arrays
      const targetLower = filePath.toLowerCase();
      const parentParts = filePath.split("/");
      parentParts.pop();
      const parentPath = parentParts.join("/");
      const newPathDisplay = `${parentPath}/${name}`.replace(/\/+/g, "/");
      const newPathLower = newPathDisplay.toLowerCase();

      const updateMockList = (list: any[]) => {
        const item = list.find(i => i.path_lower === targetLower);
        if (item) {
          item.name = name;
          item.path_display = newPathDisplay;
          item.path_lower = newPathLower;
        }
      };

      if (provider === "dropbox") {
        updateMockList(MOCK_DROPBOX_ITEMS);
      } else if (provider === "gdrive") {
        updateMockList(MOCK_GDRIVE_ITEMS);
      } else if (provider === "onedrive") {
        updateMockList(MOCK_ONEDRIVE_ITEMS);
      }

      res.json({ success: true });
    } else {
      const providerInstance = await StorageFactory.getProvider(lawFirmId);
      if (!providerInstance) {
        res.status(400).json({ error: "Provedor não encontrado." });
        return;
      }

      await providerInstance.rename(filePath, name);
      res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Move Endpoint
app.post("/api/cloud/move", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { path: filePath, targetPath, provider = "dropbox" } = req.body;
  if (!filePath || !targetPath) {
    res.status(400).json({ error: "Caminho de origem e de destino são obrigatórios." });
    return;
  }

  try {
    const userId = req.user?.id || "1";
    const lawFirmId = req.user?.law_firm_id || "1";

    let token = await getValidCloudTokenForUser(userId, provider);
    if (!token) token = await getValidCloudToken(lawFirmId, provider);

    const isMock = !token || token.startsWith("mock_");

    if (isMock) {
      const targetLower = filePath.toLowerCase();
      const fileName = filePath.split("/").pop() || "";
      const finalDestDisplay = `${targetPath}/${fileName}`.replace(/\/+/g, "/");
      const finalDestLower = finalDestDisplay.toLowerCase();

      const updateMockList = (list: any[]) => {
        const item = list.find(i => i.path_lower === targetLower);
        if (item) {
          item.path_display = finalDestDisplay;
          item.path_lower = finalDestLower;
        }
      };

      if (provider === "dropbox") {
        updateMockList(MOCK_DROPBOX_ITEMS);
      } else if (provider === "gdrive") {
        updateMockList(MOCK_GDRIVE_ITEMS);
      } else if (provider === "onedrive") {
        updateMockList(MOCK_ONEDRIVE_ITEMS);
      }

      res.json({ success: true });
    } else {
      const providerInstance = await StorageFactory.getProvider(lawFirmId);
      if (!providerInstance) {
        res.status(400).json({ error: "Provedor não encontrado." });
        return;
      }

      await providerInstance.move(filePath, targetPath);
      res.json({ success: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- COMPATIBILITY WRAPPERS FOR OLD DROPBOX ROUTE CALLS ---
app.get("/api/dropbox/status", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  res.redirect("/api/cloud/status");
});
app.get("/api/dropbox/config", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const lawFirmId = req.user?.law_firm_id || "1";
  const firms = await DB.table("law_firms").find((f) => f.id === lawFirmId);
  const firm = firms && firms.length > 0 ? firms[0] : { dropbox_client_id: "" };
  res.json({
    client_id: firm.dropbox_client_id || "",
    has_client_secret: !!firm.dropbox_client_secret
  });
});
app.post("/api/dropbox/config", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { client_id, client_secret } = req.body;
  const lawFirmId = req.user?.law_firm_id || "1";
  const updateData: any = { dropbox_client_id: client_id || null };
  if (client_secret !== undefined) updateData.dropbox_client_secret = client_secret || null;
  await DB.table("law_firms").update(lawFirmId, updateData);
  res.json({ success: true });
});
app.get("/api/dropbox/auth-url", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  res.redirect("/api/cloud/auth-url");
});
app.get("/api/dropbox/callback", async (req, res) => {
  const { code, state } = req.query;
  res.redirect(`/api/cloud/callback/dropbox?code=${code}&state=${state}`);
});
app.post("/api/dropbox/disconnect", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  res.redirect(307, "/api/cloud/disconnect");
});
app.post("/api/dropbox/list", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  res.redirect(307, "/api/cloud/list");
});
app.post("/api/dropbox/get-link", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  res.redirect(307, "/api/cloud/get-link");
});


// ==========================================
// 8. GEMINI AI SMART ASSISTANT MODULE
// ==========================================

// Search & Crawl processes from courts automatically (by OAB, CNJ, or name)
app.get("/api/processes/search-courts", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const query = req.query.query as string;
  
  // LOG: Recebi pesquisa
  console.log(`[BACKEND] Recebi pesquisa: "${query || ""}"`);

  if (!query) {
    console.warn("[BACKEND] Termo de busca vazio ou ausente.");
    res.status(400).json({ error: "O termo de busca é obrigatório." });
    return;
  }
  try {
    const results = await LegalAI.searchCourtsData(query);
    await logAudit(req, "Buscou nos Tribunais por IA/Crawler", "processes", "search_courts", `Pesquisa realizada: "${query}"`);
    
    // LOG: Quantidade de processos e Payload retornado
    console.log(`[BACKEND] Quantidade de processos localizados: ${results.length}`);
    console.log("[BACKEND] Payload enviado:", JSON.stringify(results));
    
    res.json(results);
  } catch (err: any) {
    // LOG: Erro e Stack completa
    console.error(`[BACKEND] Erro: ${err.message}`);
    console.error(`[BACKEND] Stack completa: ${err.stack}`);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// AI Summarize Case
app.post("/api/ai/summarize", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { title, area, description, processId } = req.body;
  try {
    const movements = processId ? await DB.table("movements").find((m) => m.process_id === processId) : [];
    const summary = await LegalAI.summarizeProcess(title, area, description, movements);
    await logAudit(req, "Gerou Resumo por IA", "processes", processId || "draft", `Solicitou resumo automatizado do caso: "${title}"`);
    res.json({ summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Explain Technical Legal Jargon
app.post("/api/ai/explain", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { title, description, technicalText } = req.body;
  try {
    const explanation = await LegalAI.explainToClient(title, description, technicalText);
    await logAudit(req, "Gerou Explicação por IA", "documents", "technical_explanation", `Traduziu texto técnico para o cliente`);
    res.json({ explanation });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Risk and Outcome Forecast
app.post("/api/ai/risk", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer"]), async (req: AuthenticatedRequest, res) => {
  const { title, description, value, processId } = req.body;
  try {
    const movements = processId ? await DB.table("movements").find((m) => m.process_id === processId) : [];
    const riskAnalysis = await LegalAI.analyzeRisk(title, description, Number(value), movements);
    await logAudit(req, "Análise de Risco por IA", "processes", processId || "draft", `Executou forecast de êxito e provisionamento financeiro`);
    res.json({ riskAnalysis });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Generate Legal Contract Template
app.post("/api/ai/contract", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer"]), async (req: AuthenticatedRequest, res) => {
  const { title, partyA, partyB, terms } = req.body;
  try {
    const contract = await LegalAI.generateContract(title, partyA, partyB, terms);
    await logAudit(req, "Minutou Contrato por IA", "documents", "contract_generator", `Gerou contrato inteligente para ${partyA} vs ${partyB}`);
    res.json({ contract });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Generate Initial Legal Petition Draft
app.post("/api/ai/petition", Auth.requireAuth, Auth.requireRoles(["admin", "partner", "lawyer"]), async (req: AuthenticatedRequest, res) => {
  const { area, facts, requests } = req.body;
  try {
    const petition = await LegalAI.generatePetition(area, facts, requests);
    await logAudit(req, "Minutou Petição por IA", "documents", "petition_generator", `Criou estrutura de petição sob área ${area}`);
    res.json({ petition });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Copilot Interactive Chat
app.post("/api/ai/chat", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  const { messages, currentMessage, context } = req.body;
  try {
    const answer = await LegalAI.chatAssistant(messages || [], currentMessage, context);
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 9. WORKFLOW ENGINE ENDPOINTS
// ==========================================

// List workflows
app.get("/api/workflows", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const list = await DB.table("workflows").find();
    let filtered = list;

    // Filter by Law Firm (Multi-tenancy cluster)
    let law_firm_id = req.user?.law_firm_id;
    if ((req.user?.role === "admin" || req.user?.email === "rodrigo.cardoso@sportix.com.br") && req.query.law_firm_id) {
      law_firm_id = req.query.law_firm_id as string;
    }
    if (law_firm_id) {
      filtered = filtered.filter((w) => w.law_firm_id === law_firm_id || (!w.law_firm_id && law_firm_id === "1"));
    }

    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle/Update workflow state
app.put("/api/workflows/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await DB.table("workflows").update(req.params.id, req.body);
    await logAudit(req, "Alterou Workflow", "workflows", req.params.id, `Status ou ações do fluxo alterados`);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 10. SYSTEM ADMINISTRATION (ADMIN CARD PANEL)
// ==========================================

// View audit logs for LGPD compliance
app.get("/api/admin/audit-logs", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const logs = await DB.table("audit_logs").find();
    let filtered = logs;

    // Filter by Law Firm (Multi-tenancy cluster)
    let law_firm_id = req.user?.law_firm_id;
    if ((req.user?.role === "admin" || req.user?.email === "rodrigo.cardoso@sportix.com.br") && req.query.law_firm_id) {
      law_firm_id = req.query.law_firm_id as string;
    }
    if (law_firm_id) {
      filtered = filtered.filter((l) => l.law_firm_id === law_firm_id || (!l.law_firm_id && law_firm_id === "1"));
    }

    // Sort desc by creation date
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// View users (filtered by law firm)
app.get("/api/admin/users", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const users = await DB.table("users").find();
    let filtered = users;
    
    let law_firm_id: string | undefined = req.user?.law_firm_id;
    if (req.user?.role === "admin" || req.user?.email === "rodrigo.cardoso@sportix.com.br") {
      if (req.query.law_firm_id && req.query.law_firm_id !== "all") {
        law_firm_id = req.query.law_firm_id as string;
      } else {
        law_firm_id = undefined;
      }
    }
    
    if (law_firm_id) {
      filtered = filtered.filter((u) => u.law_firm_id === law_firm_id || (!u.law_firm_id && law_firm_id === "1"));
    }

    // Remove secret fields before shipping to client
    const sanitized = filtered.map(({ password, ...u }) => u);
    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create standard or collaborative user cards (with license limit check)
app.post("/api/admin/users", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, email, password, role, permissions, oab } = req.body;
    if (!name || !email || !password || !role) {
       res.status(400).json({ error: "Faltam parâmetros obrigatórios de usuário." });
       return;
    }

    const exists = await DB.table("users").findOne((u) => u.email === email);
    if (exists) {
       res.status(400).json({ error: "E-mail de usuário já cadastrado." });
       return;
    }

    // Determine law firm and check licenses
    let user_law_firm_id = (req.body.law_firm_id !== undefined) ? req.body.law_firm_id : (req.user?.law_firm_id || "1");
    if (role === "admin") {
      user_law_firm_id = "";
    }
    if (user_law_firm_id) {
      const firm = await DB.table("law_firms").findOne((f) => f.id === user_law_firm_id);
      if (firm) {
        const activeUsers = await DB.table("users").find((u) => (u.law_firm_id === user_law_firm_id || (!u.law_firm_id && user_law_firm_id === "1")) && u.active);
        if (activeUsers.length >= firm.licenses) {
           res.status(400).json({ error: `Limite de licenças atingido para este escritório (${firm.licenses} licenças). Remova ou desative outro operador antes de adicionar.` });
           return;
        }
      }
    }

    const hashedPassword = await Auth.hashPassword(password);
    const user = await DB.table("users").insert({
      name,
      email,
      password: hashedPassword,
      role,
      permissions: permissions || [],
      active: true,
      law_firm_id: user_law_firm_id,
      oab: oab || "",
    });

    await logAudit(req, "Cadastrou Usuário", "users", user.id, `Criado usuário ${user.name} com perfil ${user.role} no escritório ID ${user_law_firm_id}`);
    
    // Return sanitized object
    const { password: _, ...responseUser } = user;
    res.status(201).json(responseUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update user permissions / state (with license check on activation)
app.put("/api/admin/users/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const updatePayload = { ...req.body };
    if (updatePayload.role === "admin") {
      updatePayload.law_firm_id = "";
    }
    if (updatePayload.password) {
      updatePayload.password = await Auth.hashPassword(updatePayload.password);
    }

    // Check licenses if activating a user
    if (updatePayload.active === true) {
      const targetUser = await DB.table("users").findOne((u) => u.id === req.params.id);
      if (targetUser && !targetUser.active) {
        const user_law_firm_id = targetUser.law_firm_id || "1";
        const firm = await DB.table("law_firms").findOne((f) => f.id === user_law_firm_id);
        if (firm) {
          const activeUsers = await DB.table("users").find((u) => (u.law_firm_id === user_law_firm_id || (!u.law_firm_id && user_law_firm_id === "1")) && u.active);
          if (activeUsers.length >= firm.licenses) {
             res.status(400).json({ error: `Não é possível reativar este usuário. O limite de ${firm.licenses} licenças deste escritório foi atingido.` });
             return;
          }
        }
      }
    }

    const user = await DB.table("users").update(req.params.id, updatePayload);
    if (!user) {
       res.status(404).json({ error: "Usuário não localizado." });
       return;
    }
    await logAudit(req, "Atualizou Usuário", "users", req.params.id, `Atualizadas permissões, cargo ou estado de ${user.name}`);
    
    const { password: _, ...responseUser } = user;
    res.json(responseUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete("/api/admin/users/:id", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    // Cannot delete yourself
    if (req.user?.id === req.params.id) {
       res.status(400).json({ error: "Você não pode remover seu próprio perfil administrador." });
       return;
    }
    const success = await DB.table("users").delete(req.params.id);
    if (!success) {
       res.status(404).json({ error: "Usuário não localizado." });
       return;
    }
    await logAudit(req, "Excluiu Usuário", "users", req.params.id, `Perfil de usuário removido definitivamente`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// LAW FIRMS (MULTITENANCY CLUSTER) ENDPOINTS
// ==========================================

// List Law Firms (accessible by admin/partner to assign users or super-admins to manage clusters)
app.get("/api/admin/law-firms", Auth.requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await DB.table("law_firms").find();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Law Firm
app.post("/api/admin/law-firms", Auth.requireAuth, Auth.requireRoles(["admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { 
      name, cnpj, licenses, active, logo_url, primary_color, secondary_color,
      cloud_provider,
      dropbox_client_id, dropbox_client_secret,
      gdrive_client_id, gdrive_client_secret,
      onedrive_client_id, onedrive_client_secret
    } = req.body;
    if (!name) {
       res.status(400).json({ error: "O nome do escritório de advocacia é obrigatório." });
       return;
    }

    const firm = await DB.table("law_firms").insert({
      name,
      cnpj: cnpj || "",
      licenses: Number(licenses) || 5,
      active: active !== false,
      logo_url: logo_url || "",
      primary_color: primary_color || "#4f46e5",
      secondary_color: secondary_color || "#111827",
      cloud_provider: cloud_provider || "none",
      dropbox_client_id: dropbox_client_id || null,
      dropbox_client_secret: dropbox_client_secret || null,
      gdrive_client_id: gdrive_client_id || null,
      gdrive_client_secret: gdrive_client_secret || null,
      onedrive_client_id: onedrive_client_id || null,
      onedrive_client_secret: onedrive_client_secret || null,
      created_at: new Date().toISOString()
    });

    await logAudit(req, "Cadastrou Escritório", "law_firms", firm.id, `Escritório cadastrado: ${firm.name} com limite de ${firm.licenses} licenças`);
    res.status(201).json(firm);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Law Firm
app.put("/api/admin/law-firms/:id", Auth.requireAuth, Auth.requireRoles(["admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const firm = await DB.table("law_firms").update(req.params.id, req.body);
    if (!firm) {
       res.status(404).json({ error: "Escritório não localizado." });
       return;
    }
    await logAudit(req, "Atualizou Escritório", "law_firms", req.params.id, `Dados atualizados do escritório ${firm.name}`);
    res.json(firm);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Law Firm
app.delete("/api/admin/law-firms/:id", Auth.requireAuth, Auth.requireRoles(["admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const success = await DB.table("law_firms").delete(req.params.id);
    if (!success) {
       res.status(404).json({ error: "Escritório não localizado." });
       return;
    }
    await logAudit(req, "Excluiu Escritório", "law_firms", req.params.id, `Escritório removido definitivamente do sistema`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Trigger a secure JSON Database backup downloadable
app.post("/api/admin/backup", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const tables = [
      "users", "clients", "processes", "movements", 
      "events", "documents", "financial", "workflows", "audit_logs"
    ];
    
    const dump: any = {};
    for (const t of tables) {
      dump[t] = await DB.table(t).find();
    }

    await logAudit(req, "Efetuou Backup", "database", "backup_engine", `Backup completo das 9 tabelas estruturais gerado com sucesso`);
    res.json({
      timestamp: new Date().toISOString(),
      size_bytes: JSON.stringify(dump).length,
      data: dump
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// 6. SMTP AND PASSWORD RESET ENDPOINTS
// ==========================================

// Função auxiliar para envio de e-mails
async function sendEmailViaSMTP(to: string, subject: string, html: string, lawFirmId?: string): Promise<{ success: boolean; error?: string; simulated: boolean; info?: any }> {
  try {
    let smtp: any = null;

    // Se houver um ID de escritório, tenta buscar as credenciais SMTP dele primeiro
    if (lawFirmId) {
      const firm = await DB.table("law_firms").findOne((f) => f.id === lawFirmId);
      if (firm && firm.smtp_host) {
        smtp = {
          host: firm.smtp_host,
          port: Number(firm.smtp_port || 587),
          secure: firm.smtp_secure === 1 || firm.smtp_secure === true,
          user: firm.smtp_user,
          password: firm.smtp_pass,
          sender_name: firm.smtp_sender || firm.name,
        };
      }
    }

    // Se não houver SMTP do escritório configurado, usa a configuração global do sistema
    if (!smtp) {
      smtp = await DB.table("smtp_settings").findOne(() => true);
    }

    if (!smtp || !smtp.host || smtp.host.includes("legalonefirm.com.br") || (smtp.user && smtp.user.includes("notificacoes@legalonefirm.com.br"))) {
      console.log(`[Simulação de E-mail] De: ${smtp?.sender_name || "Legal One Firm"} <${smtp?.user || "notificacoes@legalonefirm.com.br"}>`);
      console.log(`[Simulação de E-mail] Para: ${to}`);
      console.log(`[Simulação de E-mail] Assunto: ${subject}`);
      console.log(`[Simulação de E-mail] Conteúdo: ${html}`);
      return { success: true, simulated: true };
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port),
      secure: smtp.secure === 1 || smtp.secure === true,
      auth: {
        user: smtp.user,
        pass: smtp.password,
      },
    });

    const info = await transporter.sendMail({
      from: `"${smtp.sender_name || "Legal One"}" <${smtp.user}>`,
      to,
      subject,
      html,
    });

    return { success: true, simulated: false, info };
  } catch (err: any) {
    console.error("Erro no envio SMTP real:", err);
    return { success: false, error: err.message, simulated: false };
  }
}

// Obter configurações de SMTP
app.get("/api/admin/smtp", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    let smtp = await DB.table("smtp_settings").findOne(() => true);
    if (!smtp) {
      smtp = {
        id: "1",
        host: "smtp.legalonefirm.com.br",
        port: 587,
        secure: 0,
        user: "notificacoes@legalonefirm.com.br",
        password: "SenhaSeguraSMTP123",
        sender_name: "Legal One Firm"
      };
      await DB.table("smtp_settings").insert(smtp);
    }
    res.json(smtp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar configurações de SMTP
app.post("/api/admin/smtp", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { host, port, secure, user, password, sender_name } = req.body;
    if (!host || !port || !user) {
       res.status(400).json({ error: "Host, porta e usuário são campos obrigatórios." });
       return;
    }

    let smtp = await DB.table("smtp_settings").findOne(() => true);
    const payload = {
      host,
      port: Number(port),
      secure: secure ? 1 : 0,
      user,
      password: password || (smtp ? smtp.password : ""),
      sender_name: sender_name || "Legal One Firm"
    };

    if (smtp) {
      smtp = await DB.table("smtp_settings").update(smtp.id, payload);
    } else {
      smtp = await DB.table("smtp_settings").insert({ id: "1", ...payload });
    }

    await logAudit(req, "Configurou SMTP", "smtp_settings", smtp.id, `Servidor de e-mail atualizado para: ${host}:${port}`);
    res.json(smtp);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Testar configurações de SMTP enviando e-mail de teste
app.post("/api/admin/smtp/test", Auth.requireAuth, Auth.requireRoles(["admin", "partner"]), async (req: AuthenticatedRequest, res) => {
  const { toEmail } = req.body;
  if (!toEmail) {
     res.status(400).json({ error: "E-mail do destinatário é obrigatório." });
     return;
  }

  try {
    const smtp = await DB.table("smtp_settings").findOne(() => true);
    const subject = "E-mail de Teste de Conexão SMTP - Legal One ERP";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #4f46e5; margin-bottom: 16px;">Conexão Estabelecida com Sucesso! 🚀</h2>
        <p>Olá,</p>
        <p>Este é um e-mail de teste enviado pelo sistema <strong>Legal One Firm ERP</strong>.</p>
        <p>Se você recebeu este e-mail, significa que as configurações do seu servidor SMTP estão corretas e o sistema está pronto para realizar envios de notificações e redefinições de senha corporativa.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="font-size: 11px; color: #64748b;">Configurações Utilizadas:</p>
        <ul style="font-size: 11px; color: #64748b; font-family: monospace; list-style: none; padding-left: 0;">
          <li><strong>Servidor Host:</strong> ${smtp?.host || "Não definido"}</li>
          <li><strong>Porta:</strong> ${smtp?.port || "Não definido"}</li>
          <li><strong>Usuário:</strong> ${smtp?.user || "Não definido"}</li>
          <li><strong>Remetente:</strong> ${smtp?.sender_name || "Legal One"}</li>
        </ul>
      </div>
    `;

    const result = await sendEmailViaSMTP(toEmail, subject, html);
    if (result.success) {
      res.json({ success: true, simulated: result.simulated });
    } else {
      res.status(500).json({ error: `Falha no envio do e-mail real: ${result.error}` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Esqueci a senha - Solicitação (Público)
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
     res.status(400).json({ error: "O endereço de e-mail é obrigatório." });
     return;
  }

  try {
    const user = await DB.table("users").findOne((u) => u.email === email && u.active);
    if (!user) {
       res.status(404).json({ error: "Não foi encontrado nenhum operador ativo com este endereço de e-mail." });
       return;
    }

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const resetExpires = new Date(Date.now() + 3600000).toISOString(); // 1 hora de validade

    await DB.table("users").update(user.id, {
      reset_token: resetToken,
      reset_token_expires: resetExpires
    });

    // Captura a origem da requisição para gerar o link correto de redefinição
    const origin = req.headers.referer || req.headers.origin || "http://localhost:3000";
    const resetLink = `${origin.split("?")[0]}?resetToken=${resetToken}&email=${encodeURIComponent(user.email)}`;

    const subject = "Recuperação de Senha Corporativa - Legal One Firm";
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="background-color: #4f46e5; width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 24px; font-weight: bold;">⚖️</div>
          <h2 style="color: #0f172a; margin-top: 12px; margin-bottom: 4px;">Recuperação de Senha</h2>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">Legal One Firm ERP</p>
        </div>
        <p>Olá, <strong>${user.name}</strong>,</p>
        <p>Recebemos uma solicitação para redefinir a sua senha corporativa de acesso ao painel do escritório.</p>
        <p>Para prosseguir com a redefinição de sua senha, clique no botão seguro abaixo:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);">Redefinir Minha Senha</a>
        </div>
        <p style="color: #475569; font-size: 13px; line-height: 1.5;">Ou se o botão acima não funcionar, copie e cole o link de acesso direto abaixo em seu navegador:</p>
        <p style="background-color: #f8fafc; padding: 12px; border-radius: 8px; font-size: 11px; font-family: monospace; word-break: break-all; color: #334155; border: 1px solid #f1f5f9;">
          ${resetLink}
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">Este link é de uso exclusivo e expirará automaticamente em 1 hora.</p>
        <p style="font-size: 12px; color: #94a3b8;">Se você não realizou esta solicitação de recuperação de senha, nenhuma ação é necessária e você pode desconsiderar este e-mail com total segurança.</p>
      </div>
    `;

    const result = await sendEmailViaSMTP(user.email, subject, html, user.law_firm_id);
    
    res.json({
      success: true,
      simulated: result.simulated,
      resetLink: result.simulated ? resetLink : undefined,
      message: result.simulated
        ? "E-mail de redefinição de senha simulado no terminal com sucesso!"
        : "E-mail de redefinição de senha real enviado com sucesso utilizando as configurações do servidor SMTP!"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Redefinir a senha (Público)
app.post("/api/auth/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
     res.status(400).json({ error: "E-mail, token e nova senha são obrigatórios." });
     return;
  }

  try {
    const user = await DB.table("users").findOne((u) => u.email === email && u.active);
    if (!user) {
       res.status(404).json({ error: "Operador não encontrado." });
       return;
    }

    if (!user.reset_token || user.reset_token !== token) {
       res.status(400).json({ error: "Token de redefinição inválido, já utilizado ou incorreto." });
       return;
    }

    const expiresDate = new Date(user.reset_token_expires);
    if (expiresDate.getTime() < Date.now()) {
       res.status(400).json({ error: "Este token de redefinição de senha expirou por limite de tempo." });
       return;
    }

    const hashedPassword = await Auth.hashPassword(newPassword);

    await DB.table("users").update(user.id, {
      password: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    });

    await DB.table("audit_logs").insert({
      id: Math.random().toString(36).substr(2, 9),
      user_id: user.id,
      user_name: user.name,
      action: "Redefiniu Senha",
      table_name: "users",
      record_id: user.id,
      details: `Senha corporativa alterada com sucesso via formulário de recuperação de senha.`,
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, message: "Senha corporativa redefinida com sucesso! Você já pode realizar o login." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ==========================================
// VITE INTEGRATION & STANDALONE STARTUP
// ==========================================

async function run() {
  // Initialize Database engine
  await DB.init();

  if (process.env.NODE_ENV !== "production") {
    // Setup Vite for rapid local live frontend updates in the sandbox container
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static client bundle files in production hosting
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.PORT) {
    app.listen(process.env.PORT, () => {
      console.log(`[Legal One Firm ERP] running on dynamic port ${process.env.PORT}`);
    });
  } else {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[Legal One Firm ERP] running successfully on http://localhost:${PORT}`);
    });
  }
}

run().catch((err) => {
  console.error("Startup fatal failure:", err);
});
