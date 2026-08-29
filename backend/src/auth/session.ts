import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL: JWT_SECRET environment variable is missing!");
  }
  return "dev_secret_only_for_local_testing_do_not_use_in_prod";
})();
const JWT_EXPIRES_IN = "2h";

export interface SessionPayload {
  userId: string;
  role: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: SessionPayload;
}

/** Génère un token JWT signé pour une session utilisateur. */
export function generateToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** Middleware Express pour authentifier les requêtes via un Bearer Token ou Cookie. */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  let token = req.headers.authorization?.split(" ")[1];
  
  if (!token && req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Authentification requise. Session expirée." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session invalide ou expirée. Veuillez vous reconnecter." });
  }
}

/** Middleware Express pour filtrer l'accès selon les rôles (RBAC). */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentification requise." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé. Permissions insuffisantes." });
    }

    next();
  };
}
