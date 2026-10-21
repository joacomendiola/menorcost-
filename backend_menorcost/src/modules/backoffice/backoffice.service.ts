import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailerService } from '../auth/mailer/mailer.service.js';

@Injectable()
export class BackofficeService {
  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService // Inyectamos el servicio
  ) {}

  // 1. MÉTRICAS (KPIs)
  async getKpis() {
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const [altasPendientes, altasAprobadas, bajasSolicitadas, denunciasAbiertas] = await Promise.all([
      this.prisma.usuario.count({ where: { estado: 'PENDIENTE_VERIFICACION' } }),
      this.prisma.usuario.count({
        where: { estado: 'HABILITADO', createdAt: { gte: hace30Dias }, rol: 'COMERCIANTE' },
      }),
      this.prisma.usuario.count({ where: { estado: 'SOLICITUD_BAJA_PENDIENTE' } }),
      this.prisma.reporte.count({
        where: { estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] } },
      }),
    ]);

    return { altasPendientes, altasAprobadas30Dias: altasAprobadas, bajasSolicitadas, denunciasAbiertas };
  }

  // 2. SOLICITUDES DE ALTA 
  async listarAltas(search?: string, estado?: string) {
    const whereUsuario: any = { rol: 'COMERCIANTE' };
    
    if (estado && estado !== 'todos') {
      whereUsuario.estado = estado;
    }

    // Implementación del buscador real
    if (search) {
      whereUsuario.OR = [
        { dni: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        // TODO: Agregar cuando Dev 2 suba el modelo Comercio definitivo
        // { comercio: { cuit: { contains: search } } },
        // { comercio: { razon_social: { contains: search, mode: 'insensitive' } } }
      ];
    }

    return this.prisma.comercio.findMany({
      where: { usuario: whereUsuario },
      include: {
        usuario: { include: { direcciones: true } },
      },
    });
  }

  async aprobarAlta(idComercio: string) {
    const comercio = await this.prisma.comercio.findUnique({ 
      where: { idComercio },
      include: { usuario: true } // Necesitamos el usuario para saber el email
    });
    
    if (!comercio) throw new NotFoundException('Comercio no encontrado');

    const actualizado = await this.prisma.usuario.update({
      where: { id: comercio.usuarioId },
      data: { estado: 'HABILITADO' },
    });

    await this.mailerService.enviar({
      to: comercio.usuario.email,
      subject: '¡Bienvenido a Menorcost! Tu cuenta ha sido habilitada',
      html: `<p>Hola <strong>${comercio.usuario.nombre}</strong>,</p>
             <p>Nos alegra informarte que tu comercio ha superado la auditoría y ya está <strong>HABILITADO</strong> en nuestra plataforma.</p>
             <p>¡Ya puedes comenzar a publicar tus ofertas!</p>`
    });

    return actualizado;
  }

  async rechazarAlta(idComercio: string, motivo: string) {
    const comercio = await this.prisma.comercio.findUnique({ 
      where: { idComercio },
      include: { usuario: true }
    });
    
    if (!comercio) throw new NotFoundException('Comercio no encontrado');

    const actualizado = await this.prisma.usuario.update({
      where: { id: comercio.usuarioId },
      data: { estado: 'DOCUMENTACION_RECHAZADA' },
    });

   
    await this.mailerService.enviar({
      to: comercio.usuario.email,
      subject: 'Actualización sobre tu solicitud en Menorcost',
      html: `<p>Hola <strong>${comercio.usuario.nombre}</strong>,</p>
             <p>Hemos revisado tu documentación, pero lamentablemente tu solicitud ha sido rechazada por el siguiente motivo:</p>
             <blockquote><em>${motivo}</em></blockquote>
             <p>Por favor, corrige estos detalles y vuelve a intentarlo.</p>`
    });

    return actualizado;
  }

  // 3. BAJAS DE CUENTAS 
  async listarBajas(search?: string) {
    const whereClause: any = { estado: 'SOLICITUD_BAJA_PENDIENTE' };

    if (search) {
      whereClause.OR = [
        { dni: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.usuario.findMany({
      where: whereClause,
      include: { solicitudesBaja: true }, 
    });
  }

  async aprobarBaja(idUsuario: string) {
    const pedidosPendientes = await this.prisma.pedido.count({
      where: {
        usuarioId: idUsuario,
        estado: { in: ['PENDIENTE_DE_RETIRO', 'EN_PREPARACION'] }, 
      },
    });

    const reportesAbiertos = await this.prisma.reporte.count({
      where: {
        id_denunciado: idUsuario,
        estado_reporte: { in: ['PENDIENTE_REVISION', 'BAJO_INVESTIGACION'] },
      },
    });

    // Mock para pagos en disputa (hasta que Dev 4 suba esquema de pagos)
    const pagosEnDisputa = 0;

    if (pedidosPendientes > 0 || pagosEnDisputa > 0 || reportesAbiertos > 0) {
      throw new BadRequestException('No se puede dar de baja una cuenta con transacciones o reclamos en curso');
    }

    return this.prisma.usuario.update({
      where: { id: idUsuario },
      data: { estado: 'SUSPENDIDO', deletedAt: new Date() }, // Se marca suspendido y se aplica Soft Delete
    });
  }

  async rechazarBaja(idUsuario: string) {
    return this.prisma.usuario.update({
      where: { id: idUsuario },
      data: { estado: 'HABILITADO' },
    });
  }

  // 4. DENUNCIAS Y MODERACIÓN 
  async listarDenuncias(search?: string, estado?: string) {
    const whereClause: any = {};
    if (estado && estado !== 'todos') whereClause.estado_reporte = estado;

    return this.prisma.reporte.findMany({
      where: whereClause,
      include: {
        pedido: true,
        emisor: true,
        denunciado: true,
      },
      orderBy: [
        { denunciado: { estado: 'desc' } }, 
        { fecha_reporte: 'desc' },
      ],
    });
  }

  async alternarInvestigacion(idReporte: number) {
    const reporte = await this.prisma.reporte.findUnique({ where: { id_reporte: idReporte } });
    if (!reporte) throw new NotFoundException('Reporte no encontrado');

    const nuevoEstado = reporte.estado_reporte === 'PENDIENTE_REVISION' ? 'BAJO_INVESTIGACION' : 'PENDIENTE_REVISION';
    const nuevoEstadoUsuario = nuevoEstado === 'BAJO_INVESTIGACION' ? 'BAJO_INVESTIGACION' : 'HABILITADO';

    return this.prisma.$transaction([
      this.prisma.reporte.update({
        where: { id_reporte: idReporte },
        data: { estado_reporte: nuevoEstado },
      }),
      this.prisma.usuario.update({
        where: { id: reporte.id_denunciado },
        data: { estado: nuevoEstadoUsuario },
      }),
    ]);
  }

  async marcarResuelto(idReporte: number, idAdmin: string) {
    const reporte = await this.prisma.reporte.findUnique({ where: { id_reporte: idReporte }, include: { denunciado: true } });
    if (!reporte) throw new NotFoundException('Reporte no encontrado');

    return this.prisma.$transaction(async (tx) => {
      await tx.reporte.update({
        where: { id_reporte: idReporte },
        data: { estado_reporte: 'DESESTIMADO', id_admin: idAdmin, fecha_resolucion: new Date() },
      });

      if (reporte.denunciado.estado === 'BAJO_INVESTIGACION') {
        await tx.usuario.update({
          where: { id: reporte.id_denunciado },
          data: { estado: 'HABILITADO' },
        });
      }
      return { success: true };
    });
  }

  async sancionar(idReporte: number, idAdmin: string) {
    const reporte = await this.prisma.reporte.findUnique({ 
      where: { id_reporte: idReporte },
      include: { denunciado: true }
    });
    
    if (!reporte) throw new NotFoundException('Reporte no encontrado');

    const result = await this.prisma.$transaction([
      this.prisma.reporte.update({
        where: { id_reporte: idReporte },
        data: { estado_reporte: 'RESUELTO', id_admin: idAdmin, fecha_resolucion: new Date() },
      }),
      this.prisma.usuario.update({
        where: { id: reporte.id_denunciado },
        data: { estado: 'SUSPENDIDO' }, 
      }),
    ]);

    // Opcional:Notificar al usuario de su suspensión
    await this.mailerService.enviar({
      to: reporte.denunciado.email,
      subject: 'Notificación Importante: Suspensión de Cuenta',
      html: `<p>Estimado usuario,</p>
             <p>Le informamos que, tras investigar el reporte #${idReporte}, la administración ha resuelto <strong>SUSPENDER</strong> su cuenta por incumplimiento de las políticas de Menorcost.</p>`
    });
    
    return result;
  }
}