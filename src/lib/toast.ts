/**
 * Wrapper centralisé pour les notifications toast (Sonner).
 * Remplace tous les alert() natifs du projet.
 * Design cohérent avec le thème "cyber" de Sentinelles Numériques.
 */
import { toast } from "sonner";

const BASE_TOAST_STYLE = {
  background: "rgba(8, 16, 33, 0.98)",
  border: "1.5px solid rgba(255, 23, 68, 0.7)",
  color: "#FF1744",
  fontWeight: 700,
  fontSize: "14px",
  borderRadius: "16px",
  boxShadow: "0 0 25px -5px rgba(255, 23, 68, 0.4)",
};

export const toastMsg = {
  success: (msg: string, desc?: string) =>
    toast.success(msg, {
      description: desc,
      duration: 4000,
      style: {
        ...BASE_TOAST_STYLE,
        border: "1.5px solid rgba(255, 23, 68, 0.8)",
        color: "#FF1744",
      },
    }),

  error: (msg: string, desc?: string) =>
    toast.error(msg, {
      description: desc,
      duration: 6000,
      style: {
        ...BASE_TOAST_STYLE,
        border: "2px solid #FF1744",
        color: "#FF1744",
      },
    }),

  warning: (msg: string, desc?: string) =>
    toast.warning(msg, {
      description: desc,
      duration: 5000,
      style: {
        ...BASE_TOAST_STYLE,
        border: "1.5px solid rgba(255, 82, 82, 0.8)",
        color: "#FF2A55",
      },
    }),

  info: (msg: string, desc?: string) =>
    toast.info(msg, {
      description: desc,
      duration: 4000,
      style: {
        ...BASE_TOAST_STYLE,
        border: "1.5px solid rgba(255, 23, 68, 0.6)",
        color: "#FF1744",
      },
    }),

  credentials: (payload: { nom: string; identifiant: string; motDePasse: string }) =>
    toast(
      `Compte créé : ${payload.nom}`,
      {
        description: `Identifiant : ${payload.identifiant} · Mot de passe temporaire : ${payload.motDePasse}`,
        duration: 15000,
        style: {
          ...BASE_TOAST_STYLE,
          border: "1.5px solid #FF1744",
          color: "#FF1744",
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
      ...BASE_TOAST_STYLE,
      border: "1.5px solid rgba(255, 23, 68, 0.5)",
      color: "#FF1744",
    },
  }),

  incomingMessage: (payload: { senderName: string; senderRole?: string; subject?: string; body: string }) => {
    // Émission d'un bip sonore discret cyber (Web Audio API natif)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch { /* silence audio */ }

    const roleMap: Record<string, string> = {
      superadmin: "Super Admin",
      admin: "Direction / Admin",
      teacher: "Formateur",
      student: "Apprenant",
      partner: "Partenaire",
      partner_admin: "Admin Partenaire",
    };
    const roleTag = payload.senderRole ? (roleMap[payload.senderRole] || payload.senderRole) : "Utilisateur";

    return toast(`💬 ${payload.senderName} (${roleTag})`, {
      description: payload.subject ? `${payload.subject} : ${payload.body.slice(0, 90)}` : payload.body.slice(0, 100),
      duration: 5000,
      position: "top-center",
      style: {
        background: "rgba(8, 16, 33, 0.98)",
        border: "1.5px solid #00E5FF",
        color: "#FFFFFF",
        fontWeight: 700,
        fontSize: "14px",
        borderRadius: "16px",
        boxShadow: "0 0 30px -5px rgba(0, 229, 255, 0.5)",
        fontFamily: "'Oxanium', 'Rajdhani', sans-serif",
      },
      action: {
        label: "Voir le message",
        onClick: () => {
          window.location.hash = "#/app/messages";
        },
      },
    });
  },

  incomingNotification: (payload: { title: string; body: string }) =>
    toast(payload.title, {
      description: payload.body.slice(0, 80),
      duration: 4500,
      style: {
        ...BASE_TOAST_STYLE,
        border: "1.5px solid #FF1744",
        color: "#FFFFFF",
      },
      action: {
        label: "Consulter",
        onClick: () => {
          window.location.hash = "#/app/notifications";
        },
      },
    }),

  dismiss: (id: string | number) => toast.dismiss(id),
};
