import React, { useEffect, useState } from "react";

export default function TopBarClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-[10px] font-mono font-bold text-neutral-500">
      {currentTime.toLocaleTimeString("es-GT", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </span>
  );
}
