import Link from "next/link";

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative w-9 h-9 md:w-10 md:h-10">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-primary-light to-secondary/20 shadow-lg shadow-primary/20" />
        <div className="relative h-full w-full rounded-xl flex items-center justify-center">
          <span className="text-white font-black text-sm md:text-base leading-none">
            WM
          </span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-sm md:text-base font-black text-primary uppercase tracking-tight">
          WM Constructora
        </span>
      </div>
    </div>
  );
}