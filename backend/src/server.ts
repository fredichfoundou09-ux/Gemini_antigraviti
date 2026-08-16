import express, { Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import { z } from "zod";
import {
  authenticate,
  requireRole,
  generateToken,
  AuthRequest,
} from "./auth/session";

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

// Configuration de sécurité & CORS
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());

// En-têtes anti-cache no-store globaux pour toutes les réponses de l'API (Sécurité)
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// ==========================================
// VALIDATEURS DE DONNÉES (ZOD)
// ==========================================

const passwordSchema = z.string()
  .min(12, "Le mot de passe doit faire au moins 12 caractères.")
  .regex(/[A-Z]/, "Le mot de passe doit contenir au moins une majuscule.")
  .regex(/[a-z]/, "Le mot de passe doit contenir au moins une minuscule.")
  .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre.")
  .regex(/[^A-Za-z0-9]/, "Le mot de passe doit contenir au moins un caractère spécial.");

const userCreateSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-z0-9._-]+$/),
  password: passwordSchema,
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(["superadmin", "admin", "teacher", "student"]),
});

const studentCreateSchema = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  dateNaissance: z.string().optional(),
  sexe: z.enum(["M", "F"]),
  telephone: z.string().min(1),
  whatsapp: z.string().min(1),
  email: z.string().email().optional(),
  adresse: z.string().optional(),
  niveau: z.string().optional(),
  formationId: z.string().uuid(),
  modules: z.array(z.string().uuid()),
  groupe: z.string().optional(),
  photo: z.string().optional(), // base64
});

const paymentSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  type: z.enum(["inscription", "formation"]),
  libelle: z.string().optional(),
  montant: z.number().positive(),
  mode: z.string().min(1),
  observation: z.string().optional(),
});

