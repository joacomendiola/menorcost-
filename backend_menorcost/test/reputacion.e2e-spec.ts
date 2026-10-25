import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { EstadoPedido, EstadoUsuario } from '../src/generated/prisma/enums.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'Password123';

describe('Reputación CU-5.01 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const usuarioIds: string[] = [];
  const comercioIds: string[] = [];
  const categoriaIds: string[] = [];
  const pedidoIds: string[] = [];

  const server = () => app.getHttpServer();

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
      data: { usuarioId, mercadoPagoVinculado: true },
    });
    comercioIds.push(comercio.idComercio);
    return comercio;
  }

  async function crearPedido(
    usuarioId: string,
    comercioId: string,
    estado: EstadoPedido,
  ) {
    const pedido = await prisma.pedido.create({
      data: {
        usuarioId,
        comercioId,
        estado,
        codigoQR: `QR-${crypto.randomUUID()}`,
        codigoAlfanumerico: `REP-${crypto.randomUUID().slice(0, 8)}`,
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

  describe('Flujo completo de calificación y reputación', () => {
    let cliente: Awaited<ReturnType<typeof crearUsuario>>;
    let comerciante: Awaited<ReturnType<typeof crearUsuario>>;
    let clienteToken: string;
    let comercianteToken: string;
    let comercioId: string;
    let categoriaId: string;
    let pedidoId: string;

    beforeAll(async () => {
      // 1. Crear usuarios
      cliente = await crearUsuario({
        email: 'cliente-reputacion@test.com',
        dni: '60000001',
        rol: 'CLIENTE',
      });
      comerciante = await crearUsuario({
        email: 'comerciante-reputacion@test.com',
        dni: '60000002',
        rol: 'COMERCIANTE',
      });

      // 2. Login
      clienteToken = (await login(cliente.email).expect(200)).body.accessToken;
      comercianteToken = (await login(comerciante.email).expect(200)).body
        .accessToken;

      // 3. Crear comercio
      const comercio = await crearComercio(comerciante.id);
      comercioId = comercio.idComercio;

      // 4. Categoría
      const categoria = await prisma.categoria.create({
        data: { idCategoria: crypto.randomUUID() },
      });
      categoriaId = categoria.idCategoria;
      categoriaIds.push(categoria.idCategoria);

      // 5. Producto
      await prisma.producto.create({
        data: {
          comercioId,
          categoriaId,
          titulo: 'Producto Reputacion',
          descripcion: 'Para test de calificación',
          fechaVencimiento: new Date(Date.now() + 86400000 * 30),
          stock: 10,
          precioLista: 1000,
          precioMenorcost: 800,
          imagen: 'https://example.com/img.jpg',
          estado: 'ACTIVO',
        },
      });

      // 6. Pedido ENTREGADO
      const pedido = await crearPedido(
        cliente.id,
        comercioId,
        EstadoPedido.ENTREGADO,
      );
      pedidoId = pedido.id_pedido;
    });

    describe('POST /reputation/rate - Calificar pedido', () => {
      it('cliente puede calificar pedido ENTREGADO (1-5 estrellas)', async () => {
        const res = await request(server())
          .post('/reputation/rate')
          .set(auth(clienteToken))
          .send({
            idPedido: pedidoId,
            puntaje: 5,
            comentario: 'Excelente producto y atención',
          })
          .expect(201)
          .then((r) => r);

        expect(res.body).toMatchObject({
          calificacion: {
            id_pedido: pedidoId,
            puntaje: 5,
            comentario: 'Excelente producto y atención',
          },
          reputacionComercio: {
            promedio: 5,
            total: 1,
          },
        });
        expect(res.body.calificacion.id_calificacion).toBeDefined();
        expect(res.body.calificacion.fecha_creacion).toBeDefined();
      });

      it('rechaza calificar pedido no ENTREGADO', async () => {
        const pedidoPendiente = await crearPedido(
          cliente.id,
          comercioId,
          EstadoPedido.PENDIENTE_DE_RETIRO,
        );

        await request(server())
          .post('/reputation/rate')
          .set(auth(clienteToken))
          .send({ idPedido: pedidoPendiente.id_pedido, puntaje: 4 })
          .expect(400);
      });

      it('rechaza calificar pedido ajeno', async () => {
        const otroCliente = await crearUsuario({
          email: 'otro-cliente@test.com',
          dni: '60000003',
          rol: 'CLIENTE',
        });
        const token = (await login(otroCliente.email).expect(200)).body
          .accessToken;

        await request(server())
          .post('/reputation/rate')
          .set(auth(token))
          .send({ idPedido: pedidoId, puntaje: 3 })
          .expect(403);
      });

      it('rechaza calificar dos veces el mismo pedido (ext 6a)', async () => {
        // Ya calificó arriba con 5 estrellas
        await request(server())
          .post('/reputation/rate')
          .set(auth(clienteToken))
          .send({ idPedido: pedidoId, puntaje: 1 })
          .expect(409);
      });

      it('rechaza puntaje fuera de rango (1-5)', async () => {
        const nuevoPedido = await crearPedido(
          cliente.id,
          comercioId,
          EstadoPedido.ENTREGADO,
        );

        await request(server())
          .post('/reputation/rate')
          .set(auth(clienteToken))
          .send({ idPedido: nuevoPedido.id_pedido, puntaje: 6 })
          .expect(400);

        await request(server())
          .post('/reputation/rate')
          .set(auth(clienteToken))
          .send({ idPedido: nuevoPedido.id_pedido, puntaje: 0 })
          .expect(400);
      });

      it('rechaza sin autenticación', async () => {
        await request(server())
          .post('/reputation/rate')
          .send({ idPedido: pedidoId, puntaje: 5 })
          .expect(401);
      });

      it('rechaza comerciante (solo clientes pueden calificar)', async () => {
        await request(server())
          .post('/reputation/rate')
          .set(auth(comercianteToken))
          .send({ idPedido: pedidoId, puntaje: 5 })
          .expect(403);
      });
    });

    describe('GET /reputation/my-store - Ver reputación de mi comercio', () => {
      it('comerciante ve su reputación con promedio, total y distribución', async () => {
        const res = await request(server())
          .get('/reputation/my-store')
          .set(auth(comercianteToken))
          .expect(200);

        expect(res.body).toMatchObject({
          promedio: 5,
          totalResenas: 1,
          distribucion: { '5': 1, '4': 0, '3': 0, '2': 0, '1': 0 },
        });
        expect(res.body.resenas).toHaveLength(1);
        expect(res.body.resenas[0]).toMatchObject({
          puntaje: 5,
          comentario: 'Excelente producto y atención',
        });
        expect(res.body.paginacion).toMatchObject({
          limit: 10,
          hasMore: false,
        });
      });

      it('reputación inicial es 0 sin calificaciones', async () => {
        const nuevoComerciante = await crearUsuario({
          email: 'nuevo-comerciante@test.com',
          dni: '60000004',
          rol: 'COMERCIANTE',
        });
        await crearComercio(nuevoComerciante.id);
        const token = (await login(nuevoComerciante.email).expect(200)).body
          .accessToken;

        const res = await request(server())
          .get('/reputation/my-store')
          .set(auth(token))
          .expect(200);

        expect(res.body).toMatchObject({
          promedio: 0,
          totalResenas: 0,
          distribucion: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
          resenas: [],
        });
      });

      it('paginación cursor funciona', async () => {
        // Crear más calificaciones para testear paginación
        const pedidosPaginacion: string[] = [];
        for (let i = 0; i < 5; i++) {
          const c = await crearUsuario({
            email: `cliente-${i}@test.com`,
            dni: `600010${i}`,
            rol: 'CLIENTE',
          });
          const p = await crearPedido(c.id, comercioId, EstadoPedido.ENTREGADO);
          pedidosPaginacion.push(p.id_pedido);
          await prisma.calificacion.create({
            data: {
              id_pedido: p.id_pedido,
              puntaje: 4,
              comentario: `Test ${i}`,
            },
          });
        }

        // Primera página limit=3
        const res1 = await request(server())
          .get('/reputation/my-store?limit=3')
          .set(auth(comercianteToken))
          .expect(200);

        expect(res1.body.resenas.length).toBe(3);
        expect(res1.body.paginacion.hasMore).toBe(true);
        expect(res1.body.paginacion.nextCursor).toBeDefined();

        // Segunda página con cursor
        const res2 = await request(server())
          .get(
            `/reputation/my-store?limit=3&cursor=${res1.body.paginacion.nextCursor}`,
          )
          .set(auth(comercianteToken))
          .expect(200);

        expect(res2.body.resenas.length).toBe(3); // 1 original + 5 nuevas - 3 primera = 3
        expect(res2.body.paginacion.hasMore).toBe(false);

        await prisma.calificacion.deleteMany({
          where: { id_pedido: { in: pedidosPaginacion } },
        });
        await prisma.pedido.deleteMany({
          where: { id_pedido: { in: pedidosPaginacion } },
        });
      });

      it('rechaza sin autenticación', async () => {
        await request(server()).get('/reputation/my-store').expect(401);
      });

      it('rechaza cliente (solo comerciantes)', async () => {
        await request(server())
          .get('/reputation/my-store')
          .set(auth(clienteToken))
          .expect(403);
      });
    });

    describe('Recálculo automático de reputación', () => {
      it('actualiza promedio y total al agregar nueva calificación', async () => {
        // Crear nuevo pedido para nueva calificación
        const nuevoPedido = await crearPedido(
          cliente.id,
          comercioId,
          EstadoPedido.ENTREGADO,
        );

        // Calificar con 3 estrellas
        await request(server())
          .post('/reputation/rate')
          .set(auth(clienteToken))
          .send({
            idPedido: nuevoPedido.id_pedido,
            puntaje: 3,
            comentario: 'Regular',
          })
          .expect(201);

        // Verificar reputación actualizada
        const res = await request(server())
          .get('/reputation/my-store')
          .set(auth(comercianteToken))
          .expect(200);

        // Promedio: (5 + 3) / 2 = 4
        expect(res.body.promedio).toBe(4);
        expect(res.body.totalResenas).toBe(2);
        expect(res.body.distribucion['5']).toBe(1);
        expect(res.body.distribucion['3']).toBe(1);
      });
    });
  });
});
