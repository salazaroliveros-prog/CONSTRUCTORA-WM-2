import { motion, AnimatePresence } from "motion/react";
import React from "react";

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  topBar?: React.ReactNode;
  mobileNav?: React.ReactNode;
}

export function AppShell({
  children,
  sidebar,
  topBar,
  mobileNav,
}: AppShellProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--app-bg)]">
      {/* Top Bar */}
      {topBar && (
        <header className="h-14 sm:h-16 backdrop-blur-xl bg-[var(--color-surface)]/80 border-b border-[var(--color-border)]/50 px-3 sm:px-5 flex items-center shrink-0 z-30 transition-colors">
          {topBar}
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebar && (
          <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 border-r border-[var(--color-border)]/50 bg-[var(--color-surface)]/90 backdrop-blur-xl z-20">
            {sidebar}
          </aside>
        )}

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-transparent scroll-smooth scrollbar-thin">
          <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={(() => {
                const arr = React.Children.toArray(children as React.ReactNode[]);
                return (typeof arr[0] === 'object' && arr[0] !== null && 'key' in arr[0] && typeof arr[0].key === 'string') 
                  ? arr[0].key 
                  : "content";
              })()}
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99, position: "absolute" }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 25,
                  mass: 0.8,
                }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      {mobileNav && (
        <footer className="lg:hidden">
          {mobileNav}
        </footer>
      )}
    </div>
  );
}