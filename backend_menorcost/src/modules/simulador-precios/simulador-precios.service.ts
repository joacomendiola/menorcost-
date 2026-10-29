import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  calcularPrecios,
  PrecioInvalidoError,
} from './simulador-precios.calculo.js';
import { MP_FEE_ESTIMADA } from './simulador-precios.constants.js';
import type { SimularPrecioDto } from './dto/simular-precio.dto.js';
import type { SimulacionPrecioResultado } from './simulador-precios.types.js';

@Injectable()
export class SimuladorPreciosService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular(dto: SimularPrecioDto): Promise<SimulacionPrecioResultado> {
    const config = await this.prisma.configComision.findFirst({
      where: { activa: true },
      orderBy: { createdAt: 'desc' },
      select: { comisionMenorcost: true },
    });

    if (!config) {
      throw new ServiceUnavailableException(
        'No hay una configuración de comisión activa',
      );
    }

    try {
      return calcularPrecios({
        precioBaseNeto: dto.precioBaseNeto,
        precioLista: dto.precioLista,
        comisionMenorcostTasa: config.comisionMenorcost.toString(),
        tasaMpEstimada: MP_FEE_ESTIMADA,
      });
    } catch (error) {
      if (error instanceof PrecioInvalidoError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
