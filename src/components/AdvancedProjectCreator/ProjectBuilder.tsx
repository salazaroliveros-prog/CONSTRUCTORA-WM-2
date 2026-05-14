/**
 * ProjectBuilder - Componente principal para creación/edición de proyectos
 * Refactorizado: usa hooks personalizados, componentes extraídos, lógica centralizada
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Typology } from '../../constants';
import { generateBudgetPDF, generateBudgetPDFAPU, generateBudgetPDFEjecutivo, generateBudgetPDFCliente, generateBudgetJSON, generateBOM } from '../../lib/reports';
import { addDocument } from '../../services/firestoreService';
import { fmtQ } from '../../utils/format';
import { useProjectBuilder } from '../../hooks/useProjectBuilder';
import { ProjectHeader } from './ProjectHeader';
import { ProjectItemsList } from './ProjectItemsList';
import { ProjectSummary } from './ProjectSummary';
import BudgetTable from '../BudgetTable';
import { PurchaseOrderPanel } from './PurchaseOrderPanel';
import { subscribeToCollection } from '../../services/firestoreService';
import { toast } from 'sonner';
import { APU_BY_TYPOLOGY } from '../../lib/apuLibrary';
import { parseError } from '../../services/firestoreService';

interface ProjectBuilderProps {
  onComplete?: () => void;
}

export default function ProjectBuilder({ onComplete }: ProjectBuilderProps) {
  // Hook principal de lógica de negocio
  const {
    project,
    selectedTypology,
    selectedMarketLevel,
    selectedSlabType,
    wasteFactors,
    areaTotal,
    showAdvancedConfig,
    setShowAdvancedConfig,
    budgetTree,
    setBudgetTree,
    totals,
    estimatedDays,
    totalMaterialsSummary,
    marketMultipliers,
    setProject,
    setSelectedTypology,
    setSelectedMarketLevel,
    setSelectedSlabType,
    setWasteFactors,
    setAreaTotal,
    addItem,
    removeItem,
    updateItemField,
    updateQuantity,
    updateDuration,
    updateMaterial,
    updateLabor,
    addCustomItem,
    addAPUItem
  } = useProjectBuilder();

  // Estado local de UI
  const [searchTerm, setSearchTerm] = useState('');
  const [showAPUPanel, setShowAPUPanel] = useState(false);
  const [apuSearch, setApuSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [clientList, setClientList] = useState<{ id: string; name: string }[]>([]);
  const [supplierList, setSupplierList] = useState<{ id: string; name: string; category: string }[]>([]);
  const [showOCModal, setShowOCModal] = useState(false);

  // Cargar clientes y proveedores
  useEffect(() => {
    const u1 = subscribeToCollection('clients', (data: any[]) =>
      setClientList(data.map(c => ({ id: c.id, name: c.name })))
    );
    const u2 = subscribeToCollection('suppliers', (data: any[]) =>
      setSupplierList(data.map(s => ({ id: s.id, name: s.name, category: s.category || 'GENERAL' })))
    );
    return () => { u1(); u2(); };
  }, []);

  // Cambio de tipología
  const handleTypologyChange = (newTypology: Typology) => {
    setSelectedTypology(newTypology);
  };

  /**
   * Maneja el guardado del proyecto
   */
  const handleSaveProject = async () => {
    if (!project.name || project.items.length === 0) {
      toast.error('Datos incompletos', { description: 'Debe ingresar un nombre y agregar renglones' });
      return;
    }

    setSaving(true);
    try {
      const projectData = {
        ...project,
        typology: selectedTypology,
        budgetTree: budgetTree,
        budget: totals.totalBudget,
        directCosts: totals.totalDirect,
        marketLevel: selectedMarketLevel,
        slabType: selectedSlabType,
        area: areaTotal || undefined,
        costPerSqm: totals.costPerM2 || undefined
      };

      const id = await addDocument('projects', projectData);
      toast.success('Proyecto guardado exitosamente');
      if (onComplete) onComplete();
    } catch (error: any) {
      toast.error('Error al guardar', { description: parseError(error) });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Maneja la exportación a PDF
   */
const handleExportPDF = (type: 'completo' | 'ejecutivo' | 'apu' | 'cliente') => {
    try {
      const totalsOverride = {
        directCost: totals.totalDirect,
        materialsTotal: totals.materialsTotal,
        laborTotal: totals.laborTotal,
        indirectCost: totals.indirectCost,
        adminCost: totals.adminCost,
        personalCost: totals.personalCost,
        totalBudget: totals.totalBudget,
        estimatedDays,
      };
      const fullProject = {
        ...project,
        directCosts: totals.totalDirect,
        progress: 0,
        budget: totals.totalBudget
      };
      switch (type) {
        case 'completo':
          generateBudgetPDF(fullProject as any, totalsOverride);
          break;
        case 'apu':
          generateBudgetPDFAPU(fullProject as any, totalsOverride);
          break;
        case 'ejecutivo':
          generateBudgetPDFEjecutivo(fullProject as any, totalsOverride);
          break;
        case 'cliente':
          generateBudgetPDFCliente(fullProject as any, totalsOverride);
          break;
      }
      toast.success(`PDF generado: ${type}`);
    } catch (error) {
      toast.error('Error al generar PDF',{ description: parseError(error as any) });
    }
  };

  // Filtrar ítems APU
  const availableAPU = useMemo(() => {
    const apuList = APU_BY_TYPOLOGY[selectedTypology as keyof typeof APU_BY_TYPOLOGY] || [];
    if (!apuSearch) return apuList;
    return apuList.filter(apu =>
      apu.description.toLowerCase().includes(apuSearch.toLowerCase()) ||
      apu.code.toLowerCase().includes(apuSearch.toLowerCase())
    );
  }, [selectedTypology, apuSearch]);

  return (
    <div className="space-y-6">
      {/* Header con configuración */}
      <ProjectHeader
        selectedTypology={selectedTypology as Typology}
        onTypologyChange={handleTypologyChange}
        selectedMarketLevel={selectedMarketLevel}
        onMarketLevelChange={setSelectedMarketLevel}
        selectedSlabType={selectedSlabType}
        onSlabTypeChange={setSelectedSlabType}
        showAdvancedConfig={showAdvancedConfig}
        onToggleAdvanced={() => setShowAdvancedConfig(v => !v)}
        areaTotal={areaTotal}
        onAreaTotalChange={setAreaTotal}
        wasteFactors={wasteFactors}
        onWasteFactorsChange={setWasteFactors}
      />

      {/* Panel de ítems APU (búsqueda) */}
      {showAPUPanel && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Biblioteca APU</h3>
            <button
              onClick={() => setShowAPUPanel(false)}
              className="text-slate-500 hover:text-slate-700"
            >
              Cerrar
            </button>
          </div>
          <input
            type="text"
            placeholder="Buscar en APU..."
            value={apuSearch}
            onChange={(e) => setApuSearch(e.target.value)}
            className="w-full px-4 py-2 text-[9px] border border-slate-300 rounded-lg mb-3"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
            {availableAPU.map(apu => (
              <div
                key={apu.id}
                onClick={() => {
                  if (addAPUItem(apu as any)) {
                    setShowAPUPanel(false);
                    setApuSearch('');
                  }
                }}
                className="p-3 border border-slate-200 rounded-lg cursor-pointer hover:border-secondary hover:shadow-md transition-all"
              >
                <p className="text-[9px] font-bold text-slate-800">{apu.description}</p>
                <p className="text-[8px] text-slate-500">{apu.code} · {apu.unit}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Biblioteca de renglones (búsqueda y selección) */}
      <ProjectItemsList
        selectedTypology={selectedTypology}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onAddItem={addItem}
      />

      {/* Tabla de presupuesto */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase text-slate-800">
            Presupuesto Detallado
            <span className="ml-2 text-[9px] font-normal text-slate-500">
              ({project.items.length} renglones)
            </span>
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAPUPanel(v => !v)}
              className="px-3 py-1.5 text-[8px] font-bold uppercase bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
            >
              {showAPUPanel ? 'Ocultar APU' : 'Buscar APU'}
            </button>
            <button
              onClick={addCustomItem}
              className="px-3 py-1.5 text-[8px] font-bold uppercase bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              + Personalizado
            </button>
          </div>
        </div>

        <BudgetTable
          lines={budgetTree}
          projectQty={1}
          onUpdate={setBudgetTree}
          onAddCustom={addCustomItem}
          editingAllowed={true}
          marketMultipliers={marketMultipliers}
          wasteFactors={wasteFactors}
        />
      </div>

      {/* Resumen de costos profesional */}
      <ProjectSummary
        items={project.items}
        totals={{
          ...totals,
          equipmentTotal: budgetTree.reduce((s, l) => s + (l.equipmentTotal ?? (l.equipmentCost || 0) * l.qty), 0),
          taxTotal: totals.totalDirect * 0.12,
          profitTotal: totals.totalDirect * 0.15,
          contingencyTotal: totals.totalDirect * 0.05,
        }}
        budgetLines={budgetTree}
        estimatedDays={estimatedDays}
        projectName={project.name}
        clientName={project.clientName}
        onExportPDF={handleExportPDF}
        onExportJSON={() => {
          const fullProject = { ...project, directCosts: totals.totalDirect, budget: totals.totalBudget } as any;
          generateBudgetJSON(fullProject, {
            directCost: totals.totalDirect, materialsTotal: totals.materialsTotal, laborTotal: totals.laborTotal,
            indirectCost: totals.indirectCost, adminCost: totals.adminCost, personalCost: totals.personalCost,
            totalBudget: totals.totalBudget, estimatedDays,
          });
          toast.success('JSON exportado');
        }}
        onSaveProject={handleSaveProject}
        isSaving={saving}
      />

      {/* Resumen de Materiales */}
      {totalMaterialsSummary.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <h3 className="text-sm font-black uppercase text-slate-800 mb-4">
            Resumen Total de Materiales
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 font-bold text-slate-700">Material</th>
                  <th className="text-right py-2 font-bold text-slate-700">Unidad</th>
                  <th className="text-right py-2 font-bold text-slate-700">Cantidad</th>
                  <th className="text-right py-2 font-bold text-slate-700">Costo Total</th>
                </tr>
              </thead>
              <tbody>
                {totalMaterialsSummary.map((mat, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 text-slate-700">{mat.name}</td>
                    <td className="py-2 text-right text-slate-600">{mat.unit}</td>
                    <td className="py-2 text-right text-slate-600">
                      {mat.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-right font-bold text-slate-800">
                      Q {mat.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Panel de Órdenes de Compra */}
      <PurchaseOrderPanel
        projectId={project.id}
        projectName={project.name}
        items={project.items}
        suppliers={supplierList}
        onOrderCreated={() => {
          // Opcional: recargar algo o notificar
        }}
      />
    </div>
  );
}
