import React from 'react';
import { Sparkles, Zap, Star, Gem, Palette, Wand2 } from 'lucide-react';

export default function EffectsShowcase() {
  return (
    <div className="p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-primary">
          ✨ Efectos Visuales Mejorados
        </h1>
        <p className="text-lg text-neutral-600">
          Experiencia visual única con efectos avanzados
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="glass-card p-6 kpi-particles">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-blue">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-primary">Efectos de Partículas</h3>
              <p className="text-sm text-neutral-600">
                Partículas flotantes en hover
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 shimmer-effect">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-amber">
              <Zap size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-primary">Efecto Shimmer</h3>
              <p className="text-sm text-neutral-600">
                Barrido de luz en hover
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 highlight-glow">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-purple">
              <Star size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-primary">Efecto Glow</h3>
              <p className="text-sm text-neutral-600">
                Brillo rotativo en hover
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-green">
              <Gem size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-primary">Tarjeta Interactiva</h3>
              <p className="text-sm text-neutral-600">
                Elevación y escala en hover
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-cyan">
              <Palette size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-primary">Borde Gradiente</h3>
              <p className="text-sm text-neutral-600">
                Borde gradiente estático con glow en hover
              </p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 particle-effect shimmer-effect">
          <div className="flex items-center gap-4">
            <div className="icon-box icon-gradient-rose">
              <Wand2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-primary">Efectos Combinados</h3>
              <p className="text-sm text-neutral-600">
                Múltiples efectos juntos
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Badges Mejorados</h2>
        <div className="flex flex-wrap gap-3">
          <span className="badge-success">Éxito</span>
          <span className="badge-warning">Advertencia</span>
          <span className="badge-danger">Error</span>
          <span className="badge-info">Información</span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Botones Mejorados</h2>
        <div className="flex flex-wrap gap-4">
          <button className="btn-primary">
            Botón Primario
          </button>
          <button className="btn-secondary">
            Botón Secundario
          </button>
          <button className="btn-success">
            Efecto Líquido
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Barras de Progreso</h2>
        <div className="space-y-3">
          <div className="progress-bar">
            <div className="progress-bar-fill w-3/4"></div>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill w-[45%]"></div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Indicadores de Estado</h2>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="status-dot status-dot-green"></div>
            <span>En línea</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-dot status-dot-amber"></div>
            <span>Ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="status-dot status-dot-red"></div>
            <span>Desconectado</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Estados de Carga</h2>
        <div className="flex items-center gap-4">
          <div className="skeleton skeleton-text"></div>
          <span>Cargando...</span>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-primary">Skeleton Loader Avanzado</h2>
        <div className="space-y-3">
          <div className="skeleton h-4 w-3/4"></div>
          <div className="skeleton h-4 w-1/2"></div>
          <div className="skeleton h-20 w-full"></div>
        </div>
      </div>
    </div>
  );
}


