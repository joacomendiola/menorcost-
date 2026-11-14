import { describe, expect, it } from 'vitest';
import { ApiError } from '../api';
import {
  MENSAJE_ERROR_CONEXION,
  obtenerMensajeErrorCatalogo,
} from './catalogo-errores';

describe('obtenerMensajeErrorCatalogo', () => {
  it('conserva el mensaje de respuestas HTTP', () => {
    expect(obtenerMensajeErrorCatalogo(new ApiError(400, 'Rango inválido'))).toBe(
      'Rango inválido',
    );
  });

  it('usa el texto del CU cuando se interrumpe la conexión', () => {
    expect(obtenerMensajeErrorCatalogo(new ApiError(0, 'sin conexión'))).toBe(
      MENSAJE_ERROR_CONEXION,
    );
  });
});
