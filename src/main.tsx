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

// Enregistrement du Service Worker pour permettre l'installation PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
