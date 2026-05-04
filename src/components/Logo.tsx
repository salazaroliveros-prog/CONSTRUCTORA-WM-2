/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LogoProps {
  className?: string;
  avatarUrl?: string | null;
}

export default function Logo({ className = "h-8 w-auto", avatarUrl }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-12 h-12 shrink-0">
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt="User Avatar" 
            className="w-full h-full rounded-2xl object-cover shadow-lg border-2 border-secondary p-0.5 bg-white"
            referrerPolicy="no-referrer"
          />
        ) : (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <rect x="20" y="40" width="40" height="40" fill="#1A1A1A" />
            <path d="M20 40 L40 10 L60 40 Z" fill="#F15A24" />
            <rect x="50" y="30" width="30" height="50" fill="rgba(26,26,26,0.8)" />
            <rect x="55" y="35" width="20" height="10" fill="#F15A24" fillOpacity="0.2" />
          </svg>
        )}
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-lg font-black tracking-tighter text-primary">CONSTRUCTORA</span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-black text-secondary tracking-[0.2em]">WM/M&S</span>
          <div className="h-0.5 flex-1 bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
