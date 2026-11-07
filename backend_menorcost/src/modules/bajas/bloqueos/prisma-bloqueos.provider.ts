import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import type {
  BajaBloqueosPort,
  BloqueoBaja,
  ResumenCuentaBaja,
} from './baja-bloqueos.port.js';

/**
 * Implementación real del puerto para CU-1.07: consulta `Pedido` (D4),
 * `Reporte` (D5) y `Producto` (D3) usando el schema existente.
 */
@Injectable()
export class PrismaBajaBloqueosProvider implements BajaBloqueosPort {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerBloqueos(usuarioId: string): Promise<BloqueoBaja[]> {
    const [pedidosPendientes, reportesAbiertos] = await Promise.all([
      this.prisma.pedido.count({
        where: {
          estado: { in: ['PENDIENTE_PAGO', 'PENDIENTE_DE_RETIRO'] },
          OR: [{ usuarioId }, { comercio: { userId: usuarioId } }],
        },
      }),
      this.prisma.reporte.count({
        where: {
          estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] },
          OR: [{ id_emisor: usuarioId }, { id_denunciado: usuarioId }],
        },
      }),
    ]);

    const bloqueos: BloqueoBaja[] = [];

    if (pedidosPendientes > 0) {
      bloqueos.push({
        tipo: 'PEDIDOS',
        message: `Tenés ${pedidosPendientes} pedido(s) o pago(s) en curso.`,
      });
    }

    if (reportesAbiertos > 0) {
      bloqueos.push({
        tipo: 'REPORTES',
        message: `Tenés ${reportesAbiertos} denuncia(s) abierta(s) o en investigación.`,
      });
    }

    return bloqueos;
  }

  async obtenerResumenesCuentas(
    usuarioIds: string[],
  ): Promise<Map<string, ResumenCuentaBaja>> {
    const resumenes = new Map<string, ResumenCuentaBaja>();
    if (usuarioIds.length === 0) return resumenes;

    const [comercios, comoCliente] = await Promise.all([
      this.prisma.comercio.findMany({
        where: { userId: { in: usuarioIds } },
        select: { userId: true, idComercio: true },
      }),
      this.prisma.pedido.groupBy({
        by: ['usuarioId'],
        where: { usuarioId: { in: usuarioIds }, estado: 'ENTREGADO' },
        _count: { _all: true },
      }),
    ]);

    const comercioPorUsuario = new Map(
      comercios.map((c) => [c.userId, c.idComercio]),
    );
    const completadosComoCliente = new Map(
      comoCliente.map((g) => [g.usuarioId, g._count._all]),
    );

    const idsComercio = [...comercioPorUsuario.values()];
    const comoComercio =
      idsComercio.length > 0
        ? await this.prisma.pedido.groupBy({
            by: ['comercioId'],
            where: { comercioId: { in: idsComercio }, estado: 'ENTREGADO' },
            _count: { _all: true },
          })
        : [];
    const completadosComoComercio = new Map(
      comoComercio.map((g) => [g.comercioId, g._count._all]),
    );

    for (const id of usuarioIds) {
      const idComercio = comercioPorUsuario.get(id);
      resumenes.set(id, {
        pedidosCompletados: idComercio
          ? (completadosComoComercio.get(idComercio) ?? 0)
          : (completadosComoCliente.get(id) ?? 0),
        saldoTarifas: 0,
      });
    }

    return resumenes;
  }

  async pausarOfertas(usuarioId: string): Promise<void> {
    const comercio = await this.prisma.comercio.findUnique({
      where: { userId: usuarioId },
      select: { idComercio: true },
    });
    if (!comercio) return;

    // Solo se marcan las ofertas que la baja pausa, para poder restaurarlas
    // sin reactivar las que el comerciante había pausado manualmente.
    await this.prisma.producto.updateMany({
      where: { comercioId: comercio.idComercio, estado: 'ACTIVO' },
      data: { estado: 'PAUSADO', pausadoPorBaja: true },
    });
  }

  async reactivarOfertas(usuarioId: string): Promise<void> {
    const comercio = await this.prisma.comercio.findUnique({
      where: { userId: usuarioId },
      select: { idComercio: true },
    });
    if (!comercio) return;

    // Solo se reactivan las ofertas pausadas por la baja.
    await this.prisma.producto.updateMany({
      where: {
        comercioId: comercio.idComercio,
        estado: 'PAUSADO',
        pausadoPorBaja: true,
      },
      data: { estado: 'ACTIVO', pausadoPorBaja: false },
    });
  }
}
