import { motion, AnimatePresence } from "motion/react";
import { cn } from '../../utils/cn';
import { Suspense } from "react";

interface PageTransitionProps {
  children: React.ReactNode;
  key: string;
  className?: string;
}

export function PageTransition({ children, key, className }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.99, position: "absolute", inset: 0 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 25,
          mass: 0.8,
        }}
        className={cn("h-full", className)}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-neutral-400 font-medium">Cargando...</p>
              </div>
            </div>
          }
        >
          {children}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

