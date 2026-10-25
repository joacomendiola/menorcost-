import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import {
  EstadoPedido,
  EstadoUsuario,
  TipoDestinoReporte,
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
    const comercio = await prisma.comercio.create({
      data: {
        usuarioId,
        mercadoPagoVinculado: true,
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
        usuarioId,
        comercioId,
        estado: EstadoPedido.ENTREGADO,
        codigoQR: `QR-${crypto.randomUUID()}`,
        codigoAlfanumerico: `${codigo}-${crypto.randomUUID().slice(0, 8)}`,
        subtotal: 1000,
        tarifa_servicio: 100,
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
      const categoria = await prisma.categoria.create({
        data: { idCategoria: crypto.randomUUID() },
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
          precioMenorcost: 800,
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
            idPedido: pedidoId,
            motivo: 'El producto estaba en mal estado/era diferente',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);

        expect(res.body).toMatchObject({
          id_pedido: pedidoId,
          motivo: 'El producto estaba en mal estado/era diferente',
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
            idPedido: pedidoId,
            motivo: 'El cliente no se presentó a retirar el producto',
            tipo_destino: TipoDestinoReporte.CLIENTE,
          })
          .expect(201);

        expect(res.body).toMatchObject({
          id_pedido: pedidoId,
          motivo: 'El cliente no se presentó a retirar el producto',
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
            idPedido: pedidoId,
            motivo: 'Otro motivo',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(409);
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
            idPedido: nuevoPedido.id_pedido,
            motivo: 'Otro motivo personalizado',
            descripcion: 'Detalle del problema específico',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(201);

        expect(res.body.descripcion).toBe('Detalle del problema específico');
      });

      it('rechaza pedido inexistente', async () => {
        await request(server())
          .post('/reports')
          .set(auth(clienteToken))
          .send({
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
            idPedido: pedidoId,
            motivo: 'Test',
            tipo_destino: TipoDestinoReporte.COMERCIO,
          })
          .expect(403);
      });
    });

    describe('GET /reports/my-reports - Listar mis reportes', () => {
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

    describe('Umbral 3 reportes → BAJO_INVESTIGACION (ext 4a)', () => {
      it('acumula 3 reportes y pone usuario en BAJO_INVESTIGACION', async () => {
        // Crear 3 comerciantes distintos para denunciar al mismo cliente
        const usuarioObjetivo = await crearUsuario({
          email: 'cliente-umbral@test.com',
          dni: '50000200',
          rol: 'CLIENTE',
        });
        const comerciantes: Awaited<ReturnType<typeof crearUsuario>>[] = [];
        const comercios: string[] = [];

        for (let i = 0; i < 3; i++) {
          const c = await crearUsuario({
            email: `comerciante-umbral-${i}@test.com`,
            dni: `5000010${i}`,
            rol: 'COMERCIANTE',
          });
          comerciantes.push(c);

          const com = await crearComercio(c.id);
          comercios.push(com.idComercio);
        }

        // Crear 3 pedidos del cliente (uno por comerciante)
        const pedidos: string[] = [];
        for (const comId of comercios) {
          const p = await crearPedido(usuarioObjetivo.id, comId, 'UMBRAL');
          pedidos.push(p.id_pedido);
        }

        // Cada comerciante denuncia al cliente
        for (let i = 0; i < 3; i++) {
          const token = (await login(comerciantes[i].email).expect(200)).body
            .accessToken;
          await request(server())
            .post('/reports')
            .set(auth(token))
            .send({
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
    });
  });
});
