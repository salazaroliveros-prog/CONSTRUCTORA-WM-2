import React from 'react';
import { Sparkles, Zap, Star, Gem, Palette, Wand2 } from 'lucide-react';

export default function EffectsShowcase() {
  return (
    <div className="p-6 space-y-8">
      {/* Header con efectos */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-gradient-primary">
          ✨ Efectos Visuales Mejorados
        </h1>
        <p className="text-lg text-slate-600 ">
          Experiencia visual única con efectos avanzados
        </p>
      </div>

      {/* Grid de tarjetas con diferentes efectos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Tarjeta con efecto de partículas */}
        <div className="glass-card p-6 particle-effect kpi-particles">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-blue">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Efectos de Partículas</h3>
              <p className="text-sm text-slate-600 ">
                Partículas flotantes en hover
              </p>
            </div>
          </div>
        </div>

        {/* Tarjeta con efecto shimmer */}
        <div className="glass-card p-6 shimmer-effect">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-amber">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Efecto Shimmer</h3>
              <p className="text-sm text-slate-600 ">
                Barrido de luz en hover
              </p>
            </div>
          </div>
        </div>

        {/* Tarjeta con efecto de glow */}
        <div className="glass-card p-6 highlight-glow">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-purple">
              <Star size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Efecto Glow</h3>
              <p className="text-sm text-slate-600 ">
                Brillo rotativo en hover
              </p>
            </div>
          </div>
        </div>

        {/* Tarjeta interactiva */}
        <div className="interactive-card glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-green">
              <Gem size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Tarjeta Interactiva</h3>
              <p className="text-sm text-slate-600 ">
                Elevación y escala en hover
              </p>
            </div>
          </div>
        </div>

        {/* Tarjeta con borde gradiente profesional */}
        <div className="border-animated glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-cyan">
              <Palette size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Borde Gradiente</h3>
              <p className="text-sm text-slate-600 ">
                Borde gradiente estático con glow en hover
              </p>
            </div>
          </div>
        </div>

        {/* Tarjeta con múltiples efectos */}
        <div className="glass-card p-6 particle-effect shimmer-effect highlight-glow">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-rose">
              <Wand2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Efectos Combinados</h3>
              <p className="text-sm text-slate-600 ">
                Múltiples efectos juntos
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de badges */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Badges Mejorados</h2>
        <div className="flex flex-wrap gap-3">
          <span className="badge-success">Éxito</span>
          <span className="badge-warning">Advertencia</span>
          <span className="badge-danger">Error</span>
          <span className="badge-info">Información</span>
          <span className="badge-holographic">Holográfico</span>
        </div>
      </div>

      {/* Sección de botones */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Botones Mejorados</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn-primary-enhanced btn-liquid">
            Botón Primario
          </button>
          <button className="btn-secondary-enhanced btn-waves">
            Botón Secundario
          </button>
          <button className="btn-liquid bg-gradient-success text-white px-6 py-3 rounded-xl font-semibold">
            Efecto Líquido
          </button>
        </div>
      </div>

      {/* Sección de progreso */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Barras de Progreso</h2>
        <div className="space-y-3">
          <div className="progress-neon h-4">
            <div className="progress-neon-fill" style={{ width: '75%' }}></div>
          </div>
          <div className="progress-neon h-6">
            <div className="progress-neon-fill" style={{ width: '45%' }}></div>
          </div>
        </div>
      </div>

      {/* Sección de indicadores de estado */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Indicadores de Estado</h2>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="status-indicator status-online"></div>
            <span>En línea</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-indicator status-busy"></div>
            <span>Ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-indicator status-offline"></div>
            <span>Desconectado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-indicator status-error"></div>
            <span>Error</span>
          </div>
        </div>
      </div>

      {/* Sección de loading */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Estados de Carga</h2>
        <div className="flex items-center gap-4">
          <div className="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>Cargando...</span>
        </div>
      </div>

      {/* Sección de skeleton */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Skeleton Loader Avanzado</h2>
        <div className="space-y-3">
          <div className="skeleton-advanced h-4 w-3/4"></div>
          <div className="skeleton-advanced h-4 w-1/2"></div>
          <div className="skeleton-advanced h-20 w-full"></div>
        </div>
      </div>
    </div>
  );
}
