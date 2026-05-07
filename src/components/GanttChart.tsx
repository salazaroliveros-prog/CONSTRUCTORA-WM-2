import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToCollection, updateDocument } from '../services/firestoreService';
import { Calendar, Clock, AlertTriangle, CheckCircle2, Edit2, Save, X, TrendingUp, Activity } from 'lucide-react';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface GanttTask {
  id: string;
  name: string;
  duration: number; // días
  dependencies: string[]; // IDs de tareas predecesoras
  progress: number; // 0-100
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
  projectId: string;
  category: string;
  laborQty: number;
  laborRate: number;
}

// CPM Algorithm
function calculateCPM(tasks: GanttTask[]): GanttTask[] {
  const taskMap = new Map(tasks.map(t => [t.id, { ...t }]));
  
  // Forward pass (Early Start/Finish)
  taskMap.forEach(task => {
    if (task.dependencies.length === 0) {
      task.earlyStart = 0;
    } else {
      task.earlyStart = Math.max(...task.dependencies.map(depId => {
        const dep = taskMap.get(depId);
        return dep ? dep.earlyFinish : 0;
      }));
    }
    task.earlyFinish = task.earlyStart + task.duration;
  });

  const maxFinish = Math.max(...Array.from(taskMap.values()).map(t => t.earlyFinish));

  // Backward pass (Late Start/Finish)
  const sorted = Array.from(taskMap.values()).sort((a, b) => b.earlyFinish - a.earlyFinish);
  sorted.forEach(task => {
    const successors = Array.from(taskMap.values()).filter(t => t.dependencies.includes(task.id));
    if (successors.length === 0) {
      task.lateFinish = maxFinish;
    } else {
      task.lateFinish = Math.min(...successors.map(s => s.lateStart));
    }
    task.lateStart = task.lateFinish - task.duration;
    task.slack = task.lateStart - task.earlyStart;
    task.isCritical = task.slack === 0;
  });

  return Array.from(taskMap.values());
}

