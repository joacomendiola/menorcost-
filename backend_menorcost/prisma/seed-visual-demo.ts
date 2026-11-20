import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type {
  EstadoPago,
  EstadoPedido,
  EstadoProducto,
  EstadoReporte,
  TipoDestinoReporte,
  TipoNotificacion,
} from '../src/generated/prisma/enums.js';

const id = (numero: number): string =>
  `00000000-0000-4000-8000-${String(numero).padStart(12, '0')}`;

const fecha = (dias: number): Date =>
  new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

const IDS = {
  PEDIDO: [900, 901, 902, 903, 904, 905, 906].map(id),
  PAGO: [910, 911, 912, 913, 914, 915].map(id),
  CANASTA: [920, 921].map(id),
  CANASTA_ITEM: [930, 931, 932].map(id),
  NOTIFICACION: [950, 951, 952, 953, 954, 955, 956].map(id),
  AUDITORIA: id(960),
  REPORTE: [9001, 9002, 9003],
};

interface ProductoVisual {
  idProducto: string;
  titulo: string;
  fechaVencimiento: Date;
}

interface ItemVisual {
  productoId: string;
  nroLinea: number;
  cantidad: number;
  precio_unitario: string;
  precioBaseNetoAplicado: string;
  comisionMenorcostMonto: string;
  subtotal: string;
  nombreHistorico: string;
  fechaVencimientoHistorica: Date;
}

interface PedidoVisual {
  id_pedido: string;
  nroPedido: string;
  codigoQR: string;
  codigoAlfanumerico: string;
  usuarioId: string;
  comercioId: string;
  estado: EstadoPedido;
  fechaPedido: Date;
  subtotal: string;
  tarifaServicio: string;
  total: string;
  items: ItemVisual[];
}

function item(
  producto: ProductoVisual,
  nroLinea: number,
  cantidad: number,
  precioUnitario: string,
  precioBaseNeto: string,
  comision: string,
  subtotal: string,
): ItemVisual {
  return {
    productoId: producto.idProducto,
    nroLinea,
    cantidad,
    precio_unitario: precioUnitario,
    precioBaseNetoAplicado: precioBaseNeto,
    comisionMenorcostMonto: comision,
    subtotal,
    nombreHistorico: producto.titulo,
    fechaVencimientoHistorica: producto.fechaVencimiento,
  };
}

async function limpiarVisual(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.notificacion.deleteMany({
      where: { id: { in: IDS.NOTIFICACION } },
    });
    await tx.calificacion.deleteMany({
      where: { id_pedido: { in: IDS.PEDIDO } },
    });
    await tx.reporte.deleteMany({
      where: { id_reporte: { in: IDS.REPORTE } },
    });
    await tx.pago.deleteMany({
      where: { idPago: { in: IDS.PAGO } },
    });
    await tx.pedidoItem.deleteMany({
      where: { pedidoId: { in: IDS.PEDIDO } },
    });
    await tx.pedido.deleteMany({
      where: { id_pedido: { in: IDS.PEDIDO } },
    });
    await tx.canastaItem.deleteMany({
      where: { idCanastaItem: { in: IDS.CANASTA_ITEM } },
    });
    await tx.canasta.deleteMany({
      where: { idCanasta: { in: IDS.CANASTA } },
    });
    await tx.auditoriaVencimientoOferta.deleteMany({
      where: { id: IDS.AUDITORIA },
    });
  });
}

async function recalcularReputacion(
  prisma: PrismaClient,
  comercioId: string,
): Promise<void> {
  const agregacion = await prisma.calificacion.aggregate({
    _avg: { puntaje: true },
    _count: { id_calificacion: true },
    where: {
      pedido: { comercioId, estado: 'ENTREGADO' },
    },
  });

  await prisma.comercio.update({
    where: { idComercio: comercioId },
    data: {
      reputacionPromedio:
        Math.round((agregacion._avg.puntaje ?? 0) * 10) / 10,
      totalCalificaciones: agregacion._count.id_calificacion,
    },
  });
}