// ==========================================
// ROUTES : AUTHENTIFICATION (JWT + RBAC)
// ==========================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, group } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Identifiant et mot de passe requis." });
    }

    const user = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Identifiants incorrects ou compte inactif." });
    }

    const match = await argon2.verify(user.passwordHash, password);
    if (!match) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    // Contrôle du groupe
    if (group) {
      const inAdminGroup = user.role === "superadmin" || user.role === "admin";
      const ok = (group === "admin" && inAdminGroup) || (group === user.role);
      if (!ok) {
        return res.status(403).json({ error: "Ce compte n'est pas autorisé pour cet espace." });
      }
    }

    const token = generateToken({ userId: user.id, role: user.role, name: user.name });

    // Journal d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        description: `Connexion réussie de l'utilisateur ${user.username}`,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000, // 2 heures
    });

    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", authenticate, async (req: AuthRequest, res) => {
  try {
    res.clearCookie("token");
    res.json({ message: "Déconnexion réussie." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/auth/me", authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.userId } });
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
    res.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ROUTES : APPRENANTS (STUDENTS)
// ==========================================

app.get("/api/students", authenticate, requireRole(["superadmin", "admin", "teacher"]), async (req, res) => {
  try {
    const students = await prisma.student.findMany({
      include: {
        formation: true,
        modules: { include: { module: true } },
      },
      orderBy: { nom: "asc" },
    });
    res.json(students);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/students/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const sId = req.params.id;
    // Un apprenant ne peut consulter que sa propre fiche
    if (req.user?.role === "student") {
      const self = await prisma.student.findUnique({ where: { userId: req.user.userId } });
      if (!self || self.id !== sId) return res.status(403).json({ error: "Accès refusé." });
    }

    const student = await prisma.student.findUnique({
      where: { id: sId },
      include: {
        formation: true,
        modules: { include: { module: true } },
        invoices: true,
        payments: true,
      },
    });

    if (!student) return res.status(404).json({ error: "Apprenant introuvable." });
    res.json(student);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/students", authenticate, requireRole(["superadmin", "admin"]), async (req: AuthRequest, res) => {
  try {
    const val = studentCreateSchema.parse(req.body);
    const year = new Date().getFullYear();

    // Calcul automatique du n° apprenant (SN-YYYY-XXXXX)
    const count = await prisma.student.count();
    const studentId = `SN-${year}-${String(count + 1).padStart(5, "0")}`;

    // Création automatique du compte utilisateur associé
    const username = `${val.prenom.toLowerCase()}.${val.nom.toLowerCase()}`.replace(/[^a-z0-9]/g, "");
    const tempPassword = `Sentinel@${year}!`;
    const passwordHash = await argon2.hash(tempPassword);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          name: `${val.prenom} ${val.nom}`,
          email: val.email,
          phone: val.telephone,
          role: "student",
        },
      });

      const student = await tx.student.create({
        data: {
          id: studentId,
          userId: user.id,
          formationId: val.formationId,
          nom: val.nom,
          prenom: val.prenom,
          dateNaissance: val.dateNaissance ? new Date(val.dateNaissance) : null,
          sexe: val.sexe,
          telephone: val.telephone,
          whatsapp: val.whatsapp,
          email: val.email,
          adresse: val.adresse,
          niveau: val.niveau,
          photoUrl: val.photo,
        },
      });

      // Liaison avec les modules choisis
      for (const mId of val.modules) {
        await tx.studentModule.create({
          data: { studentId: studentId, moduleId: mId },
        });
      }

      // Facturation automatique (Inscription + Formation)
      const formation = await tx.formation.findUnique({ where: { id: val.formationId } });
      const insc = 5000; // frais inscription standard
      const montantFormation = 15000; // exemple forfaitaire, à moduler

      if (insc > 0) {
        await tx.invoice.create({
          data: { studentId, type: "inscription", libelle: "Frais d'inscription", montant: insc, date: new Date(), createdBy: req.user?.userId },
        });
      }

      await tx.invoice.create({
        data: { studentId, type: "formation", libelle: `Formation — ${val.modules.length} module(s) (${formation?.name})`, montant: montantFormation, date: new Date(), createdBy: req.user?.userId },
      });

      // Journal d'audit
      await tx.auditLog.create({
        data: {
          userId: req.user?.userId,
          action: "CREATE",
          entityType: "Student",
          entityId: user.id,
          description: `Inscription de l'apprenant ${student.prenom} ${student.nom} (${studentId})`,
        },
      });

      return { student, username, tempPassword };
    });

    res.status(211).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ROUTES : ENSEIGNANTS (TEACHERS)
// ==========================================

app.get("/api/teachers", authenticate, requireRole(["superadmin", "admin", "teacher"]), async (req, res) => {
  try {
    const teachers = await prisma.teacher.findMany({
      include: { modules: { include: { module: true } } },
      orderBy: { nom: "asc" },
    });
    res.json(teachers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ROUTES : FINANCES (PAIEMENTS & FACTURES)
// ==========================================

app.post("/api/payments", authenticate, requireRole(["superadmin", "admin"]), async (req: AuthRequest, res) => {
  try {
    const { studentId } = req.body;
    const val = paymentSchema.parse(req.body);

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ error: "Apprenant introuvable." });

    // Génération automatique du n° de reçu (REC-XXXX)
    const count = await prisma.payment.count();
    const reference = `REC-${String(count + 1).padStart(4, "0")}`;

    const payment = await prisma.payment.create({
      data: {
        studentId,
        invoiceId: val.invoiceId,
        type: val.type,
        libelle: val.libelle || (val.type === "inscription" ? "Frais d'inscription" : "Paiement de la formation"),
        montant: val.montant,
        date: new Date(),
        heure: new Date().toTimeString().slice(0, 5),
        mode: val.mode,
        reference,
        observation: val.observation,
        createdBy: req.user?.userId,
        createdByName: req.user?.name,
      },
    });

    // Journal d'audit
    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: "CREATE",
        entityType: "Payment",
        entityId: payment.id as unknown as string,
        description: `Enregistrement du paiement ${reference} de ${money(val.montant)} pour l'apprenant ${student.prenom} ${student.nom}`,
      },
    });

    res.status(211).json(payment);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper rapide d'affichage financier
function money(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

// ==========================================
// DEMARRAGE DU SERVEUR
// ==========================================

app.listen(PORT, () => {
  console.log(`Backend API Sentinel Academy running on port ${PORT} 🚀`);
});
export default app;
