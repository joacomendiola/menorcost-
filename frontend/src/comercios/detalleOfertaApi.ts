import { api } from '../api';

export interface DetalleOferta {
  producto: {
    id: string;
    titulo: string;
    descripcion: string;
    imagen: string;
    precioLista: string;
    precioPublico: string;
    fechaVencimiento: string;
    stock: number;
    categoria: {
      nombre: string;
      slug: string;
    };
  };
  comercio: {
    id: string;
    nombreFantasia: string;
    latitud: number;
    longitud: number;
    calle: string;
    numero: string;
    localidad: string;
    provincia: string;
  };
}

export interface CanastaItem {
  idCanastaItem: string;
  productoId: string;
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  producto: {
    idProducto: string;
    titulo: string;
    imagen: string;
    stock: number;
    precioPublico: string;
    estado: string;
    fechaVencimiento: string;
  };
}

export interface CanastaResumen {
  idCanasta: string | null;
  comercioId: string;
  comercio: {
    idComercio: string;
    nombreFantasia: string;
  } | null;
  subtotal: string;
  items: CanastaItem[];
}

export const detalleOfertaApi = {
  obtener: (comercioId: string, productoId: string) =>
    api<DetalleOferta>(
      `/comercios/publicos/${encodeURIComponent(
        comercioId,
      )}/productos/${encodeURIComponent(productoId)}`,
    ),

  obtenerTodasLasCanastas: (token: string) =>
    api<CanastaResumen[]>('/canastas', {
      token,
    }),

  obtenerCanasta: (token: string, comercioId: string) =>
    api<CanastaResumen>(
      `/canastas/${encodeURIComponent(comercioId)}`,
      {
        token,
      },
    ),

    agregarACanasta: (
    token: string,
    comercioId: string,
    productoId: string,
    cantidad = 1,
  ) =>
    api<CanastaResumen>(
      `/canastas/${encodeURIComponent(comercioId)}/items`,
      {
        method: 'POST',
        token,
        body: {
          productoId,
          cantidad,
        },
      },
    ),

    actualizarCantidad: (
    token: string,
    comercioId: string,
    productoId: string,
    cantidad: number,
    ) =>
    api<CanastaResumen>(
        `/canastas/${encodeURIComponent(comercioId)}/items/${encodeURIComponent(productoId)}`,
        {
        method: 'PATCH',
        token,
        body: {
        cantidad,
        },
        },
    ),
    
    eliminarDeCanasta: (
    token: string,
    comercioId: string,
    productoId: string,
    ) =>
    api<CanastaResumen>(
        `/canastas/${encodeURIComponent(comercioId)}/items/${encodeURIComponent(productoId)}`,
        {
        method: 'DELETE',
        token,
        },
    ),
};