import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || "legal-one-firm-super-secret-key-sportix";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  law_firm_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const Auth = {
  /**
   * Hashes a plain-text password using bcrypt.
   */
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },

  /**
   * Compares a plain-text password with a hashed password.
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  /**
   * Signs a secure JWT token containing user metadata.
   */
  generateToken(user: { id: string; name: string; email: string; role: string; permissions: string[]; law_firm_id?: string }): string {
    return jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        law_firm_id: user.law_firm_id,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
  },

  /**
   * Express middleware to verify token and authenticate requests.
   */
  requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
       res.status(401).json({ error: "Acesso não autorizado. Token ausente ou inválido." });
       return;
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
      req.user = decoded;
      next();
    } catch (err) {
       res.status(401).json({ error: "Sessão expirada ou token inválido. Por favor, faça login novamente." });
       return;
    }
  },

  /**
   * Middleware role validator.
   */
  requireRoles(allowedRoles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
         res.status(401).json({ error: "Não autenticado." });
         return;
      }

      const hasRole = allowedRoles.includes(req.user.role);
      if (!hasRole && req.user.role !== "admin" && req.user.role !== "partner") {
         res.status(403).json({ error: "Permissão insuficiente para executar esta ação." });
         return;
      }
      next();
    };
  }
};
