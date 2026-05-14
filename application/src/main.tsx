import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./Global.css"
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Todo from "./routes/Todo";
import System from "./routes/System";
import Rules from "./routes/Rules";
import Calendar from "./routes/Calendar";
import Sessions from "./routes/Sessions";
import Safeguards from "./routes/Safeguards";
import Analytics from "./routes/Analytics";
import Assistant from "./routes/Assistant";
import Settings from "./routes/Settings";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />
  },
  {
    path: "/rules",
    element: <Rules />
  },
  {
    path: "/todo",
    element: <Todo />
  },
  {
    path: "/calendar",
    element: <Calendar />
  },
  {
    path: "/sessions",
    element: <Sessions />
  },
  {
    path: "/system",
    element: <System />
  },
  {
    path: "/safeguards",
    element: <Safeguards />
  },
  {
    path: "/analytics",
    element: <Analytics />
  },
  {
    path: "/assistant",
    element: <Assistant />
  },
  {
    path: "/settings",
    element: <Settings />
  },
])

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
