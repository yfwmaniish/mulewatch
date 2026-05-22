import type { Metadata } from "next";
import "./globals.css";
import { AlertProvider } from "@/context/AlertContext";
import SidebarNav from "./SidebarNav";
import CommandMenu from "@/components/CommandMenu";
import HeaderSearchAndProfile from "@/components/HeaderSearchAndProfile";
import DonezoOverlays from "@/components/DonezoOverlays";

export const metadata: Metadata = {
  title: "MuleWatch Console | AI-Powered AML Analyst Hub",
  description: "Production-ready automated analyst triage console for multi-channel suspicious mule account tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className="bg-[#F8FAFC] text-slate-900 font-sans h-screen max-h-screen flex antialiased overflow-hidden">
        <AlertProvider>
          <div className="flex w-full h-screen max-h-screen overflow-hidden bg-[#F1F5F9]">
            {/* Donezo Persistent Left Sidebar Nav */}
            <SidebarNav />

            {/* Main Application Area */}
            <div className="flex-1 flex flex-col min-h-0 p-6 pl-2 overflow-hidden">
              {/* Donezo Style Core Top Header */}
              <HeaderSearchAndProfile />

              {/* Dynamic SPA Main Body Content Panel */}
              <main className="flex-1 min-h-0 overflow-y-auto mt-5 scrollbar-thin pr-1 pb-4">
                {children}
              </main>
            </div>
            
            {/* Analyst Command Control Deck (Slide-out Shell) */}
            <CommandMenu />

            {/* Premium Phase 9 Dynamic Modals, Drawers & Lockscreen Overlays */}
            <DonezoOverlays />
          </div>
        </AlertProvider>
      </body>
    </html>
  );
}
