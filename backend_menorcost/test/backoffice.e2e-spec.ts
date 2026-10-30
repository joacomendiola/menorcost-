import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { EstadoUsuario } from '../src/generated/prisma/enums.js';

const PASSWORD = 'Password123';

describe('Backoffice Admin CU-5.03 (e2e)', () => {
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

  async function crearComercio(
    usuarioId: string,
    mercadoPagoVinculado: boolean,
  ) {
    const identificador = crypto.randomUUID();
    const comercio = await prisma.comercio.create({
      data: {
        userId: usuarioId,
        mercadoPagoVinculado,
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

  async function crearPedido(usuarioId: string, comercioId: string) {
    const pedido = await prisma.pedido.create({
      data: {
        nroPedido: `NP-${crypto.randomUUID().slice(0, 20)}`,
        usuarioId,
        comercioId,
        estado: 'ENTREGADO',
        codigoQR: `QR-${crypto.randomUUID()}`,
        codigoAlfanumerico: `BO-${crypto.randomUUID().slice(0, 8)}`,
        subtotal: 1000,
        tarifa_servicio: 100,
        comisionMenorcostTasa: '0.1000',
        tasaMpEstimada: '0.0650',
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

  describe('Flujo completo Backoffice Admin', () => {
    let admin: Awaited<ReturnType<typeof crearUsuario>>;
    let adminToken: string;
    let comerciantePendiente: Awaited<ReturnType<typeof crearUsuario>>;
    let comercianteHabilitado: Awaited<ReturnType<typeof crearUsuario>>;
    let cliente: Awaited<ReturnType<typeof crearUsuario>>;
    let comercianteToken: string;
    let clienteToken: string;
    let comercioPendienteId: string;
    let comercioHabilitadoId: string;
    let pedidoId: string;
    let reporteId: number;

    beforeAll(async () => {
      // 1. Crear usuarios
      admin = await crearUsuario({
        email: 'admin-backoffice@test.com',
        dni: '70000001',
        rol: 'ADMINISTRADOR',
      });
      comerciantePendiente = await crearUsuario({
        email: 'comerciante-pendiente@test.com',
        dni: '70000002',
        rol: 'COMERCIANTE',
        estado: 'PENDIENTE_VERIFICACION',
      });
      comercianteHabilitado = await crearUsuario({
        email: 'comerciante-habilitado@test.com',
        dni: '70000003',
        rol: 'COMERCIANTE',
      });
      cliente = await crearUsuario({
        email: 'cliente-backoffice@test.com',
        dni: '70000004',
        rol: 'CLIENTE',
      });

      // 2. Login
      adminToken = (await login(admin.email).expect(200)).body.accessToken;
      comercianteToken = (await login(comercianteHabilitado.email).expect(200))
        .body.accessToken;
      clienteToken = (await login(cliente.email).expect(200)).body.accessToken;

      // 3. Comercios
      const comercioPendiente = await crearComercio(
        comerciantePendiente.id,
        false,
      );
      comercioPendienteId = comercioPendiente.idComercio;

      const comercioHabilitado = await crearComercio(
        comercianteHabilitado.id,
        true,
      );
      comercioHabilitadoId = comercioHabilitado.idComercio;

      // 4. Categoría y producto
      const categoriaSlug = `categoria-test-${crypto.randomUUID()}`;
      const categoria = await prisma.categoria.create({
        data: {
          nombre: `Categoría de prueba ${categoriaSlug}`,
          slug: categoriaSlug,
        },
      });
      categoriaIds.push(categoria.idCategoria);
      await prisma.producto.create({
        data: {
          comercioId: comercioHabilitadoId,
          categoriaId: categoria.idCategoria,
          titulo: 'Producto Backoffice',
          descripcion: 'Test',
          fechaVencimiento: new Date(Date.now() + 86400000 * 30),
          stock: 5,
          precioLista: 1000,
          precioMenorcost: 800,
          imagen: 'https://example.com/img.jpg',
          estado: 'ACTIVO',
        },
      });

      // 5. Pedido ENTREGADO
      const pedido = await crearPedido(cliente.id, comercioHabilitadoId);
      pedidoId = pedido.id_pedido;

      // 6. Reporte existente para tests
      const reporte = await prisma.reporte.create({
        data: {
          id_pedido: pedidoId,
          motivo: 'El producto estaba en mal estado',
          tipo_destino: 'COMERCIO',
          estado_reporte: 'PENDIENTE_REVISION',
          id_emisor: cliente.id,
          id_denunciado: comercianteHabilitado.id,
        },
      });
      reporteId = reporte.id_reporte;
    });

    // ========================================
    // MÓDULO 1: KPIs
    // ========================================
    describe('GET /admin/kpis - Métricas del dashboard', () => {
      it('admin obtiene KPIs', async () => {
        const res = await request(server())
          .get('/admin/kpis')
          .set(auth(adminToken))
          .expect(200);

        expect(res.body).toMatchObject({
          altasPendientes: expect.any(Number),
          altasAprobadas30Dias: expect.any(Number),
          bajasSolicitadas: expect.any(Number),
          denunciasAbiertas: expect.any(Number),
        });
        expect(res.body.altasPendientes).toBeGreaterThanOrEqual(1); // comerciantePendiente
        expect(res.body.denunciasAbiertas).toBeGreaterThanOrEqual(1); // reporte creado
      });

      it('rechaza sin autenticación', async () => {
        await request(server()).get('/admin/kpis').expect(401);
      });

      it('rechaza no-admin (comerciante)', async () => {
        await request(server())
          .get('/admin/kpis')
          .set(auth(comercianteToken))
          .expect(403);
      });

      it('rechaza no-admin (cliente)', async () => {
        await request(server())
          .get('/admin/kpis')
          .set(auth(clienteToken))
          .expect(403);
      });
    });

    // ========================================
    // MÓDULO 2: SOLICITUDES DE ALTA
    // ========================================
    describe('GET /admin/altas - Listar solicitudes de alta', () => {
      it('admin lista altas con filtros', async () => {
        const res = await request(server())
          .get('/admin/altas')
          .set(auth(adminToken))
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);

        const pendiente = res.body.find(
          (c: any) => c.usuario.id === comerciantePendiente.id,
        );
        expect(pendiente).toBeDefined();
        expect(pendiente.usuario.estado).toBe('PENDIENTE_VERIFICACION');
        expect(pendiente.usuario.direcciones).toBeDefined();
      });

      it('filtro search por email funciona', async () => {
        const res = await request(server())
          .get('/admin/altas?search=comerciante-pendiente')
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.length).toBe(1);
        expect(res.body[0].usuario.email).toBe(
          'comerciante-pendiente@test.com',
        );
      });

      it('filtro search por CUIT funciona', async () => {
        const comercio = await prisma.comercio.findUnique({
          where: { idComercio: comercioPendienteId },
        });
        expect(comercio).not.toBeNull();

        const res = await request(server())
          .get(`/admin/altas?search=${encodeURIComponent(comercio?.cuit ?? '')}`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.length).toBe(1);
        expect(res.body[0].cuit).toBe(comercio?.cuit);
      });

      it('filtro estado funciona', async () => {
        const res = await request(server())
          .get('/admin/altas?estado=PENDIENTE_VERIFICACION')
          .set(auth(adminToken))
          .expect(200);

        res.body.forEach((c: any) => {
          expect(c.usuario.estado).toBe('PENDIENTE_VERIFICACION');
        });
      });

      it('rechaza no-admin', async () => {
        await request(server())
          .get('/admin/altas')
          .set(auth(comercianteToken))
          .expect(403);
      });
    });

    describe('PATCH /admin/altas/:id/aprobar - Aprobar comercio', () => {
      it('aprueba comercio PENDIENTE_VERIFICACION → HABILITADO', async () => {
        const res = await request(server())
          .patch(`/admin/altas/${comercioPendienteId}/aprobar`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body).toMatchObject({
          id: comerciantePendiente.id,
          estado: 'HABILITADO',
          notificacion: { enviada: expect.any(Boolean) },
        });

        // Verificar en BD
        const usuario = await prisma.usuario.findUnique({
          where: { id: comerciantePendiente.id },
        });
        expect(usuario?.estado).toBe('HABILITADO');

        const comercio = await prisma.comercio.findUnique({
          where: { idComercio: comercioPendienteId },
        });
        expect(comercio?.estado).toBe('HABILITADO');

        // El comercio aprobado ya es visible en la tienda pública
        await request(server())
          .get(`/comercios/publicos/${comercioPendienteId}`)
          .expect(200);
      });

      it('rechaza aprobar comercio ya aprobado (409)', async () => {
        await request(server())
          .patch(`/admin/altas/${comercioPendienteId}/aprobar`)
          .set(auth(adminToken))
          .expect(409);
      });

      it('si usuario y comercio están desincronizados, revierte todo (409)', async () => {
        const usuario = await crearUsuario({
          email: 'comerciante-desync-aprobar@test.com',
          dni: '70000007',
          rol: 'COMERCIANTE',
          estado: 'HABILITADO',
        });
        const comercio = await crearComercio(usuario.id, false);

        await request(server())
          .patch(`/admin/altas/${comercio.idComercio}/aprobar`)
          .set(auth(adminToken))
          .expect(409);

        const comercioDb = await prisma.comercio.findUnique({
          where: { idComercio: comercio.idComercio },
        });
        expect(comercioDb?.estado).toBe('PENDIENTE_VERIFICACION');
      });

      it('rechaza comercio inexistente (404)', async () => {
        await request(server())
          .patch('/admin/altas/00000000-0000-0000-0000-000000000000/aprobar')
          .set(auth(adminToken))
          .expect(404);
      });

      it('rechaza no-admin', async () => {
        await request(server())
          .patch(`/admin/altas/${comercioHabilitadoId}/aprobar`)
          .set(auth(comercianteToken))
          .expect(403);
      });
    });

    describe('PATCH /admin/altas/:id/rechazar - Rechazar comercio', () => {
      // Crear otro comercio pendiente para rechazar
      let comercioParaRechazarId: string;

      beforeAll(async () => {
        const c = await crearUsuario({
          email: 'comerciante-rechazar@test.com',
          dni: '70000005',
          rol: 'COMERCIANTE',
          estado: 'PENDIENTE_VERIFICACION',
        });
        const com = await crearComercio(c.id, false);
        comercioParaRechazarId = com.idComercio;
      });

      afterAll(async () => {});

      it('rechaza comercio → DOCUMENTACION_RECHAZADA con motivo', async () => {
        const res = await request(server())
          .patch(`/admin/altas/${comercioParaRechazarId}/rechazar`)
          .set(auth(adminToken))
          .send({ motivo: 'Documentación ilegible' })
          .expect(200);

        expect(res.body).toMatchObject({
          estado: 'DOCUMENTACION_RECHAZADA',
          notificacion: { enviada: expect.any(Boolean) },
        });

        const usuario = await prisma.usuario.findUnique({
          where: { email: 'comerciante-rechazar@test.com' },
        });
        expect(usuario?.estado).toBe('DOCUMENTACION_RECHAZADA');

        const comercio = await prisma.comercio.findUnique({
          where: { idComercio: comercioParaRechazarId },
        });
        expect(comercio?.estado).toBe('DOCUMENTACION_RECHAZADA');

        // El comercio rechazado no es visible públicamente
        await request(server())
          .get(`/comercios/publicos/${comercioParaRechazarId}`)
          .expect(404);
      });

      it('si usuario y comercio están desincronizados, revierte todo (409)', async () => {
        const usuario = await crearUsuario({
          email: 'comerciante-desync-rechazar@test.com',
          dni: '70000008',
          rol: 'COMERCIANTE',
          estado: 'HABILITADO',
        });
        const comercio = await crearComercio(usuario.id, false);

        await request(server())
          .patch(`/admin/altas/${comercio.idComercio}/rechazar`)
          .set(auth(adminToken))
          .send({ motivo: 'Documentación ilegible' })
          .expect(409);

        const comercioDb = await prisma.comercio.findUnique({
          where: { idComercio: comercio.idComercio },
        });
        expect(comercioDb?.estado).toBe('PENDIENTE_VERIFICACION');
      });

      it('rechaza sin motivo (400)', async () => {
        const c = await crearUsuario({
          email: 'comerciante-rechazar2@test.com',
          dni: '70000006',
          rol: 'COMERCIANTE',
          estado: 'PENDIENTE_VERIFICACION',
        });
        const com = await crearComercio(c.id, false);

        await request(server())
          .patch(`/admin/altas/${com.idComercio}/rechazar`)
          .set(auth(adminToken))
          .send({}) // sin motivo
          .expect(400);
      });
    });

    // ========================================
    // MÓDULO 3: DENUNCIAS Y MODERACIÓN
    // ========================================
    describe('GET /admin/denuncias - Listar denuncias', () => {
      it('admin lista denuncias con info completa', async () => {
        const res = await request(server())
          .get('/admin/denuncias')
          .set(auth(adminToken))
          .expect(200);

        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);

        const r = res.body.find((x: any) => x.id_reporte === reporteId);
        expect(r).toBeDefined();
        expect(r).toMatchObject({
          id_reporte: reporteId,
          motivo: 'El producto estaba en mal estado',
          tipo_destino: 'COMERCIO',
          estado_reporte: 'PENDIENTE_REVISION',
        });
        expect(r.emisor).toBeDefined();
        expect(r.denunciado).toBeDefined();
        expect(r.pedido).toBeDefined();
        expect(r.denunciado.comercio).toMatchObject({
          cuit: expect.any(String),
          razonSocial: expect.any(String),
        });
        expect(r.registro).toMatchObject({
          total: expect.any(Number),
          abiertas: expect.any(Number),
          resueltas: expect.any(Number),
          desestimadas: expect.any(Number),
        });
      });

      it('filtro search por motivo funciona', async () => {
        const res = await request(server())
          .get('/admin/denuncias?search=mal estado')
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.length).toBe(1);
        expect(res.body[0].motivo).toContain('mal estado');
      });

      it('filtro search por CUIT del comercio denunciado funciona', async () => {
        const comercio = await prisma.comercio.findUnique({
          where: { idComercio: comercioHabilitadoId },
        });

        const res = await request(server())
          .get(`/admin/denuncias?search=${encodeURIComponent(comercio?.cuit ?? '')}`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.some((r: any) => r.id_reporte === reporteId)).toBe(true);
      });

      it('filtro search por razón social del comercio denunciado funciona', async () => {
        const comercio = await prisma.comercio.findUnique({
          where: { idComercio: comercioHabilitadoId },
        });

        const res = await request(server())
          .get(
            `/admin/denuncias?search=${encodeURIComponent(comercio?.razonSocial ?? '')}`,
          )
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.some((r: any) => r.id_reporte === reporteId)).toBe(true);
      });

      it('filtro estado funciona', async () => {
        const res = await request(server())
          .get('/admin/denuncias?estado=PENDIENTE_REVISION')
          .set(auth(adminToken))
          .expect(200);

        res.body.forEach((r: any) => {
          expect(r.estado_reporte).toBe('PENDIENTE_REVISION');
        });
      });

      it('ordena por estado denunciado (BAJO_INVESTIGACION primero)', async () => {
        const res = await request(server())
          .get('/admin/denuncias')
          .set(auth(adminToken))
          .expect(200);

        // Verificar que vienen ordenados (los de BAJO_INVESTIGACION primero)
        const estados = res.body.map((r: any) => r.denunciado.estado);
        expect(estados).toEqual(
          [...estados].sort((a, b) => {
            if (a === 'BAJO_INVESTIGACION' && b !== 'BAJO_INVESTIGACION')
              return -1;
            if (b === 'BAJO_INVESTIGACION' && a !== 'BAJO_INVESTIGACION')
              return 1;
            return 0;
          }),
        );
      });
    });

    describe('PATCH /admin/denuncias/:id/investigacion - Toggle investigación', () => {
      let reporteToggleId: number;

      beforeAll(async () => {
        const r = await prisma.reporte.create({
          data: {
            id_pedido: pedidoId,
            motivo: 'Para toggle investigacion',
            tipo_destino: 'COMERCIO',
            estado_reporte: 'PENDIENTE_REVISION',
            id_emisor: cliente.id,
            id_denunciado: comercianteHabilitado.id,
          },
        });
        reporteToggleId = r.id_reporte;
      });

      afterAll(async () => {
        await prisma.reporte.deleteMany({
          where: { id_reporte: reporteToggleId },
        });
      });

      it('PENDIENTE_REVISION → BAJO_INVESTIGACION (y usuario a BAJO_INVESTIGACION)', async () => {
        const res = await request(server())
          .patch(`/admin/denuncias/${reporteToggleId}/investigacion`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.estado_reporte).toBe('BAJO_INVESTIGACION');

        // Usuario denunciado pasa a BAJO_INVESTIGACION
        const usuario = await prisma.usuario.findUnique({
          where: { id: comercianteHabilitado.id },
        });
        expect(usuario?.estado).toBe('BAJO_INVESTIGACION');
      });

      it('BAJO_INVESTIGACION → PENDIENTE_REVISION (y usuario a HABILITADO si no hay otros)', async () => {
        const res = await request(server())
          .patch(`/admin/denuncias/${reporteToggleId}/investigacion`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.estado_reporte).toBe('PENDIENTE_REVISION');

        // Usuario denunciado vuelve a HABILITADO (no hay otros reportes BAJO_INVESTIGACION)
        const usuario = await prisma.usuario.findUnique({
          where: { id: comercianteHabilitado.id },
        });
        expect(usuario?.estado).toBe('HABILITADO');
      });

      it('rechaza toggle en reporte cerrado (DESESTIMADO/RESUELTO)', async () => {
        const r = await prisma.reporte.create({
          data: {
            id_pedido: pedidoId,
            motivo: 'Cerrado',
            tipo_destino: 'COMERCIO',
            estado_reporte: 'DESESTIMADO',
            id_emisor: cliente.id,
            id_denunciado: comercianteHabilitado.id,
          },
        });

        await request(server())
          .patch(`/admin/denuncias/${r.id_reporte}/investigacion`)
          .set(auth(adminToken))
          .expect(400);

        await prisma.reporte.delete({ where: { id_reporte: r.id_reporte } });
      });

      it('rechaza no-admin', async () => {
        await request(server())
          .patch(`/admin/denuncias/${reporteToggleId}/investigacion`)
          .set(auth(comercianteToken))
          .expect(403);
      });
    });

    describe('PATCH /admin/denuncias/:id/desestimar - Desestimar denuncia', () => {
      let reporteResolverId: number;

      beforeAll(async () => {
        const r = await prisma.reporte.create({
          data: {
            id_pedido: pedidoId,
            motivo: 'Para resolver',
            tipo_destino: 'COMERCIO',
            estado_reporte: 'PENDIENTE_REVISION',
            id_emisor: cliente.id,
            id_denunciado: comercianteHabilitado.id,
          },
        });
        reporteResolverId = r.id_reporte;
      });

      afterAll(async () => {
        await prisma.reporte.deleteMany({
          where: { id_reporte: reporteResolverId },
        });
      });

      it('marca reporte como DESESTIMADO con admin y fecha', async () => {
        const res = await request(server())
          .patch(`/admin/denuncias/${reporteResolverId}/desestimar`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body.success).toBe(true);

        const reporte = await prisma.reporte.findUnique({
          where: { id_reporte: reporteResolverId },
        });
        expect(reporte?.estado_reporte).toBe('DESESTIMADO');
        expect(reporte?.id_admin).toBe(admin.id);
        expect(reporte?.fecha_resolucion).toBeDefined();
      });

      it('si denunciado estaba BAJO_INVESTIGACION y no hay otros → HABILITADO', async () => {
        // Poner usuario en BAJO_INVESTIGACION
        await prisma.usuario.update({
          where: { id: comercianteHabilitado.id },
          data: { estado: 'BAJO_INVESTIGACION' },
        });

        // Crear reporte para desestimar
        const r = await prisma.reporte.create({
          data: {
            id_pedido: pedidoId,
            motivo: 'Para desestimar con bajo investigacion',
            tipo_destino: 'COMERCIO',
            estado_reporte: 'BAJO_INVESTIGACION',
            id_emisor: cliente.id,
            id_denunciado: comercianteHabilitado.id,
          },
        });

        await request(server())
          .patch(`/admin/denuncias/${r.id_reporte}/desestimar`)
          .set(auth(adminToken))
          .expect(200);

        const usuario = await prisma.usuario.findUnique({
          where: { id: comercianteHabilitado.id },
        });
        expect(usuario?.estado).toBe('HABILITADO');

        await prisma.reporte.delete({ where: { id_reporte: r.id_reporte } });
      });

      it('rechaza desestimar reporte ya cerrado', async () => {
        await request(server())
          .patch(`/admin/denuncias/${reporteResolverId}/desestimar`)
          .set(auth(adminToken))
          .expect(400);
      });
    });

    describe('PATCH /admin/denuncias/:id/resolver - Resolver sin sanción', () => {
      it('marca reporte como RESUELTO sin suspender al denunciado', async () => {
        const r = await prisma.reporte.create({
          data: {
            id_pedido: pedidoId,
            motivo: 'Para resolver sin sanción',
            tipo_destino: 'COMERCIO',
            estado_reporte: 'PENDIENTE_REVISION',
            id_emisor: cliente.id,
            id_denunciado: comercianteHabilitado.id,
          },
        });

        await request(server())
          .patch(`/admin/denuncias/${r.id_reporte}/resolver`)
          .set(auth(adminToken))
          .expect(200);

        const reporte = await prisma.reporte.findUnique({
          where: { id_reporte: r.id_reporte },
        });
        expect(reporte?.estado_reporte).toBe('RESUELTO');

        const usuario = await prisma.usuario.findUnique({
          where: { id: comercianteHabilitado.id },
        });
        expect(usuario?.estado).toBe('HABILITADO');

        await prisma.reporte.delete({ where: { id_reporte: r.id_reporte } });
      });
    });

    describe('PATCH /admin/denuncias/:id/sancionar - Sancionar usuario', () => {
      let reporteSancionarId: number;
      let reporteExtraId: number;

      beforeAll(async () => {
        const r = await prisma.reporte.create({
          data: {
            id_pedido: pedidoId,
            motivo: 'Para sancionar',
            tipo_destino: 'COMERCIO',
            estado_reporte: 'PENDIENTE_REVISION',
            id_emisor: cliente.id,
            id_denunciado: comercianteHabilitado.id,
          },
        });
        reporteSancionarId = r.id_reporte;

        const extra = await prisma.reporte.create({
          data: {
            id_pedido: pedidoId,
            motivo: 'Otra denuncia abierta del mismo usuario',
            tipo_destino: 'COMERCIO',
            estado_reporte: 'BAJO_INVESTIGACION',
            id_emisor: cliente.id,
            id_denunciado: comercianteHabilitado.id,
          },
        });
        reporteExtraId = extra.id_reporte;
      });

      afterAll(async () => {
        // Restaurar usuario a HABILITADO para cleanup
        await prisma.usuario.update({
          where: { id: comercianteHabilitado.id },
          data: { estado: 'HABILITADO', tokenVersion: { increment: 1 } },
        });
        await prisma.comercio.update({
          where: { idComercio: comercioHabilitadoId },
          data: { estado: 'HABILITADO' },
        });
        await prisma.reporte.deleteMany({
          where: { id_reporte: { in: [reporteSancionarId, reporteExtraId] } },
        });
      });

      it('sanciona → reporte RESUELTO + usuario SUSPENDIDO + tokenVersion++', async () => {
        const tokenVersionAntes =
          (
            await prisma.usuario.findUnique({
              where: { id: comercianteHabilitado.id },
            })
          )?.tokenVersion ?? 0;

        const res = await request(server())
          .patch(`/admin/denuncias/${reporteSancionarId}/sancionar`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body).toMatchObject({
          reporte: { estado_reporte: 'RESUELTO', id_admin: admin.id },
          usuario: {
            estado: 'SUSPENDIDO',
          },
          comercioSuspendido: true,
          denunciasCerradas: expect.any(Number),
          notificacion: { enviada: expect.any(Boolean) },
        });
        expect(res.body.denunciasCerradas).toBeGreaterThanOrEqual(1);

        const extra = await prisma.reporte.findUnique({
          where: { id_reporte: reporteExtraId },
        });
        expect(extra?.estado_reporte).toBe('RESUELTO');
        expect(extra?.id_admin).toBe(admin.id);
        expect(extra?.fecha_resolucion).toBeDefined();

        const usuario = await prisma.usuario.findUnique({
          where: { id: comercianteHabilitado.id },
        });
        expect(usuario?.estado).toBe('SUSPENDIDO');
        expect(usuario?.tokenVersion).toBe(tokenVersionAntes + 1);

        const comercio = await prisma.comercio.findUnique({
          where: { idComercio: comercioHabilitadoId },
        });
        expect(comercio?.estado).toBe('SUSPENDIDO');
      });

      it('rechaza sancionar reporte ya cerrado', async () => {
        const r = await prisma.reporte.create({
          data: {
            id_pedido: pedidoId,
            motivo: 'Ya cerrado',
            tipo_destino: 'COMERCIO',
            estado_reporte: 'RESUELTO',
            id_emisor: cliente.id,
            id_denunciado: comercianteHabilitado.id,
          },
        });

        await request(server())
          .patch(`/admin/denuncias/${r.id_reporte}/sancionar`)
          .set(auth(adminToken))
          .expect(400);

        await prisma.reporte.delete({ where: { id_reporte: r.id_reporte } });
      });
    });

    describe('PATCH /admin/usuarios/:id/rehabilitar - Rehabilitar cuenta', () => {
      let usuarioRehabId: string;
      let comercioRehabId: string;

      beforeAll(async () => {
        const u = await crearUsuario({
          email: 'rehabilitar@test.com',
          dni: '70000009',
          rol: 'COMERCIANTE',
          estado: 'SUSPENDIDO',
        });
        usuarioRehabId = u.id;
        const com = await crearComercio(u.id, false);
        comercioRehabId = com.idComercio;
        await prisma.comercio.update({
          where: { idComercio: comercioRehabId },
          data: { estado: 'SUSPENDIDO' },
        });
      });

      it('rehabilita usuario y comercio suspendidos → HABILITADO', async () => {
        const res = await request(server())
          .patch(`/admin/usuarios/${usuarioRehabId}/rehabilitar`)
          .set(auth(adminToken))
          .expect(200);

        expect(res.body).toMatchObject({
          id: usuarioRehabId,
          estado: 'HABILITADO',
        });

        const usuario = await prisma.usuario.findUnique({
          where: { id: usuarioRehabId },
        });
        expect(usuario?.estado).toBe('HABILITADO');

        const comercio = await prisma.comercio.findUnique({
          where: { idComercio: comercioRehabId },
        });
        expect(comercio?.estado).toBe('HABILITADO');
      });

      it('rechaza rehabilitar usuario ya HABILITADO (400)', async () => {
        await request(server())
          .patch(`/admin/usuarios/${usuarioRehabId}/rehabilitar`)
          .set(auth(adminToken))
          .expect(400);
      });

      it('rechaza no-admin (403)', async () => {
        await request(server())
          .patch(`/admin/usuarios/${usuarioRehabId}/rehabilitar`)
          .set(auth(comercianteToken))
          .expect(403);
      });
    });
  });
});
