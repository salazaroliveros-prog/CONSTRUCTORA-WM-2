import { TopographyParams, LegalRestrictions, ServiceAvailability, LogisticsInfo } from './engineering';

export interface EmergencyContact {
  nombre: string;
  telefono: string;
  parentesco: string;
}

export interface ClientDocument {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  nit: string;
  tipoPersona: 'PERSONA' | 'EMPRESA';
  profesion?: string;
  empresa?: string;
  cargo?: string;
  comoConocio?: string;
  contactoEmergencia?: EmergencyContact;
  documentos?: {
    tipo: 'DPI' | 'PASAPORTE' | 'NIT' | 'OTRO';
    numero: string;
    fechaVencimiento?: string;
    url?: string;
  }[];
  estado: 'ACTIVO' | 'INACTIVO';
  proyectosIds: string[];
  totalProyectos: number;
  totalFacturado: number;
  ultimaCompra?: string;
  notas?: string;
  ownerId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TerrainData {
  id?: string;
  clientId: string;
  direccion: string;
  municipio: string;
  departamento: string;
  coordenadas?: { lat: number; lng: number };
  topografia: TopographyParams;
  restriccionesLegales?: LegalRestrictions;
  servicios: ServiceAvailability;
  logistica: LogisticsInfo;
  notas?: string;
  ownerId: string;
}

export interface ClientSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  tipoPersona: string;
  estado: string;
  totalProyectos: number;
  totalFacturado: number;
}

/** @deprecated Use ClientDocument instead — kept for legacy UI compatibility */
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  nit?: string;
  type?: 'PERSONA' | 'EMPRESA';
  notes?: string;
  status?: 'ACTIVO' | 'INACTIVO';
  projects?: string[];
}

export const EMPTY_CLIENT_FORM: Omit<ClientDocument, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> = {
  name: '',
  email: '',
  phone: '',
  address: '',
  nit: '',
  tipoPersona: 'PERSONA',
  estado: 'ACTIVO',
  proyectosIds: [],
  totalProyectos: 0,
  totalFacturado: 0,
};