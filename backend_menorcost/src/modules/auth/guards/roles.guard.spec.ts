import type { ExecutionContext } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';

const reflectorMock = { getAllAndOverride: vi.fn() };
const guard = new RolesGuard(reflectorMock as never);

function contexto(user?: { rol: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RolesGuard', () => {
  it('permite el acceso cuando no hay roles requeridos', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(contexto({ rol: 'CLIENTE' }))).toBe(true);
  });

  it('permite el acceso cuando el rol coincide', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMINISTRADOR']);

    expect(guard.canActivate(contexto({ rol: 'ADMINISTRADOR' }))).toBe(true);
  });

  it('niega el acceso cuando el rol no coincide', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMINISTRADOR']);

    expect(guard.canActivate(contexto({ rol: 'CLIENTE' }))).toBe(false);
  });

  it('niega el acceso cuando no hay usuario', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMINISTRADOR']);

    expect(guard.canActivate(contexto(undefined))).toBe(false);
  });
});
