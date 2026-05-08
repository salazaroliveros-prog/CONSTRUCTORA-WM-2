/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Enhanced Modal with Glassmorphism effects - v0.dev inspired
 */

import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  glassEffect?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw]',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  glassEffect = true,
}: ModalProps) {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop with glassmorphism */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(8px) saturate(180%)',
              WebkitBackdropFilter: 'blur(8px) saturate(180%)',
            }}
          />
          
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24, filter: 'blur(10px)' }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              filter: 'blur(0px)',
            }}
            exit={{
              opacity: 0,
              scale: 0.92,
              y: 24,
              filter: 'blur(10px)',
            }}
            transition={{
              type: 'spring',
              stiffness: 320,
              damping: 28,
              mass: 0.9,
            }}
            className={`relative w-full ${sizeClasses[size]} ${
              glassEffect
                ? 'bg-white/70 backdrop-blur-2xl border border-white/40 shadow-2xl'
                : 'bg-white rounded-3xl shadow-2xl border border-slate-100'
            }`}
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.1) inset',
            }}
          >
            {/* Decorative gradient orb */}
            <div
              className="absolute -top-20 -right-20 w-40 h-40 rounded-full opacity-30 pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)',
                filter: 'blur(20px)',
              }}
            />
            
            {/* Header */}
            <div
              className={`px-6 py-5 flex items-center justify-between ${
                glassEffect
                  ? 'bg-gradient-to-r from-white/60 to-white/30 border-b border-white/20'
                  : 'border-b border-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Accent bar */}
                <div className="w-1 h-5 bg-secondary rounded-full" />
                <h3 className="text-sm font-black text-primary uppercase tracking-widest">
                  {title}
                </h3>
              </div>
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-primary hover:bg-white/60 rounded-xl transition-all shadow-sm hover:shadow-md"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </motion.button>
            </div>
            
            {/* Content */}
            <div className="p-8 max-h-[80vh] overflow-y-auto no-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
