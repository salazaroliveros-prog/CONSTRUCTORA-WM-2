/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Phone, 
  MapPin, 
  History, 
  ExternalLink,
  Filter,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { Client } from '../constants';
import { subscribeToCollection, addDocument, deleteDocument, parseError } from '../services/firestoreService';
import { usePagination } from '../hooks/usePagination';
import Pagination from './ui/Pagination';
import Modal from './ui/Modal';
import { toast } from 'sonner';

export default function ClientsModule() {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeToCollection('clients', (data) => {
      setClients(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('¿ELIMINAR CLIENTE?')) {
      try {
        await deleteDocument('clients', id);
        toast.success("Cliente eliminado");
      } catch (error) {
        console.error(error);
        toast.error("Error al eliminar", { description: parseError(error) });
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name) return;
    
    if (newClient.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newClient.email)) {
        toast.error("Error de validación", { description: "Email no es válido" });
        return;
      }
    }
    
    setSaving(true);
    try {
      await addDocument('clients', { ...newClient, projects: [] });
      setIsModalOpen(false);
      setNewClient({ name: '', email: '', phone: '', address: '' });
      toast.success("Cliente registrado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al registrar", { description: parseError(error) });
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { 
    currentItems: paginatedClients, 
    currentPage, 
    totalPages, 
    nextPage, 
    prevPage, 
    goToPage,
    startIndex,
    totalItems: totalClientsCount
  } = usePagination<Client>(filteredClients, 9);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div id="clients-management" className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
         <div className="flex items-center gap-3">
           <div className="p-3 bg-slate-900 text-secondary rounded-xl shrink-0">
             <Users size={20} />
           </div>
           <div className="text-left">
             <h2 className="text-sm font-black text-primary tracking-widest uppercase leading-none">Clientes</h2>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Directorio y Seguimiento</p>
           </div>
         </div>
         <div className="flex gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="BUSCAR CLIENTE..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-secondary" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center p-2.5 bg-secondary text-primary rounded-lg hover:bg-secondary/90 transition-all"
            >
              <Plus size={18} />
            </button>
         </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title="Registrar Nuevo Cliente"
      >
        <form onSubmit={handleCreate} className="space-y-6 text-left">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre Completo</label>
            <input 
              type="text"
              required
              placeholder="NOMBRE DEL CLIENTE"
              value={newClient.name}
              onChange={e => setNewClient({...newClient, name: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo Electrónico</label>
              <input 
                type="email"
                placeholder="EMAIL@EJEMPLO.COM"
                value={newClient.email}
                onChange={e => setNewClient({...newClient, email: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono</label>
              <input 
                type="text"
                placeholder="+502 "
                value={newClient.phone}
                onChange={e => setNewClient({...newClient, phone: e.target.value})}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección de Entrega / Cobro</label>
            <input 
              type="text"
              placeholder="CIUDAD, ZONA..."
              value={newClient.address}
              onChange={e => setNewClient({...newClient, address: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-secondary"
            />
          </div>
          <button 
            type="submit"
            disabled={saving}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-secondary hover:text-primary transition-all disabled:opacity-50"
          >
            {saving ? 'PROCESANDO...' : 'GUARDAR CLIENTE'}
          </button>
        </form>
      </Modal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {paginatedClients.map((client) => (
          <motion.div
            key={client.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group h-fit flex flex-col"
          >
            <div className="bg-slate-900 h-1 group-hover:bg-secondary transition-colors" />
            <div className="p-3 text-left">
              <div className="flex justify-between items-start mb-3">
                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-[10px]">
                  {client.name?.split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div className="flex gap-1">
                   <button 
                     onClick={() => handleDelete(client.id)}
                     className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                   >
                     <Trash2 size={12} />
                   </button>
                </div>
              </div>
              <h3 className="text-xs font-black text-primary tracking-tight uppercase group-hover:text-secondary transition-colors truncate mb-0.5">{client.name}</h3>
              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest truncate italic mb-3">
                {client.email || 'Sin correo registrado'}
              </p>
              
              <div className="space-y-1.5 pt-3 border-t border-slate-50 text-[8px] font-bold uppercase tracking-widest">
                <div className="flex justify-between">
                  <span className="text-slate-400">Proyectos</span>
                  <span className="text-primary">{client.projects?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Teléfono</span>
                  <span className="text-primary truncate ml-2 max-w-[100px]">{client.phone || '--'}</span>
                </div>
              </div>

              <div className="mt-4 flex gap-1.5">
                <button 
                  onClick={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
                  className="flex-1 bg-slate-50 border border-slate-100 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  EXPEDIENTE
                </button>
                <button className="flex items-center justify-center p-1.5 bg-slate-50 border border-slate-100 rounded-lg text-slate-400 hover:text-secondary transition-colors">
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredClients.length === 0 && (
          <div className="col-span-full py-20 text-center opacity-20">
             <Users size={48} className="mx-auto mb-4" />
             <p className="text-[10px] font-black uppercase tracking-[0.2em]">No hay clientes registrados</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <Pagination 
          currentPage={currentPage}
          totalPages={totalPages}
          onNext={nextPage}
          onPrev={prevPage}
          onPage={goToPage}
          totalItems={totalClientsCount}
          startIndex={startIndex}
          itemsPerPage={9}
          compact={true}
        />
      </div>
    </div>
  );
}
