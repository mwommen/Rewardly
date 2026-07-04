// src/index.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App"; // make sure App.tsx is in the same folder
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