export default function GanttChart() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<GanttTask>>({});

  useEffect(() => {
    const unsub = subscribeToCollection('projects', (data: any[]) => {
      setProjects(data.filter(p => p.status === 'EJECUCION'));
      if (!selectedProjectId && data.length > 0) {
        setSelectedProjectId(data.find(p => p.status === 'EJECUCION')?.id || '');
      }
    });
    return unsub;
  }, []);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const ganttTasks = useMemo<GanttTask[]>(() => {
    if (!selectedProject?.items) return [];
    
    // Convertir items del presupuesto a tareas Gantt
    const items = selectedProject.items.filter((i: any) => i.selected);
    const tasks: GanttTask[] = items.map((item: any, idx: number) => {
      const laborQty = item.labor?.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0) || 1;
      const laborRate = item.labor?.[0]?.quantity || 1; // rendimiento (unidades/día)
      const duration = Math.max(1, Math.ceil((item.projectQuantity || 1) * (item.durationDays || 1) / laborRate));
      
      // Dependencias automáticas: cada tarea depende de la anterior en su categoría
      const prevInCategory = items
        .slice(0, idx)
        .reverse()
        .find((prev: any) => prev.category === item.category && prev.selected);
      
      return {
        id: item.id,
        name: item.description,
        duration,
        dependencies: prevInCategory ? [prevInCategory.id] : [],
        progress: 0,
        earlyStart: 0,
        earlyFinish: 0,
        lateStart: 0,
        lateFinish: 0,
        slack: 0,
        isCritical: false,
        projectId: selectedProject.id,
        category: item.category,
        laborQty,
        laborRate
      };
    });

    return calculateCPM(tasks);
  }, [selectedProject]);

  const projectDuration = ganttTasks.length > 0 ? Math.max(...ganttTasks.map(t => t.earlyFinish)) : 0;
  const criticalPath = ganttTasks.filter(t => t.isCritical);

  const handleEdit = (task: GanttTask) => {
    setEditingTaskId(task.id);
    setEditForm({ duration: task.duration, dependencies: task.dependencies });
  };

  const handleSave = async () => {
    if (!editingTaskId || !selectedProject) return;
    
    const updatedItems = selectedProject.items.map((item: any) => {
      if (item.id === editingTaskId) {
        return { ...item, durationDays: editForm.duration || item.durationDays };
      }
      return item;
    });

    try {
      await updateDocument('projects', selectedProject.id, { items: updatedItems });
      toast.success('Renglón actualizado');
      setEditingTaskId(null);
    } catch (err) {
      toast.error('Error al actualizar');
    }
  };

  const handleCancel = () => {
    setEditingTaskId(null);
    setEditForm({});
  };

  // Notificaciones en tiempo real
  useEffect(() => {
    if (ganttTasks.length === 0) return;
    
    const criticalDelayed = ganttTasks.filter(t => t.isCritical && t.progress < 50 && t.earlyStart < projectDuration * 0.3);
    if (criticalDelayed.length > 0) {
      toast.warning(`${criticalDelayed.length} tareas críticas requieren atención`, {
        description: criticalDelayed[0].name,
        duration: 5000
      });
    }
  }, [ganttTasks, projectDuration]);

  const maxDuration = projectDuration || 1;

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
            <Activity size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">Diagrama de Gantt</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase">CPM · Rutas Críticas · Holguras</p>
          </div>
        </div>

        <select
          value={selectedProjectId}
          onChange={e => setSelectedProjectId(e.target.value)}
          className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase focus:outline-none focus:border-blue-500"
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-blue-500" />
            <span className="text-[8px] font-black text-slate-400 uppercase">Duración Total</span>
          </div>
          <p className="text-xl font-black text-slate-700">{projectDuration} días</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-500" />
            <span className="text-[8px] font-black text-slate-400 uppercase">Ruta Crítica</span>
          </div>
          <p className="text-xl font-black text-red-600">{criticalPath.length} tareas</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-green-500" />
            <span className="text-[8px] font-black text-slate-400 uppercase">Avance Global</span>
          </div>
          <p className="text-xl font-black text-green-600">
            {ganttTasks.length > 0 ? Math.round(ganttTasks.reduce((sum, t) => sum + t.progress, 0) / ganttTasks.length) : 0}%
          </p>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-auto">
        <div className="min-w-[1200px] p-4">
          {/* Timeline header */}
          <div className="flex mb-4">
            <div className="w-80 shrink-0" />
            <div className="flex-1 flex">
              {Array.from({ length: Math.ceil(maxDuration / 5) }).map((_, i) => (
                <div key={i} className="flex-1 text-center text-[8px] font-black text-slate-400 uppercase">
                  Día {i * 5}
                </div>
              ))}
            </div>
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            {ganttTasks.map(task => {
              const isEditing = editingTaskId === task.id;
              const barLeft = (task.earlyStart / maxDuration) * 100;
              const barWidth = (task.duration / maxDuration) * 100;

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg border",
                    task.isCritical ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
                  )}
                >
                  {/* Task info */}
                  <div className="w-80 shrink-0">
                    {isEditing ? (
                      <div className="space-y-1">
                        <input
                          type="number"
                          value={editForm.duration}
                          onChange={e => setEditForm({ ...editForm, duration: parseInt(e.target.value) || 1 })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                          placeholder="Duración (días)"
                        />
                        <div className="flex gap-1">
                          <button onClick={handleSave} className="flex-1 px-2 py-1 bg-green-500 text-white rounded text-[8px] font-bold uppercase">
                            <Save size={10} className="inline mr-1" />Guardar
                          </button>
                          <button onClick={handleCancel} className="flex-1 px-2 py-1 bg-slate-300 text-slate-700 rounded text-[8px] font-bold uppercase">
                            <X size={10} className="inline mr-1" />Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black text-slate-700 uppercase truncate flex-1">{task.name}</p>
                          <button onClick={() => handleEdit(task)} className="p-1 hover:bg-slate-200 rounded">
                            <Edit2 size={12} className="text-slate-400" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 uppercase">
                          <Clock size={10} />
                          <span>{task.duration}d</span>
                          {task.isCritical && (
                            <>
                              <span className="text-red-500">·</span>
                              <span className="text-red-500">Crítica</span>
                            </>
                          )}
                          {task.slack > 0 && (
                            <>
                              <span>·</span>
                              <span>Holgura: {task.slack}d</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Gantt bar */}
                  <div className="flex-1 relative h-8 bg-slate-100 rounded">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%`, left: `${barLeft}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={cn(
                        "absolute top-1 bottom-1 rounded flex items-center justify-center text-[8px] font-black text-white uppercase",
                        task.isCritical ? "bg-gradient-to-r from-red-500 to-red-600" : "bg-gradient-to-r from-blue-500 to-blue-600"
                      )}
                    >
                      {task.progress > 0 && `${task.progress}%`}
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Critical Path Summary */}
      {criticalPath.length > 0 && (
        <div className="shrink-0 bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-500" />
            <span className="text-[9px] font-black text-red-600 uppercase">Ruta Crítica</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {criticalPath.map(t => (
              <span key={t.id} className="px-2 py-1 bg-white border border-red-200 rounded text-[8px] font-bold text-red-700 uppercase">
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
