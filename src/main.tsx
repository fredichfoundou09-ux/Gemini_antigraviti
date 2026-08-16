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
      richColors={false}
      closeButton
      toastOptions={{
        style: {
          fontFamily: "'Rajdhani', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: "13px",
        },
      }}
    />
  </StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Le mode PWA est optionnel : une erreur d'enregistrement ne bloque pas l'app.
    });
  });
}
