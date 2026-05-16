/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Gradient Header Component - v0.dev inspired animated gradients
 */

import React from 'react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GradientHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'rainbow' | 'ocean' | 'sunset';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
}

const gradientConfigs = {
  primary: {
    gradient: 'from-slate-900 via-slate-800 to-slate-900',
    accent: 'from-amber-500/20 via-orange-500/10 to-transparent',
    text: 'text-white',
    subtitle: 'text-slate-400',
  },
  secondary: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    accent: 'from-white/20 via-transparent to-transparent',
    text: 'text-white',
    subtitle: 'text-amber-100',
  },
  success: {
    gradient: 'from-emerald-600 via-teal-600 to-emerald-600',
    accent: 'from-white/20 via-transparent to-transparent',
    text: 'text-white',
    subtitle: 'text-emerald-100',
  },
  warning: {
    gradient: 'from-amber-500 via-orange-500 to-amber-500',
    accent: 'from-white/20 via-transparent to-transparent',
    text: 'text-white',
    subtitle: 'text-amber-100',
  },
  danger: {
    gradient: 'from-red-600 via-rose-600 to-red-600',
    accent: 'from-white/20 via-transparent to-transparent',
    text: 'text-white',
    subtitle: 'text-red-100',
  },
  rainbow: {
    gradient: 'from-violet-600 via-amber-500 via-emerald-500 via-cyan-500 to-violet-600',
    accent: 'from-white/20 via-transparent to-transparent',
    text: 'text-white',
    subtitle: 'text-white/80',
  },
  ocean: {
    gradient: 'from-slate-900 via-blue-900 to-slate-900',
    accent: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    text: 'text-white',
    subtitle: 'text-slate-400',
  },
  sunset: {
    gradient: 'from-slate-900 via-purple-900 via-pink-700 to-slate-900',
    accent: 'from-amber-500/20 via-pink-500/10 to-transparent',
    text: 'text-white',
    subtitle: 'text-slate-400',
  },
};

const sizeConfigs = {
  sm: 'py-3 px-4',
  md: 'py-4 px-6',
  lg: 'py-6 px-8',
};

export default function GradientHeader({
  title,
  subtitle,
  icon,
  variant = 'primary',
  size = 'md',
  children,
}: GradientHeaderProps) {
  const config = gradientConfigs[variant];
  const isAnimated = ['rainbow', 'secondary'].includes(variant);

  return (
    <div 
      className={cn(
        'relative overflow-hidden rounded-2xl',
        sizeConfigs[size]
      )}
    >
      {/* Animated gradient background */}
      <div 
        className={cn(
          'absolute inset-0 bg-gradient-to-r',
          config.gradient,
          isAnimated && 'animate-gradient bg-length-200'
        )}
        style={isAnimated ? {
          animation: 'gradient-shift 8s ease infinite',
        } : undefined}
      />
      
      {/* Accent overlay */}
      <div 
        className={cn(
          'absolute inset-0 bg-gradient-to-tr',
          config.accent
        )}
      />
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {icon && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: 'spring',
                stiffness: 300,
                damping: 20,
                delay: 0.2,
              }}
              className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm"
            >
              {icon}
            </motion.div>
          )}
          <div>
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className={cn('text-lg font-black uppercase tracking-wider', config.text)}
            >
              {title}
            </motion.h2>
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className={cn('text-xs font-bold uppercase tracking-widest mt-0.5', config.subtitle)}
              >
                {subtitle}
              </motion.p>
            )}
          </div>
        </div>
        
        {/* Additional content on the right */}
        {children && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            {children}
          </motion.div>
        )}
      </div>

      {/* Decorative circles */}
      <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-20" 
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)' }} 
      />
      <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full opacity-10" 
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)' }} 
      />

      <style>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          25% { background-position: 50% 100%; }
          50% { background-position: 100% 50%; }
          75% { background-position: 50% 0%; }
        }
        .animate-gradient {
          animation: gradient-shift 8s ease infinite;
        }
      `}</style>
    </div>
  );
}

