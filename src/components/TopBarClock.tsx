import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, Clock, X, Plus, CalendarDays, Bell } from 'lucide-react';
import { toast } from 'sonner';

export default function TopBarClock() {
  const [time, setTime] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [events, setEvents] = useState<{ id: string, date: string, title: string, time: string, alerted?: boolean }[]>([]);
  const [newEvent, setNewEvent] = useState({ title: '', time: '' });
  const [selectedDate, setSelectedDate] = useState(new Date());

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
        className="flex items-center gap-2 p-2 px-3 bg-slate-50 text-slate-600 hover:text-primary rounded-xl border border-slate-100 transition-all group"
      >
        <div className="flex flex-col items-end leading-none">
          <span className="text-[10px] font-black uppercase">{time.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span className="text-[9px] font-bold text-slate-400">{time.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-secondary group-hover:scale-105 transition-transform shadow-sm">
          <CalendarIcon size={16} />
        </div>
      </button>

      <AnimatePresence>
        {showCalendar && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden z-50 ring-1 ring-slate-900/5 transform-origin-top-right"
          >
            <div className="bg-slate-900 text-white p-5 pb-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <CalendarDays size={16} className="text-secondary" /> Calendario
                </h3>
                <button onClick={() => setShowCalendar(false)} aria-label="Cerrar calendario" className="text-slate-400 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-full">
                  <input 
                    type="date" 
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    title="Seleccionar fecha"
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="p-5 bg-slate-50">
              <h4 className="text-[10px] font-black tracking-widest uppercase text-slate-400 mb-3">Actividades de la fecha</h4>
              
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {dayEvents.length === 0 ? (
                  <p className="text-[9px] font-bold text-slate-400 text-center py-4 italic uppercase">Sin actividades</p>
                ) : (
                  dayEvents.map(e => (
                    <div key={e.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black text-primary uppercase truncate">{e.title}</p>
                        <p className="text-[8px] font-bold text-secondary uppercase flex items-center gap-1 mt-0.5">
                          <Clock size={10} /> {e.time}
                        </p>
                      </div>
                      <button onClick={() => removeEvent(e.id)} aria-label="Eliminar actividad" className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-4 border-t border-slate-200 space-y-3">
                 <input 
                  type="text" 
                  placeholder="NUEVA ACTIVIDAD..." 
                  value={newEvent.title}
                  onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full text-[10px] font-black uppercase px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-secondary"
                 />
                 <div className="flex gap-2">
                   <input 
                    type="time" 
                    value={newEvent.time}
                    onChange={e => setNewEvent({...newEvent, time: e.target.value})}
                    title="Seleccionar hora"
                    className="w-full text-[10px] font-black uppercase px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-secondary"
                   />
                   <button 
                    onClick={addEvent}
                    aria-label="Agregar actividad"
                    disabled={!newEvent.title || !newEvent.time}
                    className="aspect-square h-full bg-secondary text-primary rounded-lg flex items-center justify-center hover:bg-secondary/90 disabled:opacity-50 transition-colors"
                   >
                     <Plus size={16} />
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


