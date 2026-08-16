/**
 * Wrapper centralisé pour les notifications toast (Sonner).
 * Remplace tous les alert() natifs du projet.
 * Design cohérent avec le thème "cyber" de Sentinelles Numériques.
 */
import { toast } from "sonner";

export const toastMsg = {
  success: (msg: string, desc?: string) =>
    toast.success(msg, {
      description: desc,
      duration: 4000,
      style: {
        background: "rgba(7, 21, 43, 0.97)",
        border: "1px solid rgba(0, 229, 255, 0.4)",
        color: "#F5F7FA",
        borderRadius: "16px",
      },
    }),

  error: (msg: string, desc?: string) =>
    toast.error(msg, {
      description: desc,
      duration: 6000,
      style: {
        background: "rgba(7, 21, 43, 0.97)",
        border: "1px solid rgba(255, 23, 68, 0.5)",
        color: "#F5F7FA",
        borderRadius: "16px",
      },
    }),

  warning: (msg: string, desc?: string) =>
    toast.warning(msg, {
      description: desc,
      duration: 5000,
      style: {
        background: "rgba(7, 21, 43, 0.97)",
        border: "1px solid rgba(255, 179, 0, 0.4)",
        color: "#F5F7FA",
        borderRadius: "16px",
      },
    }),

  info: (msg: string, desc?: string) =>
    toast.info(msg, {
      description: desc,
      duration: 4000,
      style: {
        background: "rgba(7, 21, 43, 0.97)",
        border: "1px solid rgba(0, 229, 255, 0.25)",
        color: "#F5F7FA",
        borderRadius: "16px",
      },
    }),

  credentials: (payload: { nom: string; identifiant: string; motDePasse: string }) =>
    toast(
      `Compte créé : ${payload.nom}`,
      {
        description: `Identifiant : ${payload.identifiant} · Mot de passe temporaire : ${payload.motDePasse}`,
        duration: 15000,
        style: {
          background: "rgba(7, 21, 43, 0.97)",
          border: "1px solid rgba(255, 179, 0, 0.6)",
          color: "#F5F7FA",
          borderRadius: "16px",
        },
        action: {
          label: "Copier",
          onClick: () =>
            navigator.clipboard.writeText(
              `Identifiant : ${payload.identifiant}\nMot de passe : ${payload.motDePasse}`
            ).then(() => toastMsg.success("Informations copiées !")),
        },
      }
    ),

  loading: (msg: string) => toast.loading(msg, {
    style: {
      background: "rgba(7, 21, 43, 0.97)",
      border: "1px solid rgba(0, 229, 255, 0.25)",
      color: "#F5F7FA",
      borderRadius: "16px",
    },
  }),

  dismiss: (id: string | number) => toast.dismiss(id),
};
