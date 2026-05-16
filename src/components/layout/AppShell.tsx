import { motion, AnimatePresence } from "motion/react";
import React from "react";

interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  topBar?: React.ReactNode;
  mobileNav?: React.ReactNode;
}

export function AppShell({ children, sidebar, topBar, mobileNav }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {topBar && (
        <div className="shrink-0 z-30">
          {topBar}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {sidebar && (
          <aside className="hidden lg:flex lg:w-64 lg:shrink-0 z-20">
            {sidebar}
          </aside>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
          <div className="w-full max-w-480 mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={(() => {
                  const arr = React.Children.toArray(children);
                  return (typeof arr[0] === 'object' && arr[0] !== null && 'key' in arr[0] && typeof arr[0].key === 'string')
                    ? arr[0].key
                    : "content";
                })()}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, position: "absolute" }}
                transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.8 }}
                className="h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {mobileNav && (
        <footer className="lg:hidden">
          {mobileNav}
        </footer>
      )}
    </div>
  );
}
