import { useOutletContext } from 'react-router-dom';

export interface AdminOutletContext {
  /** Texto de búsqueda ya con debounce. */
  search: string;
  /** Valor del select de estado ('todos' o un enum del backend). */
  estado: string;
  /** Vuelve a pedir los KPI y contadores de pestañas. */
  refrescarKpis: () => void;
}

export function useAdminContext(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>();
}