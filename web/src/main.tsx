import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { captureAuthReturnError } from "./authReturn";
import "../styles.css";

captureAuthReturnError();

void import("./App").then(({ App }) => {
  createRoot(document.getElementById("app")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => undefined);
}
