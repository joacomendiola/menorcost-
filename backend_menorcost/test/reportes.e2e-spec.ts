import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import {
  EstadoPago,
  EstadoPedido,
  EstadoUsuario,
  MotivoReporte,
  TipoDestinoReporte,
  TipoSplit,
} from '../src/generated/prisma/enums.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'Password123';

describe('Reportes bidireccionales CU-5.02 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const usuarioIds: string[] = [];
  const comercioIds: string[] = [];
  const categoriaIds: string[] = [];
  const pedidoIds: string[] = [];

  const server = () => app.getHttpServer();

  // --- Helpers ---

  async function crearUsuario(opts: {
    email: string;
    dni: string;
    rol?: 'CLIENTE' | 'COMERCIANTE' | 'ADMINISTRADOR';
    estado?: EstadoUsuario;
    password?: string;
  }) {
    const usuario = await prisma.usuario.create({
      data: {
        dni: opts.dni,
        nombre: 'Test',
        apellido: 'User',
        email: opts.email.toLowerCase(),
        telefono: '2900111222',
        fechaNacimiento: new Date('1990-01-01'),
        passwordHash: await hash(opts.password ?? PASSWORD, 10),
        rol: opts.rol ?? 'CLIENTE',
        estado: opts.estado ?? 'HABILITADO',
      },
    });
    usuarioIds.push(usuario.id);
    return usuario;
  }

  async function crearComercio(usuarioId: string) {
    const identificador = crypto.randomUUID();
    const comercio = await prisma.comercio.create({
      data: {
        userId: usuarioId,
        mercadoPagoVinculado: true,
        nombreFantasia: `Comercio ${identificador}`,
        razonSocial: `Comercio de prueba ${identificador}`,
        cuit: `20${identificador.replace(/\D/g, '').padEnd(9, '0').slice(0, 9)}`,
        telefono: '2901123456',
        calle: 'San Martín',
        numero: '123',
        localidad: 'Ushuaia',
        provincia: 'Tierra del Fuego',
        latitud: '-54.8019',
        longitud: '-68.3030',
        googlePlaceId: `test-${identificador}`,
        logoUrl: '',
      },
    });
    comercioIds.push(comercio.idComercio);
    return comercio;
  }

  async function crearPedido(
    usuarioId: string,
    comercioId: string,
    codigo: string,
  ) {
    const pedido = await prisma.pedido.create({
      data: {
        nroPedido: `PED-${crypto.randomUUID().slice(0, 8)}`,
        usuarioId,
        comercioId,
        estado: EstadoPedido.ENTREGADO,
        codigoQR: `QR-${crypto.randomUUID()}`,
        codigoAlfanumerico: `${codigo.slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`,
        subtotal: 1000,
        tarifa_servicio: 100,
        comisionMenorcostTasa: 0.1,
        tasaMpEstimada: 0.065,
        total: 1100,
      },
    });
    pedidoIds.push(pedido.id_pedido);
    return pedido;
  }

  function login(email: string, password = PASSWORD) {
    return request(server()).post('/auth/login').send({ email, password });
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  // --- Setup ---

  beforeAll(async () => {
    const modulo: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = modulo.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (pedidoIds.length > 0) {
      await prisma.reporte.deleteMany({
        where: { id_pedido: { in: pedidoIds } },
      });
      await prisma.calificacion.deleteMany({
        where: { id_pedido: { in: pedidoIds } },
      });
      await prisma.pedidoItem.deleteMany({
        where: { pedidoId: { in: pedidoIds } },
      });
      const pagos = await prisma.pago.findMany({
        where: { pedidoId: { in: pedidoIds } },
        select: { idPago: true },
      });
      if (pagos.length > 0) {
        const pagoIds = pagos.map((pago) => pago.idPago);
        await prisma.splitPago.deleteMany({
          where: { pagoId: { in: pagoIds } },
        });
        await prisma.pago.deleteMany({ where: { idPago: { in: pagoIds } } });
      }
      await prisma.pedido.deleteMany({
        where: { id_pedido: { in: pedidoIds } },
      });
    }
    if (comercioIds.length > 0) {
      await prisma.producto.deleteMany({
        where: { comercioId: { in: comercioIds } },
      });
      await prisma.comercio.deleteMany({
        where: { idComercio: { in: comercioIds } },
      });
    }
    if (categoriaIds.length > 0) {
      await prisma.categoria.deleteMany({
        where: { idCategoria: { in: categoriaIds } },
      });
    }
    if (usuarioIds.length > 0) {
      await prisma.solicitudBaja.deleteMany({
        where: { usuarioId: { in: usuarioIds } },
      });
      await prisma.usuario.deleteMany({ where: { id: { in: usuarioIds } } });
    }
    await app.close();
  });

  // --- Test Suite ---

  describe('Flujo completo de reportes', () => {
    let cliente: Awaited<ReturnType<typeof crearUsuario>>;
    let comerciante: Awaited<ReturnType<typeof crearUsuario>>;
    let admin: Awaited<ReturnType<typeof crearUsuario>>;
    let clienteToken: string;
    let comercianteToken: string;
    let adminToken: string;
    let comercioId: string;
    let pedidoId: string;

    beforeAll(async () => {
      // 1. Crear usuarios
      cliente = await crearUsuario({
        email: 'cliente-reportes@test.com',
        dni: '50000001',
        rol: 'CLIENTE',
      });
      comerciante = await crearUsuario({
        email: 'comerciante-reportes@test.com',
        dni: '50000002',
        rol: 'COMERCIANTE',
      });
      admin = await crearUsuario({
        email: 'admin-reportes@test.com',
        dni: '50000003',
        rol: 'ADMINISTRADOR',
      });

      // 2. Login y tokens
      clienteToken = (await login(cliente.email).expect(200)).body.accessToken;
      comercianteToken = (await login(comerciante.email).expect(200)).body
        .accessToken;
      adminToken = (await login(admin.email).expect(200)).body.accessToken;

      // 3. Crear comercio para el comerciante
      const comercio = await crearComercio(comerciante.id);
      comercioId = comercio.idComercio;

      // 4. Crear categoría
      const categoriaSlug = `categoria-test-${crypto.randomUUID()}`;
      const categoria = await prisma.categoria.create({
        data: {
          nombre: `Categoría de prueba ${categoriaSlug}`,
          slug: categoriaSlug,
        },
      });
      categoriaIds.push(categoria.idCategoria);

      // 5. Crear producto
      await prisma.producto.create({
        data: {
          comercioId,
          categoriaId: categoria.idCategoria,
          titulo: 'Producto Test',
          descripcion: 'Descripción test',
          fechaVencimiento: new Date(Date.now() + 86400000 * 30),
          stock: 10,
          precioLista: 1000,
          precioBaseNeto: 800,
          precioPublico: 941.18,
          comisionMenorcostTasaAplicada: 0.1,
          tasaMpEstimadaAplicada: 0.065,
          imagen: 'https://example.com/img.jpg',
          estado: 'ACTIVO',
        },
      });

      // 6. Crear pedido en estado ENTREGADO
      const pedido = await crearPedido(cliente.id, comercioId, 'TEST123');
      pedidoId = pedido.id_pedido;
    });

    // --- Tests ---

    describe('POST /reports - Crear reporte', () => {
      it('cliente puede denunciar al comercio', async () => {
        const res = await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoId,
            motivoCodigo: MotivoReporte.PRODUCTO_MAL_ESTADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);

        expect(res.body).toMatchObject({
          id_pedido: pedidoId,
          motivo: 'El producto estaba en mal estado/era diferente',
          motivoCodigo: 'PRODUCTO_MAL_ESTADO',
          tipo_destino: 'COMERCIO',
          estado_reporte: 'PENDIENTE_REVISION',
          id_emisor: cliente.id,
          id_denunciado: comerciante.id,
        });
        expect(res.body.id_reporte).toBeDefined();
        expect(res.body.fecha_reporte).toBeDefined();
      });

      it('comerciante puede denunciar al cliente', async () => {
        const res = await request(server())
          .post('/reports')
          .set(auth(comercianteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoId,
            motivo: 'Comportamiento inadecuado del cliente',
            tipo_destino: TipoDestinoReporte.CLIENTE,
          })
          .expect(201);

        expect(res.body).toMatchObject({
          id_pedido: pedidoId,
          motivo: 'Comportamiento inadecuado del cliente',
          tipo_destino: 'CLIENTE',
          estado_reporte: 'PENDIENTE_REVISION',
          id_emisor: comerciante.id,
          id_denunciado: cliente.id,
        });
      });

      it('rechaza si cliente intenta denunciar a cliente (tipo_destino incorrecto)', async () => {
        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoId,
            motivo: 'Test',
            tipo_destino: TipoDestinoReporte.CLIENTE,
          })
          .expect(400);
      });

      it('rechaza si comerciante intenta denunciar a comercio (tipo_destino incorrecto)', async () => {
        await request(server())
          .post('/reports')
          .set(auth(comercianteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoId,
            motivo: 'Test',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(400);
      });

      it('rechaza reporte duplicado del mismo usuario (ext 1a)', async () => {
        // Cliente ya denunció arriba, intenta de nuevo
        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoId,
            motivo: 'El producto estaba en mal estado/era diferente',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(409);
      });

      it('permite volver a reportar si el reporte anterior fue desestimado', async () => {
        const pedidoRe = await crearPedido(cliente.id, comercioId, 'RETRY');

        const primero = await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoRe.id_pedido,
            motivoCodigo: MotivoReporte.PRODUCTO_MAL_ESTADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);

        await prisma.reporte.update({
          where: { id_reporte: primero.body.id_reporte },
          data: { estado_reporte: 'DESESTIMADO' },
        });

        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoRe.id_pedido,
            motivoCodigo: MotivoReporte.PRODUCTO_MAL_ESTADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);
      });

      it('permite al cliente reportar un pedido cancelado', async () => {
        const cancelado = await crearPedido(cliente.id, comercioId, 'CANCEL');
        await prisma.pedido.update({
          where: { id_pedido: cancelado.id_pedido },
          data: { estado: EstadoPedido.CANCELADO },
        });

        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: cancelado.id_pedido,
            motivoCodigo: MotivoReporte.COMERCIO_CERRADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);
      });

      it('permite al cliente reportar un pedido pendiente de retiro', async () => {
        const pendiente = await crearPedido(cliente.id, comercioId, 'PENDIENTE');
        await prisma.pedido.update({
          where: { id_pedido: pendiente.id_pedido },
          data: { estado: EstadoPedido.PENDIENTE_DE_RETIRO },
        });

        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pendiente.id_pedido,
            motivoCodigo: MotivoReporte.COMERCIO_CERRADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);
      });

      it('rechaza un motivo incompatible con el estado del pedido', async () => {
        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoId,
            motivoCodigo: MotivoReporte.COMERCIO_CERRADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(400);
      });

      it('rechaza reportes sin justificación', async () => {
        const nuevoPedido = await crearPedido(
          cliente.id,
          comercioId,
          'SIN-DESCRIPCION',
        );

        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            idPedido: nuevoPedido.id_pedido,
            motivoCodigo: MotivoReporte.PRODUCTO_MAL_ESTADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(400);
      });

      it('rechaza reportar un pedido pendiente de pago', async () => {
        const pendiente = await crearPedido(
          cliente.id,
          comercioId,
          'PENDIENTE-PAGO',
        );
        await prisma.pedido.update({
          where: { id_pedido: pendiente.id_pedido },
          data: { estado: EstadoPedido.PENDIENTE_PAGO },
        });

        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pendiente.id_pedido,
            motivo: 'El local estaba cerrado',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(400);
      });

      it('permite al comerciante reportar un pedido cancelado por falta de retiro', async () => {
        const pedido = await crearPedido(
          cliente.id,
          comercioId,
          'NO-SHOW',
        );
        await prisma.pedido.update({
          where: { id_pedido: pedido.id_pedido },
          data: { estado: EstadoPedido.CANCELADO_POR_FALTA_RETIRO },
        });

        await request(server())
          .post('/reports')
          .set(auth(comercianteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedido.id_pedido,
            motivo: 'El cliente no se presentó a retirar el producto',
            tipo_destino: TipoDestinoReporte.CLIENTE,
          })
          .expect(201);
      });

      it('permite al cliente reportar un pedido cancelado por falta de retiro', async () => {
        const pedido = await crearPedido(
          cliente.id,
          comercioId,
          'NO-SHOW-CLIENTE',
        );
        await prisma.pedido.update({
          where: { id_pedido: pedido.id_pedido },
          data: { estado: EstadoPedido.CANCELADO_POR_FALTA_RETIRO },
        });

        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedido.id_pedido,
            motivo: 'El local estaba cerrado',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);
      });

      it('rechaza si motivo "Otro" sin descripción (ext 3a)', async () => {
        // Crear nuevo pedido para este test
        const nuevoPedido = await crearPedido(
          cliente.id,
          comercioId,
          'TEST456',
        );

        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            idPedido: nuevoPedido.id_pedido,
            motivo: 'Otro motivo personalizado',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(400);
      });

      it('permite "Otro motivo" con descripción', async () => {
        const nuevoPedido = await crearPedido(
          cliente.id,
          comercioId,
          'TEST789',
        );

        const res = await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: nuevoPedido.id_pedido,
            motivo: 'Otro motivo personalizado',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);

        expect(res.body.descripcion).toBe('Descripción de prueba');
      });

      it('rechaza pedido inexistente', async () => {
        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: '00000000-0000-0000-0000-000000000000',
            motivo: 'Test',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(404);
      });

      it('rechaza sin autenticación', async () => {
        await request(server())
          .post('/reports')
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoId,
            motivo: 'Test',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(401);
      });

      it('rechaza admin (no puede crear reportes)', async () => {
        await request(server())
          .post('/reports')
          .set(auth(adminToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedidoId,
            motivo: 'Test',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(403);
      });
    });

    describe('GET /reports/my-reports - Listar mis reportes', () => {
      beforeAll(async () => {
        await prisma.usuario.update({
          where: { id: comerciante.id },
          data: { estado: 'HABILITADO' },
        });
      });

      it('cliente ve sus reportes', async () => {
        const res = await request(server())
          .get('/reports/my-reports')
          .set(auth(clienteToken))
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body).toHaveProperty('pagination');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        const reporteCliente = res.body.data.find(
          (r: any) => r.id_emisor === cliente.id,
        );
        expect(reporteCliente).toBeDefined();
        expect(reporteCliente.id_denunciado).toBe(comerciante.id);
      });

      it('comerciante ve sus reportes', async () => {
        const res = await request(server())
          .get('/reports/my-reports')
          .set(auth(comercianteToken))
          .expect(200);

        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        const reporteComerciante = res.body.data.find(
          (r: any) => r.id_emisor === comerciante.id,
        );
        expect(reporteComerciante).toBeDefined();
        expect(reporteComerciante.id_denunciado).toBe(cliente.id);
      });

      it('filtra por estado', async () => {
        const res = await request(server())
          .get('/reports/my-reports?estado=PENDIENTE_REVISION')
          .set(auth(clienteToken))
          .expect(200);

        res.body.data.forEach((r: any) => {
          expect(r.estado_reporte).toBe('PENDIENTE_REVISION');
        });
      });

      it('paginación funciona', async () => {
        const res = await request(server())
          .get('/reports/my-reports?limit=1&page=1')
          .set(auth(clienteToken))
          .expect(200);

        expect(res.body.data.length).toBeLessThanOrEqual(1);
        expect(res.body.pagination.limit).toBe(1);
        expect(res.body.pagination.page).toBe(1);
      });

      it('rechaza sin autenticación', async () => {
        await request(server()).get('/reports/my-reports').expect(401);
      });
    });

    describe('GET /reports/:id - Detalle de reporte', () => {
      let reporteIdCliente: number;

      beforeAll(async () => {
        const reportes = await prisma.reporte.findMany({
          where: { id_emisor: cliente.id },
          orderBy: { fecha_reporte: 'desc' },
        });
        reporteIdCliente = reportes[0].id_reporte;
      });

      it('emisor puede ver su reporte', async () => {
        const res = await request(server())
          .get(`/reports/${reporteIdCliente}`)
          .set(auth(clienteToken))
          .expect(200);

        expect(res.body.id_reporte).toBe(reporteIdCliente);
        expect(res.body.id_emisor).toBe(cliente.id);
        expect(res.body.emisor).toBeDefined();
        expect(res.body.denunciado).toBeDefined();
        expect(res.body.pedido).toBeDefined();
      });

      it('denunciado puede ver el reporte', async () => {
        const res = await request(server())
          .get(`/reports/${reporteIdCliente}`)
          .set(auth(comercianteToken))
          .expect(200);

        expect(res.body.id_reporte).toBe(reporteIdCliente);
        expect(res.body.id_denunciado).toBe(comerciante.id);
      });

      it('admin puede ver cualquier reporte', async () => {
        const res = await request(server())
          .get(`/reports/${reporteIdCliente}`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.id_reporte).toBe(reporteIdCliente);
        expect(res.body.admin).toBeNull();
      });

      it('tercer usuario no puede ver el reporte (403)', async () => {
        const otro = await crearUsuario({
          email: 'tercero@test.com',
          dni: '50000004',
          rol: 'CLIENTE',
        });
        const token = (await login(otro.email).expect(200)).body.accessToken;

        await request(server())
          .get(`/reports/${reporteIdCliente}`)
          .set(auth(token))
          .expect(403);

        await prisma.usuario.delete({ where: { id: otro.id } });
      });

      it('rechaza reporte inexistente (404)', async () => {
        await request(server())
          .get('/reports/999999')
          .set(auth(clienteToken))
          .expect(404);
      });

      it('rechaza sin autenticación', async () => {
        await request(server()).get(`/reports/${reporteIdCliente}`).expect(401);
      });
    });

    describe('Umbral de más de 3 reportes → BAJO_INVESTIGACION (ext 4a)', () => {
      it('acumula más de 3 reportes y pone usuario en BAJO_INVESTIGACION', async () => {
        // Crear 4 comerciantes distintos para denunciar al mismo cliente
        const usuarioObjetivo = await crearUsuario({
          email: 'cliente-umbral@test.com',
          dni: '50000200',
          rol: 'CLIENTE',
        });
        const comerciantes: Awaited<ReturnType<typeof crearUsuario>>[] = [];
        const comercios: string[] = [];

        for (let i = 0; i < 4; i++) {
          const c = await crearUsuario({
            email: `comerciante-umbral-${i}@test.com`,
            dni: `5000010${i}`,
            rol: 'COMERCIANTE',
          });
          comerciantes.push(c);

          const com = await crearComercio(c.id);
          comercios.push(com.idComercio);
        }

        // Crear 4 pedidos del cliente (uno por comerciante)
        const pedidos: string[] = [];
        for (const comId of comercios) {
          const p = await crearPedido(usuarioObjetivo.id, comId, 'UMBRAL');
          await prisma.pedido.update({
            where: { id_pedido: p.id_pedido },
            data: { estado: EstadoPedido.PENDIENTE_DE_RETIRO },
          });
          pedidos.push(p.id_pedido);
        }

        // Cada comerciante denuncia al cliente
        for (let i = 0; i < 4; i++) {
          const token = (await login(comerciantes[i].email).expect(200)).body
            .accessToken;
          await request(server())
            .post('/reports')
            .set(auth(token))
            .send({
              descripcion: 'Descripción de prueba',
              idPedido: pedidos[i],
              motivo: 'El cliente no se presentó a retirar el producto',
              tipo_destino: TipoDestinoReporte.CLIENTE,
            })
            .expect(201);
        }

        // Verificar que el cliente está en BAJO_INVESTIGACION
        const clienteActualizado = await prisma.usuario.findUnique({
          where: { id: usuarioObjetivo.id },
        });
        expect(clienteActualizado?.estado).toBe('BAJO_INVESTIGACION');
      });

      it('NO activa el umbral si los 3 reportes son del mismo emisor', async () => {
        const usuarioObjetivo = await crearUsuario({
          email: 'cliente-umbral-repetido@test.com',
          dni: '50000201',
          rol: 'CLIENTE',
        });
        const comerciante = await crearUsuario({
          email: 'comerciante-umbral-repetido@test.com',
          dni: '50000202',
          rol: 'COMERCIANTE',
        });
        const comercio = await crearComercio(comerciante.id);

        const pedidos: string[] = [];
        for (let i = 0; i < 3; i++) {
          const p = await crearPedido(
            usuarioObjetivo.id,
            comercio.idComercio,
            `UMBRAL-REP-${i}`,
          );
          await prisma.pedido.update({
            where: { id_pedido: p.id_pedido },
            data: { estado: EstadoPedido.PENDIENTE_DE_RETIRO },
          });
          pedidos.push(p.id_pedido);
        }

        const token = (await login(comerciante.email).expect(200)).body
          .accessToken;
        for (const idPedido of pedidos) {
          await request(server())
            .post('/reports')
            .set(auth(token))
            .send({
              descripcion: 'Descripción de prueba',
              idPedido,
              motivo: 'El cliente no se presentó a retirar el producto',
              tipo_destino: TipoDestinoReporte.CLIENTE,
            })
            .expect(201);
        }

        // Un único emisor no alcanza el umbral de emisores distintos
        const clienteActualizado = await prisma.usuario.findUnique({
          where: { id: usuarioObjetivo.id },
        });
        expect(clienteActualizado?.estado).toBe('HABILITADO');
      });
    });

    describe('Baja de cuenta y reportes', () => {
      it('no bloquea la baja del cliente que emitió un reporte', async () => {
        const emisor = await crearUsuario({
          email: 'baja-emisor@test.com',
          dni: '50000301',
          rol: 'CLIENTE',
        });
        const emisorToken = (await login(emisor.email).expect(200)).body
          .accessToken as string;
        const pedido = await crearPedido(
          emisor.id,
          comercioId,
          'BAJA-EMISOR',
        );

        await request(server())
          .post('/reports')
          .set(auth(emisorToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedido.id_pedido,
            motivoCodigo: MotivoReporte.PRODUCTO_MAL_ESTADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);

        await request(server())
          .post('/baja-cuenta')
          .set(auth(emisorToken))
          .send({ motivo: 'Ya no la uso', password: PASSWORD })
          .expect(200);
      });

      it('bloquea la baja del comerciante con un reporte recibido', async () => {
        const duenio = await crearUsuario({
          email: 'baja-receptor@test.com',
          dni: '50000302',
          rol: 'COMERCIANTE',
        });
        const comercio = await crearComercio(duenio.id);
        const denunciante = await crearUsuario({
          email: 'baja-denunciante@test.com',
          dni: '50000303',
          rol: 'CLIENTE',
        });
        const denuncianteToken = (
          await login(denunciante.email).expect(200)
        ).body.accessToken as string;
        const pedido = await crearPedido(
          denunciante.id,
          comercio.idComercio,
          'BAJA-RECIBIDO',
        );

        await request(server())
          .post('/reports')
          .set(auth(denuncianteToken))
          .send({
            descripcion: 'Descripción de prueba',
            idPedido: pedido.id_pedido,
            motivoCodigo: MotivoReporte.PRODUCTO_MAL_ESTADO,
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);

        const duenioToken = (await login(duenio.email).expect(200)).body
          .accessToken as string;

        const res = await request(server())
          .post('/baja-cuenta')
          .set(auth(duenioToken))
          .send({ motivo: 'Ya no la uso', password: PASSWORD })
          .expect(400);

        expect(res.body.message).toContain('No se puede dar de baja');
      });

      it('muestra el saldo real de tarifas en la solicitud de baja', async () => {
        const duenio = await crearUsuario({
          email: 'baja-saldo@test.com',
          dni: '50000304',
          rol: 'COMERCIANTE',
        });
        const comercio = await crearComercio(duenio.id);
        const pedidoUno = await crearPedido(
          cliente.id,
          comercio.idComercio,
          'SALDO-1',
        );
        const pedidoDos = await crearPedido(
          cliente.id,
          comercio.idComercio,
          'SALDO-2',
        );

        await prisma.pedido.update({
          where: { id_pedido: pedidoUno.id_pedido },
          data: { tarifa_servicio: 500 },
        });
        await prisma.pedido.update({
          where: { id_pedido: pedidoDos.id_pedido },
          data: { tarifa_servicio: 500 },
        });

        const pagoUno = await prisma.pago.create({
          data: {
            pedidoId: pedidoUno.id_pedido,
            montoTransaccion: 1100,
            estado: EstadoPago.PAGADO,
          },
        });
        const pagoDos = await prisma.pago.create({
          data: {
            pedidoId: pedidoDos.id_pedido,
            montoTransaccion: 1100,
            estado: EstadoPago.PAGADO,
          },
        });
        await prisma.splitPago.create({
          data: {
            pagoId: pagoUno.idPago,
            recipientType: TipoSplit.MARKETPLACE,
            monto: 300,
          },
        });
        await prisma.splitPago.create({
          data: {
            pagoId: pagoDos.idPago,
            recipientType: TipoSplit.MARKETPLACE,
            monto: 200,
          },
        });

        const duenioToken = (await login(duenio.email).expect(200)).body
          .accessToken as string;
        await request(server())
          .post('/baja-cuenta')
          .set(auth(duenioToken))
          .send({ motivo: 'Ya no la uso', password: PASSWORD })
          .expect(200);

        const pendientes = await request(server())
          .get('/admin/bajas?estado=PENDIENTE')
          .set(auth(adminToken))
          .expect(200);

        const solicitud = pendientes.body.find(
          (s: { usuario: { id: string } }) => s.usuario.id === duenio.id,
        );
        expect(solicitud).toMatchObject({
          pedidosCompletados: 2,
          saldoTarifas: 500,
        });
      });
    });
  });
});
