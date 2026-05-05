/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LogoProps {
  className?: string;
  avatarUrl?: string | null; // kept for API compatibility, ignored
}

export default function Logo({ className = "h-8 w-auto" }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-10 h-10 shrink-0">
        <img src="/logo.webp" alt="Logo" className="w-full h-full object-contain rounded-xl" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-black tracking-tighter text-primary">CONSTRUCTORA</span>
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-black text-secondary tracking-[0.2em]">WM/M&S</span>
          <div className="h-0.5 flex-1 bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
