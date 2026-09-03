import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App";
import { AuthProvider } from "@/contexts/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
    <Toaster
      position="top-right"
      visibleToasts={5}
      expand={true}
      gap={8}
      richColors={false}
      closeButton
      toastOptions={{
        style: {
          fontFamily: "'Oxanium', 'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: "14px",
          color: "#FFFFFF",
          background: "rgba(8, 16, 33, 0.98)",
          border: "1.5px solid rgba(255, 23, 68, 0.8)",
          borderRadius: "16px",
          boxShadow: "0 0 25px -5px rgba(255, 23, 68, 0.5)",
        },
        descriptionClassName: "!text-slate-300 !font-semibold !text-xs",
      }}
    />
  </StrictMode>
);

// Nettoyage proactif de tout Service Worker obsolète pour fluidifier et accélérer le lancement sur mobile
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
  if ("caches" in window) {
    caches.keys().then((names) => {
      for (const name of names) {
        caches.delete(name);
      }
    }).catch(() => {});
  }
}
