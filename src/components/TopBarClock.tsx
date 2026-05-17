import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Clock, X, Plus, CalendarDays, Bell } from 'lucide-react';
import { toast } from 'sonner';

export default function TopBarClock() {
  const [time, setTime] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [events, setEvents] = useState<{ id: string, date: string, title: string, time: string, alerted?: boolean }[]>(() => {
    const saved = localStorage.getItem('app-agenda-events');
    return saved ? JSON.parse(saved) : [];
  });
  const [newEvent, setNewEvent] = useState({ title: '', time: '' });
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    localStorage.setItem('app-agenda-events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);
      
      const currentDate = now.toISOString().split('T')[0];
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      
      // Simple alert check
      let needsUpdate = false;
      const updatedEvents = events.map(e => {
        if (e.date === currentDate && e.time === currentTimeStr && !e.alerted) {
          toast.info(`Recordatorio: ${e.title}`, { duration: 10000 });
          needsUpdate = true;
          return { ...e, alerted: true };
        }
        return e;
      });
      
      if (needsUpdate) {
        setEvents(updatedEvents);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [events]);

  const addEvent = () => {
    if (!newEvent.title || !newEvent.time) return;
    setEvents([...events, {
      id: Date.now().toString(),
      date: selectedDate.toISOString().split('T')[0],
      title: newEvent.title,
      time: newEvent.time
    }]);
    setNewEvent({ title: '', time: '' });
  };

  const removeEvent = (id: string) => {
    setEvents(events.filter(e => e.id !== id));
  };

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const dayEvents = events.filter(e => e.date === selectedDateStr);

  return (
    <div className="relative z-50">
      <button 
        onClick={() => setShowCalendar(!showCalendar)}
        className="flex items-center gap-3 p-2 px-3.5 bg-white/5 text-white/70 hover:text-amber-500 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all group shadow-inner"
      >
        <div className="flex flex-col items-end leading-tight">
          <span className="text-[9px] font-black uppercase tracking-wider">{time.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span className="text-[10px] font-black text-amber-500 tracking-tighter">{time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-amber-500 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-black transition-all shadow-lg">
          <CalendarIcon size={16} />
        </div>
      </button>

      <AnimatePresence>
        {showCalendar && (
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="absolute right-0 mt-4 w-85 max-w-[calc(100vw-2rem)] bg-[#0e121d] border border-white/10 rounded-4xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-50 ring-1 ring-white/10 transform-origin-top-right backdrop-blur-xl"
          >
            <div className="bg-linear-to-br from-[#1a1f2e] to-[#0e121d] text-white p-6 pb-7 border-b border-white/5">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[11px] font-black uppercase tracking-[0.3em] flex items-center gap-2.5 text-amber-500">
                  <CalendarDays size={18} /> Calendario
                </h3>
                <button onClick={() => setShowCalendar(false)} aria-label="Cerrar calendario" className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all">
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-full relative group">
                  <input 
                    type="date" 
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    title="Seleccionar fecha"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all group-hover:bg-black/60"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-[#0e121d]/50">
              <h4 className="text-[9px] font-black tracking-[0.2em] uppercase text-white/30 mb-4 px-1">Actividades de la fecha</h4>
              
              <div className="space-y-2.5 mb-5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {dayEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 opacity-20">
                    <CalendarIcon size={32} />
                    <p className="text-[10px] font-black text-white uppercase mt-3 tracking-widest">Sin actividades</p>
                  </div>
                ) : (
                  dayEvents.map(e => (
                    <motion.div 
                      key={e.id} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black text-amber-500 uppercase tracking-tight truncate">{e.title}</p>
                        <p className="text-[9px] font-bold text-white/40 uppercase flex items-center gap-1.5 mt-1">
                          <Clock size={12} className="text-amber-500/50" /> {e.time}
                        </p>
                      </div>
                      <button onClick={() => removeEvent(e.id)} aria-label="Eliminar actividad" className="w-8 h-8 flex items-center justify-center text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all ml-2">
                        <X size={16} />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              <div className="pt-6 border-t border-white/5 space-y-4">
                 <div className="space-y-3">
                   <label className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] ml-1">Nueva Actividad</label>
                   <input 
                    type="text" 
                    placeholder="¿QUÉ HAY QUE HACER?..." 
                    value={newEvent.title}
                    onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                    className="w-full text-[10px] font-black uppercase px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 text-white placeholder:text-white/10 transition-all"
                   />
                 </div>
                 <div className="flex gap-3">
                   <input 
                    type="time" 
                    value={newEvent.time}
                    onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                    title="Seleccionar hora"
                    className="flex-1 text-[10px] font-black uppercase px-4 py-3 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-amber-500/50 text-white transition-all"
                   />
                   <button 
                    onClick={addEvent}
                    aria-label="Agregar actividad"
                    disabled={!newEvent.title || !newEvent.time}
                    className="w-12 h-12 bg-amber-500 text-black rounded-xl flex items-center justify-center hover:bg-amber-400 disabled:opacity-30 disabled:grayscale transition-all shadow-[0_8px_16px_rgba(245,158,11,0.2)]"
                   >
                     <Plus size={20} strokeWidth={3} />
                   </button>
                 </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


