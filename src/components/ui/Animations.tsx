/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Advanced Animation Components - v0.dev inspired effects
 * Includes: Stagger animations, glassmorphism, gradients, skeletons, micro-interactions
 */

import React, { useState, useRef, useCallback, CSSProperties } from 'react';
import { motion, AnimatePresence, useInView, useAnimation, Variants, HTMLMotionProps } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Info, Sparkles, CheckCircle, AlertTriangle, X, ChevronRight } from 'lucide-react';

// Utility
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// ANIMATION VARIANTS - Framer Motion
// ============================================

// Stagger container for lists/grids
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

// Stagger item for list elements
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
};

// Fade up animation
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
};

// Slide in from right (for sidebars)
export const slideInRight: Variants = {
  hidden: { x: '100%', opacity: 0 },
  show: { 
    x: 0, 
    opacity: 1, 
    transition: { 
      type: 'spring', 
      damping: 25, 
      stiffness: 300 
    } 
  },
  exit: { 
    x: '100%', 
    opacity: 0, 
    transition: { duration: 0.2 } 
  },
};

// Slide in from left
export const slideInLeft: Variants = {
  hidden: { x: '-100%', opacity: 0 },
  show: { 
    x: 0, 
    opacity: 1, 
    transition: { 
      type: 'spring', 
      damping: 25, 
      stiffness: 300 
    } 
  },
  exit: { 
    x: '-100%', 
    opacity: 0, 
    transition: { duration: 0.2 } 
  },
};

// Scale up animation
export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
};

// Card hover effect (3D tilt)
export const cardHover: Variants = {
  rest: { 
    scale: 1, 
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    rotateX: 0,
    rotateY: 0,
  },
  hover: { 
    scale: 1.02, 
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    rotateX: 0,
    rotateY: 0,
    transition: { duration: 0.2 },
  },
};

// ============================================
// ANIMATED CONTAINER (Stagger Effect)
// ============================================

interface AnimatedContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: React.ElementType;
}

export function AnimatedContainer({ 
  children, 
  className, 
  delay = 0.05,
  as: _Component = 'div',
}: AnimatedContainerProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: {
            staggerChildren: delay,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// ANIMATED ITEM
// ============================================

interface AnimatedItemProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variants?: Variants;
}

export function AnimatedItem({ 
  children, 
  className, 
  delay = 0,
  variants = staggerItem,
}: AnimatedItemProps) {
  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="show"
      className={className}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// GLASSMORPHISM CARD
// ============================================

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
  hoverEffect?: boolean;
}

export function GlassCard({ 
  children, 
  className, 
  intensity = 'medium',
  hoverEffect = false,
}: GlassCardProps) {
  const intensityStyles = {
    low: 'bg-white/40 backdrop-blur-md border border-white/30',
    medium: 'bg-white/50 backdrop-blur-lg border border-white/40',
    high: 'bg-white/60 backdrop-blur-xl border border-white/50',
  };

  return (
    <motion.div
      whileHover={hoverEffect ? { scale: 1.02, y: -2 } : undefined}
      whileTap={hoverEffect ? { scale: 0.98 } : undefined}
      className={cn(
        'rounded-2xl shadow-xl',
        intensityStyles[intensity],
        'hover:shadow-2xl transition-shadow duration-300',
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// GRADIENT BACKGROUND
// ============================================

interface GradientBackgroundProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'rainbow';
  animated?: boolean;
}

const gradientStyles: Record<string, string> = {
  primary: 'from-slate-900 via-slate-800 to-slate-900',
  secondary: 'from-amber-500 via-orange-500 to-amber-500',
  success: 'from-emerald-500 via-teal-500 to-emerald-500',
  warning: 'from-amber-400 via-orange-500 to-amber-400',
  danger: 'from-red-500 via-rose-500 to-red-500',
  rainbow: 'from-violet-500 via-amber-500 via-emerald-500 via-cyan-500 to-violet-500',
};

export function GradientBackground({ 
  children, 
  className, 
  variant = 'primary',
  animated = false,
}: GradientBackgroundProps) {
  return (
    <div 
      className={cn(
        'relative overflow-hidden rounded-2xl',
        className
      )}
    >
      {/* Gradient layer */}
      <div 
        className={cn(
          'absolute inset-0 bg-gradient-to-r',
          gradientStyles[variant],
          animated && 'animate-gradient bg-[length:200%_200%]'
        )}
        style={animated ? {
          animation: 'gradient 3s ease infinite',
        } : undefined}
      />
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
}

// ============================================
// SKELETON LOADERS
// ============================================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({ 
  className, 
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantStyles = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-slate-200 dark:bg-slate-700',
        variantStyles[variant],
        animationStyles[animation],
        className
      )}
      style={{ width, height }}
    />
  );
}

// Skeleton Card
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700', className)}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" height={12} width="60%" />
          <Skeleton variant="text" height={10} width="40%" />
        </div>
      </div>
      <Skeleton variant="rectangular" height={60} className="mb-3" />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" height={24} width={60} />
        <Skeleton variant="rectangular" height={24} width={60} />
      </div>
    </div>
  );
}