async function crearCanasta(
  prisma: PrismaClient,
  datos: {
    idCanasta: string;
    usuarioId: string;
    comercioId: string;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      idCanastaItem: string;
      productoId: string;
      cantidad: number;
    }>;
  },
): Promise<void> {
  const canasta = await prisma.canasta.upsert({
    where: {
      usuarioId_comercioId: {
        usuarioId: datos.usuarioId,
        comercioId: datos.comercioId,
      },
    },
    update: { updatedAt: datos.updatedAt },
    create: {
      idCanasta: datos.idCanasta,
      usuarioId: datos.usuarioId,
      comercioId: datos.comercioId,
      createdAt: datos.createdAt,
      updatedAt: datos.updatedAt,
    },
  });

  for (const item of datos.items) {
    await prisma.canastaItem.upsert({
      where: {
        canastaId_productoId: {
          canastaId: canasta.idCanasta,
          productoId: item.productoId,
        },
      },
      update: { cantidad: item.cantidad, updatedAt: datos.updatedAt },
      create: {
        idCanastaItem: item.idCanastaItem,
        canastaId: canasta.idCanasta,
        productoId: item.productoId,
        cantidad: item.cantidad,
        createdAt: datos.createdAt,
        updatedAt: datos.updatedAt,
      },
    });
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL no está definida');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await limpiarVisual(prisma);

    if (process.argv.includes('--clear')) {
      console.log('Datos visuales eliminados.');
      return;
    }

    const cliente = await prisma.usuario.findUniqueOrThrow({
      where: { email: 'cliente@test.com' },
    });
    const centroOwner = await prisma.usuario.findUniqueOrThrow({
      where: { email: 'comercio.centro@test.com' },
    });
    const barrioOwner = await prisma.usuario.findUniqueOrThrow({
      where: { email: 'comercio.barrio@test.com' },
    });
    const admin = await prisma.usuario.findUniqueOrThrow({
      where: { email: 'admin@test.com' },
    });

    const centro = await prisma.comercio.findUniqueOrThrow({
      where: { googlePlaceId: 'menorcost-demo-centro' },
    });
    const barrio = await prisma.comercio.findUniqueOrThrow({
      where: { googlePlaceId: 'menorcost-demo-barrio' },
    });

    const aceite = await prisma.producto.findUniqueOrThrow({
      where: { idProducto: '00000000-0000-4000-8000-000000000151' },
    });
    const leche = await prisma.producto.findUniqueOrThrow({
      where: { idProducto: '00000000-0000-4000-8000-000000000152' },
    });
    const gaseosa = await prisma.producto.findUniqueOrThrow({
      where: { idProducto: '00000000-0000-4000-8000-000000000153' },
    });
    const yogur = await prisma.producto.findUniqueOrThrow({
      where: { idProducto: '00000000-0000-4000-8000-000000000154' },
    });

    const pedidos: PedidoVisual[] = [
      {
        id_pedido: IDS.PEDIDO[0],
        nroPedido: 'VIS-PED-0900',
        codigoQR: 'VIS-QR-0900',
        codigoAlfanumerico: 'VIS0900',
        usuarioId: cliente.id,
        comercioId: centro.idComercio,
        estado: 'ENTREGADO',
        fechaPedido: fecha(-3),
        subtotal: '3500.00',
        tarifaServicio: '350.00',
        total: '3500.00',
        items: [item(aceite, 1, 1, '3500.00', '2800.00', '350.00', '3500.00')],
      },
      {
        id_pedido: IDS.PEDIDO[1],
        nroPedido: 'VIS-PED-0901',
        codigoQR: 'VIS-QR-0901',
        codigoAlfanumerico: 'VIS0901',
        usuarioId: cliente.id,
        comercioId: barrio.idComercio,
        estado: 'ENTREGADO',
        fechaPedido: fecha(-6),
        subtotal: '2800.00',
        tarifaServicio: '280.00',
        total: '2800.00',
        items: [
          item(gaseosa, 1, 1, '2800.00', '2100.00', '280.00', '2800.00'),
        ],
      },
      {
        id_pedido: IDS.PEDIDO[2],
        nroPedido: 'VIS-PED-0902',
        codigoQR: 'VIS-QR-0902',
        codigoAlfanumerico: 'VIS0902',
        usuarioId: cliente.id,
        comercioId: centro.idComercio,
        estado: 'ENTREGADO',
        fechaPedido: fecha(-10),
        subtotal: '5000.00',
        tarifaServicio: '500.00',
        total: '5000.00',
        items: [item(leche, 1, 2, '2500.00', '2000.00', '250.00', '5000.00')],
      },
      {
        id_pedido: IDS.PEDIDO[3],
        nroPedido: 'VIS-PED-0903',
        codigoQR: 'VIS-QR-0903',
        codigoAlfanumerico: 'VIS0903',
        usuarioId: cliente.id,
        comercioId: centro.idComercio,
        estado: 'CANCELADO_POR_FALTA_RETIRO',
        fechaPedido: fecha(-2),
        subtotal: '1250.00',
        tarifaServicio: '125.00',
        total: '1250.00',
        items: [item(yogur, 1, 1, '1250.00', '1000.00', '125.00', '1250.00')],
      },
      {
        id_pedido: IDS.PEDIDO[4],
        nroPedido: 'VIS-PED-0904',
        codigoQR: 'VIS-QR-0904',
        codigoAlfanumerico: 'VIS0904',
        usuarioId: cliente.id,
        comercioId: barrio.idComercio,
        estado: 'ENTREGADO',
        fechaPedido: fecha(-14),
        subtotal: '5600.00',
        tarifaServicio: '560.00',
        total: '5600.00',
        items: [
          item(gaseosa, 1, 2, '2800.00', '2100.00', '280.00', '5600.00'),
        ],
      },
      {
        id_pedido: IDS.PEDIDO[5],
        nroPedido: 'VIS-PED-0905',
        codigoQR: 'VIS-QR-0905',
        codigoAlfanumerico: 'VIS0905',
        usuarioId: cliente.id,
        comercioId: centro.idComercio,
        estado: 'ENTREGADO',
        fechaPedido: fecha(-18),
        subtotal: '3500.00',
        tarifaServicio: '350.00',
        total: '3500.00',
        items: [item(aceite, 1, 1, '3500.00', '2800.00', '350.00', '3500.00')],
      },
      {
        id_pedido: IDS.PEDIDO[6],
        nroPedido: 'VIS-PED-0906',
        codigoQR: 'VIS-QR-0906',
        codigoAlfanumerico: 'VIS0906',
        usuarioId: cliente.id,
        comercioId: barrio.idComercio,
        estado: 'ENTREGADO',
        fechaPedido: fecha(-21),
        subtotal: '2800.00',
        tarifaServicio: '280.00',
        total: '2800.00',
        items: [
          item(gaseosa, 1, 1, '2800.00', '2100.00', '280.00', '2800.00'),
        ],
      },
    ];

    for (const pedido of pedidos) {
      await prisma.pedido.create({
        data: {
          id_pedido: pedido.id_pedido,
          nroPedido: pedido.nroPedido,
          usuarioId: pedido.usuarioId,
          comercioId: pedido.comercioId,
          estado: pedido.estado,
          codigoQR: pedido.codigoQR,
          codigoAlfanumerico: pedido.codigoAlfanumerico,
          fecha_pedido: pedido.fechaPedido,
          subtotal: pedido.subtotal,
          tarifa_servicio: pedido.tarifaServicio,
          comisionMenorcostTasa: '0.1000',
          tasaMpEstimada: '0.0650',
          total: pedido.total,
          formaPago: 'MERCADO_PAGO',
          items: { create: pedido.items },
        },
      });
    }

    const calificaciones = [
      {
        id_pedido: IDS.PEDIDO[0],
        puntaje: 5,
        comentario: 'Llegó antes de la franja y todo impecable.',
        fecha_creacion: fecha(-3),
      },
      {
        id_pedido: IDS.PEDIDO[1],
        puntaje: 4,
        comentario: 'Buena oferta, retiré sin problema aunque el local estaba cerrado.',
        fecha_creacion: fecha(-6),
      },
      {
        id_pedido: IDS.PEDIDO[2],
        puntaje: 5,
        comentario: 'Muy buena atención en el mostrador.',
        fecha_creacion: fecha(-10),
      },
      {
        id_pedido: IDS.PEDIDO[4],
        puntaje: 2,
        comentario: 'El producto no estaba en las condiciones esperadas.',
        fecha_creacion: fecha(-14),
      },
      {
        id_pedido: IDS.PEDIDO[5],
        puntaje: 4,
        comentario: 'Todo correcto, volvería a comprar.',
        fecha_creacion: fecha(-18),
      },
      {
        id_pedido: IDS.PEDIDO[6],
        puntaje: 5,
        comentario: 'Excelente relación precio y calidad.',
        fecha_creacion: fecha(-21),
      },
    ];

    for (const calificacion of calificaciones) {
      await prisma.calificacion.create({ data: calificacion });
    }

    const pagos = pedidos
      .filter((pedido) => pedido.estado === 'ENTREGADO')
      .map((pedido, indice) => ({
        idPago: IDS.PAGO[indice],
        pedidoId: pedido.id_pedido,
        mpPaymentId: `visual-mp-${pedido.codigoAlfanumerico}`,
        nroComprobante: `VIS-${pedido.codigoAlfanumerico}`,
        montoTransaccion: pedido.total,
        comisionMp: (Number(pedido.total) * 0.065).toFixed(2),
        paymentDate: pedido.fechaPedido,
        estado: 'PAGADO' as EstadoPago,
        moneda: 'ARS',
      }));

    for (const pago of pagos) {
      await prisma.pago.create({ data: pago });
    }

    await prisma.auditoriaVencimientoOferta.create({
      data: {
        id: IDS.AUDITORIA,
        productoId: aceite.idProducto,
        comercioId: centro.idComercio,
        estadoAnterior: 'ACTIVO' as EstadoProducto,
        estadoNuevo: 'VENCIDO_ELIMINADO' as EstadoProducto,
        fechaVencimiento: aceite.fechaVencimiento,
        ejecutadoEn: fecha(-1),
      },
    });

    const notificaciones = [
      {
        id: IDS.NOTIFICACION[0],
        usuarioId: cliente.id,
        titulo: 'Pedido entregado',
        mensaje: 'Tu pedido VIS0900 fue entregado en el local.',
        tipo: 'PEDIDO_ENTREGADO' as TipoNotificacion,
        leida: false,
        createdAt: fecha(-3),
        auditoriaVencimientoId: null,
      },
      {
        id: IDS.NOTIFICACION[1],
        usuarioId: cliente.id,
        titulo: 'Pedido entregado',
        mensaje: 'Tu pedido VIS0901 fue entregado en el local.',
        tipo: 'PEDIDO_ENTREGADO' as TipoNotificacion,
        leida: true,
        createdAt: fecha(-6),
        auditoriaVencimientoId: null,
      },
      {
        id: IDS.NOTIFICACION[2],
        usuarioId: cliente.id,
        titulo: 'Pedido cancelado por falta de retiro',
        mensaje: 'El pedido VIS0903 se canceló porque no fue retirado.',
        tipo: 'PEDIDO_CANCELADO_POR_FALTA_RETIRO' as TipoNotificacion,
        leida: false,
        createdAt: fecha(-2),
        auditoriaVencimientoId: null,
      },
      {
        id: IDS.NOTIFICACION[3],
        usuarioId: centroOwner.id,
        titulo: 'Nueva calificación de 5 estrellas',
        mensaje: 'Una clienta calificó tu local con 5 estrellas.',
        tipo: 'PEDIDO_ENTREGADO' as TipoNotificacion,
        leida: false,
        createdAt: fecha(-3),
        auditoriaVencimientoId: null,
      },
      {
        id: IDS.NOTIFICACION[4],
        usuarioId: centroOwner.id,
        titulo: 'Se venció una oferta',
        mensaje: 'Aceite de girasol 900 ml se venció y fue pausado automáticamente.',
        tipo: 'OFERTA_VENCIDA' as TipoNotificacion,
        leida: false,
        createdAt: fecha(-1),
        auditoriaVencimientoId: IDS.AUDITORIA,
      },
      {
        id: IDS.NOTIFICACION[5],
        usuarioId: barrioOwner.id,
        titulo: 'Pedido entregado',
        mensaje: 'El pedido VIS0904 fue marcado como entregado.',
        tipo: 'PEDIDO_ENTREGADO' as TipoNotificacion,
        leida: false,
        createdAt: fecha(-14),
        auditoriaVencimientoId: null,
      },
      {
        id: IDS.NOTIFICACION[6],
        usuarioId: barrioOwner.id,
        titulo: 'Nueva calificación de 5 estrellas',
        mensaje: 'Una clienta calificó tu local con 5 estrellas.',
        tipo: 'PEDIDO_ENTREGADO' as TipoNotificacion,
        leida: true,
        createdAt: fecha(-21),
        auditoriaVencimientoId: null,
      },
    ];

    for (const notificacion of notificaciones) {
      await prisma.notificacion.create({ data: notificacion });
    }

    const reportes = [
      {
        id_reporte: IDS.REPORTE[0],
        id_pedido: IDS.PEDIDO[0],
        id_emisor: cliente.id,
        id_denunciado: centroOwner.id,
        tipo_destino: 'COMERCIO' as TipoDestinoReporte,
        motivo: 'Producto en mal estado',
        descripcion: 'El aceite tenía la fecha de vencimiento muy cercana.',
        estado_reporte: 'BAJO_INVESTIGACION' as EstadoReporte,
        fecha_reporte: fecha(-2),
        id_admin: null,
        fecha_resolucion: null,
      },
      {
        id_reporte: IDS.REPORTE[1],
        id_pedido: IDS.PEDIDO[4],
        id_emisor: cliente.id,
        id_denunciado: barrioOwner.id,
        tipo_destino: 'COMERCIO' as TipoDestinoReporte,
        motivo: 'No cumplió con la oferta',
        descripcion: 'El precio publicado no coincidió con el cobrado.',
        estado_reporte: 'RESUELTO' as EstadoReporte,
        fecha_reporte: fecha(-12),
        id_admin: admin.id,
        fecha_resolucion: fecha(-9),
      },
      {
        id_reporte: IDS.REPORTE[2],
        id_pedido: IDS.PEDIDO[1],
        id_emisor: centroOwner.id,
        id_denunciado: cliente.id,
        tipo_destino: 'CLIENTE' as TipoDestinoReporte,
        motivo: 'Cliente no retiró el pedido',
        descripcion: 'No se presentó dentro de la franja de retiro acordada.',
        estado_reporte: 'PENDIENTE_REVISION' as EstadoReporte,
        fecha_reporte: fecha(-5),
        id_admin: null,
        fecha_resolucion: null,
      },
    ];

    for (const reporte of reportes) {
      await prisma.reporte.create({ data: reporte });
    }

    await crearCanasta(prisma, {
      idCanasta: IDS.CANASTA[0],
      usuarioId: cliente.id,
      comercioId: centro.idComercio,
      createdAt: fecha(-2),
      updatedAt: fecha(-1),
      items: [
        {
          idCanastaItem: IDS.CANASTA_ITEM[0],
          productoId: aceite.idProducto,
          cantidad: 2,
        },
        {
          idCanastaItem: IDS.CANASTA_ITEM[1],
          productoId: leche.idProducto,
          cantidad: 1,
        },
      ],
    });

    await crearCanasta(prisma, {
      idCanasta: IDS.CANASTA[1],
      usuarioId: cliente.id,
      comercioId: barrio.idComercio,
      createdAt: fecha(-4),
      updatedAt: fecha(-3),
      items: [
        {
          idCanastaItem: IDS.CANASTA_ITEM[2],
          productoId: gaseosa.idProducto,
          cantidad: 3,
        },
      ],
    });

    await recalcularReputacion(prisma, centro.idComercio);
    await recalcularReputacion(prisma, barrio.idComercio);

    console.log('Seed visual aplicado.');
    console.log(`Pedidos: ${pedidos.length}`);
    console.log(`Calificaciones: ${calificaciones.length}`);
    console.log(`Pagos: ${pagos.length}`);
    console.log(`Notificaciones: ${notificaciones.length}`);
    console.log(`Reportes: ${reportes.length}`);
    console.log(`Canastas: ${IDS.CANASTA.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
