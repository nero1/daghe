import type { Metadata } from "next";
import ServiceWorkerRegister from "./sw-register";
import SyncAgent from "./sync-agent";
import NavBar from "./components/NavBar";
import DirProvider from "./components/DirProvider";
import "./styles.css";

export const metadata: Metadata = {
  title: "Asibi",
  description: "Offline-first CHW climate triage PWA"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('asibi_theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');})()` }} />
      </head>
      <body>
        <DirProvider />
        <ServiceWorkerRegister />
        <SyncAgent />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