// Skeleton Table Row
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-slate-100 dark:border-slate-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-3 py-3">
          <Skeleton variant="text" height={12} width={Math.random() * 60 + 40 + '%'} />
        </td>
      ))}
    </tr>
  );
}

// ============================================
// MICRO-INTERACTION BUTTONS
// ============================================

interface MicroButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  glowEffect?: boolean;
}

export function MicroButton({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  glowEffect = false,
  className,
  disabled,
  ...props
}: MicroButtonProps) {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-[10px]',
    md: 'px-4 py-2.5 text-xs',
    lg: 'px-6 py-3 text-sm',
  };

  const variantStyles = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800',
    secondary: 'bg-secondary text-primary hover:bg-amber-400',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-black uppercase tracking-wider rounded-xl transition-all',
        sizeStyles[size],
        variantStyles[variant],
        disabled && 'opacity-50 cursor-not-allowed',
        glowEffect && !disabled && 'shadow-lg hover:shadow-xl',
        className
      )}
      style={glowEffect && !disabled ? {
        boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)',
      } : undefined}
      {...props}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </motion.button>
  );
}

// ============================================
// TOOLTIP
// ============================================

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ 
  children, 
  content, 
  position = 'top',
  delay = 200,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => setShow(true), delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  };

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute z-50 px-2 py-1 text-[8px] font-black uppercase tracking-wider bg-slate-900 text-white rounded-lg whitespace-nowrap',
              positionStyles[position]
            )}
          >
            {content}
            <div className={cn(
              'absolute w-2 h-2 bg-slate-900 rotate-45',
              position === 'top' && 'top-full left-1/2 -translate-x-1/2 -mt-1',
              position === 'bottom' && 'bottom-full left-1/2 -translate-x-1/2 -mb-1',
              position === 'left' && 'left-full top-1/2 -translate-y-1/2 -ml-1',
              position === 'right' && 'right-full top-1/2 -translate-y-1/2 -mr-1',
            )} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// PROGRESS BAR WITH EASING
// ============================================

interface AnimatedProgressProps {
  value: number;
  max?: number;
  className?: string;
  color?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function AnimatedProgress({
  value,
  max = 100,
  className,
  color = '#f59e0b',
  showLabel = false,
  size = 'md',
  animated = true,
}: AnimatedProgressProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const sizeStyles = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-[8px] font-black uppercase text-slate-400">Progreso</span>
          <span className="text-[8px] font-black text-slate-600">{Math.round(percentage)}%</span>
        </div>
      )}
      <div className={cn('bg-slate-100 rounded-full overflow-hidden', sizeStyles[size])}>
        <motion.div
          initial={animated ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{
            duration: 1,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ============================================
// PULSING BADGE
// ============================================

interface PulsingBadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  pulse?: boolean;
}

export function PulsingBadge({
  children,
  variant = 'info',
  className,
  pulse = true,
}: PulsingBadgeProps) {
  const variantStyles = {
    success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-600 border-red-500/20',
    info: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  };

  return (
    <span className={cn(
      'relative inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-full border',
      variantStyles[variant],
      className
    )}>
      {pulse && (
        <span className={cn(
          'absolute inline-flex h-full w-full rounded-full opacity-75',
          variant === 'success' && 'animate-ping bg-emerald-500',
          variant === 'warning' && 'animate-ping bg-amber-500',
          variant === 'danger' && 'animate-ping bg-red-500',
          variant === 'info' && 'animate-ping bg-blue-500',
        )} />
      )}
      {children}
    </span>
  );
}

// ============================================
// CONFETTI CELEBRATION
// ============================================

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
  colors?: string[];
  particleCount?: number;
}

