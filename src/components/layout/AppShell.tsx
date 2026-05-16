import { motion, AnimatePresence } from "motion/react";
import React from "react";

interface AppShellProps {
  children: React.ReactNode;
  isMenuOpen?: boolean;
}

export function AppShell({ children, isMenuOpen }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#f8f9fa] overflow-x-hidden">
      <div 
        id="page-container" 
        className={isMenuOpen ? "menu-open" : ""}
      >
        <main className="pt-24 pb-20 px-4 sm:px-6 md:px-8">
          <div className="w-full max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={(() => {
                  const arr = React.Children.toArray(children);
                  return (typeof arr[0] === 'object' && arr[0] !== null && 'key' in arr[0] && typeof arr[0].key === 'string')
                    ? arr[0].key
                    : "content";
                })()}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}


