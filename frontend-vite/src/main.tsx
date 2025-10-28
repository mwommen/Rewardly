import React from "react";
import ReactDOM from "react-dom/client";
// swap this:
import App from "./App_recommendation"; // ✅ use the new screen
// import App from "./App"; // ⛔ old list UI
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