export function Confetti({ 
  active, 
  onComplete,
  colors = ['#f59e0b', '#10b981', '#3b82f6', '#f43f5e', '#8b5cf6'],
  particleCount = 50,
}: ConfettiProps) {
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    color: string;
    rotation: number;
    scale: number;
  }>>([]);

  React.useEffect(() => {
    if (active) {
      const newParticles = Array.from({ length: particleCount }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: -10,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        scale: Math.random() * 0.5 + 0.5,
      }));
      setParticles(newParticles);
      
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [active, colors, particleCount, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ 
            x: `${particle.x}%`, 
            y: -20, 
            rotate: 0,
            scale: particle.scale,
          }}
          animate={{ 
            y: '110vh', 
            rotate: particle.rotation + 720,
            x: `${particle.x + (Math.random() - 0.5) * 20}%`,
          }}
          transition={{
            duration: 2 + Math.random() * 2,
            ease: 'easeOut',
          }}
          className="absolute w-3 h-3"
          style={{ 
            backgroundColor: particle.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}

// ============================================
// HOVER CARD (3D Tilt Effect)
// ============================================

interface HoverCardProps {
  children: React.ReactNode;
  className?: string;
  perspective?: number;
}

export function HoverCard({ 
  children, 
  className,
  perspective = 1000,
}: HoverCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    
    setRotation({
      x: -y * 10,
      y: x * 10,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotation({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective,
        transformStyle: 'preserve-3d',
      }}
      animate={{
        rotateX: rotation.x,
        rotateY: rotation.y,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={cn('relative', className)}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// REVEAL ON SCROLL
// ============================================

interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade';
}

export function RevealOnScroll({ 
  children, 
  className,
  threshold = 0.1,
  direction = 'up',
}: RevealOnScrollProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '0px 0px -50px 0px' });

  const directionVariants = {
    up: { hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0 } },
    down: { hidden: { opacity: 0, y: -40 }, visible: { opacity: 1, y: 0 } },
    left: { hidden: { opacity: 0, x: -40 }, visible: { opacity: 1, x: 0 } },
    right: { hidden: { opacity: 0, x: 40 }, visible: { opacity: 1, x: 0 } },
    fade: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  };

  return (
    <motion.div
      ref={ref}
      variants={directionVariants[direction]}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// MARQUEE (Scrolling Text)
// ============================================

interface MarqueeProps {
  text: string;
  className?: string;
  speed?: number;
  direction?: 'left' | 'right';
}

export function Marquee({ 
  text, 
  className,
  speed = 30,
  direction = 'left',
}: MarqueeProps) {
  return (
    <div className={cn('overflow-hidden whitespace-nowrap', className)}>
      <motion.div
        animate={{ 
          x: direction === 'left' ? ['0%', '-50%'] : ['-50%', '0%'],
        }}
        transition={{
          duration: text.length / speed,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="inline-block"
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-secondary">
          {text} &nbsp;•&nbsp; {text} &nbsp;•&nbsp; {text} &nbsp;•&nbsp; 
        </span>
      </motion.div>
    </div>
  );
}

// ============================================
// NOTIFICATION TOAST (Enhanced)
// ============================================

interface NotificationToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  onClose?: () => void;
  duration?: number;
}

export function NotificationToast({
  type,
  title,
  message,
  onClose,
  duration = 5000,
}: NotificationToastProps) {
  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <X size={18} className="text-red-500" />,
    warning: <AlertTriangle size={18} className="text-amber-500" />,
    info: <Info size={18} className="text-blue-500" />,
  };

  const borderColors = {
    success: 'border-l-emerald-500',
    error: 'border-l-red-500',
    warning: 'border-l-amber-500',
    info: 'border-l-blue-500',
  };

  React.useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose?.(), duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      className={cn(
        'flex items-start gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-l-4',
        borderColors[type]
      )}
    >
      {icons[type]}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white">
          {title}
        </p>
        {message && (
          <p className="text-[9px] text-slate-500 mt-0.5">{message}</p>
        )}
      </div>
      <button 
        onClick={onClose}
        className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <X size={14} className="text-slate-400" />
      </button>
    </motion.div>
  );
}

// ============================================
// EXPORT DEFAULT
// ============================================

export default {
  AnimatedContainer,
  AnimatedItem,
  GlassCard,
  GradientBackground,
  Skeleton,
  SkeletonCard,
  SkeletonTableRow,
  MicroButton,
  Tooltip,
  AnimatedProgress,
  PulsingBadge,
  Confetti,
  HoverCard,
  RevealOnScroll,
  Marquee,
  NotificationToast,
  // Variants
  staggerContainer,
  staggerItem,
  fadeUp,
  slideInRight,
  slideInLeft,
  scaleUp,
  cardHover,
};
