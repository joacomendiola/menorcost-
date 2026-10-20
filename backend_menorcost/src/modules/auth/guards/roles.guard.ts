import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Rol } from '../../../generated/prisma/enums.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    return !!request.user && rolesRequeridos.includes(request.user.rol);
  }
}
