import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PowerProvider, useWho } from "./PowerProvider";
import { StoreProvider } from "./data/store";
import App from "./App";
import "./theme.css";
import "./styles.css";

/** Counts are recorded against the signed-in user's name. */
function WithStore({ children }: { children: ReactNode }) {
  const who = useWho();
  return (
    <StoreProvider key={who.name} me={who.name}>
      {children}
    </StoreProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PowerProvider>
      <WithStore>
        <App />
      </WithStore>
    </PowerProvider>
  </StrictMode>,
);
