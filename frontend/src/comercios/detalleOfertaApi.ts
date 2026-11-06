import { api } from '../api';

export interface DetalleOferta {
  producto: {
    id: string;
    titulo: string;
    descripcion: string;
    imagen: string;
    precioLista: string;
    precioMenorcost: string;
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

export interface CanastaResumen {
  idCanasta: string | null;
  comercioId: string;
  subtotal: string;
  items: Array<{
    idCanastaItem: string;
    productoId: string;
    cantidad: number;
    precioUnitario: string;
    subtotal: string;
  }>;
}

export const detalleOfertaApi = {
  obtener: (comercioId: string, productoId: string) =>
    api<DetalleOferta>(
      `/comercios/publicos/${encodeURIComponent(
        comercioId,
      )}/productos/${encodeURIComponent(productoId)}`,
    ),

  agregarACanasta: (
    token: string,
    comercioId: string,
    productoId: string,
    cantidad = 1,
  ) =>
    api<CanastaResumen>(`/baskets/${encodeURIComponent(comercioId)}/items`, {
      method: 'POST',
      token,
      body: {
        productoId,
        cantidad,
      },
    }),
};