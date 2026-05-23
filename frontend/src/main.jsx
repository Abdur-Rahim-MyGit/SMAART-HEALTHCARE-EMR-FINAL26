import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "react-hot-toast";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
          <Toaster
            position="bottom-right"
            gutter={12}
            toastOptions={{
              duration: 4000,
              style: {
                background: "#fff",
                color: "#374151",
                border: "1px solid #e5e7eb",
              },
              darkStyle: {
                background: "#1f2937",
                color: "#f9fafb",
                border: "1px solid #374151",
              },
              success: {
                iconTheme: {
                  primary: "#004D99",
                  secondary: "#fff",
                },
              },
              error: {
                iconTheme: {
                  primary: "#ef4444",
                  secondary: "#fff",
                },
              },
            }}
            closeButton={true}
          />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
