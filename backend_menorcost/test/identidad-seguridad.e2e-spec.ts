import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { CodigosService } from './../src/modules/auth/codigos.service.js';
import { PrismaService } from './../src/prisma/prisma.service.js';

const PASSWORD = 'Password123';

describe('Identidad y seguridad (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let codigos: CodigosService;

  const server = () => app.getHttpServer();

  async function crearUsuario(opts: {
    email: string;
    dni: string;
    rol?: 'CLIENTE' | 'COMERCIANTE' | 'ADMINISTRADOR';
    estado?: 'HABILITADO' | 'PENDIENTE_VERIFICACION' | 'SUSPENDIDO';
    password?: string;
  }) {
    return prisma.usuario.create({
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
  }

  function login(email: string, password = PASSWORD) {
    return request(server()).post('/auth/login').send({ email, password });
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
    codigos = new CodigosService(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Protección de rutas', () => {
    it('rechaza peticiones sin token', async () => {
      await request(server()).get('/auth/me').expect(401);
      await request(server()).get('/direcciones').expect(401);
      await request(server())
        .post('/baja-cuenta')
        .send({ motivo: 'x', password: PASSWORD })
        .expect(401);
    });

    it('rechaza tokens inválidos', async () => {
      await request(server())
        .get('/auth/me')
        .set('Authorization', 'Bearer token-falso')
        .expect(401);
    });
  });

  describe('Registro y verificación [1.01]', () => {
    it('valida el cuerpo de la petición', async () => {
      await request(server())
        .post('/auth/registro')
        .send({ dni: 'abc', email: 'no-es-email', password: '123' })
        .expect(400);
    });

    it('completa registro, verificación OTP y login', async () => {
      const email = 'nuevo@menorcost.local';

      await request(server())
        .post('/auth/registro')
        .send({
          dni: '30111222',
          nombre: 'Nuevo',
          apellido: 'Cliente',
          fechaNacimiento: '1995-05-05',
          telefono: '2901444555',
          email,
          password: PASSWORD,
        })
        .expect(201);

      const usuario = await prisma.usuario.findFirst({
        where: { email },
      });
      expect(usuario?.estado).toBe('PENDIENTE_VERIFICACION');

      await request(server())
        .post('/auth/verificar-cuenta')
        .send({ email, codigo: '000000' })
        .expect(400);

      await codigos.crear(usuario!.id, 'VERIFICACION_EMAIL', '123456', 10);

      const verificado = await request(server())
        .post('/auth/verificar-cuenta')
        .send({ email, codigo: '123456' })
        .expect(200);

      expect(verificado.body.usuario.estado).toBe('HABILITADO');
      expect(verificado.body.accessToken).toBeDefined();

      const ingreso = await login(email).expect(200);
      const token = ingreso.body.accessToken as string;

      const me = await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(me.body).toMatchObject({ email, rol: 'CLIENTE' });
    });

    it('rechaza DNI y correo duplicados', async () => {
      await crearUsuario({ email: 'dup@menorcost.local', dni: '40111222' });

      await request(server())
        .post('/auth/registro')
        .send({
          dni: '40111222',
          nombre: 'Otro',
          apellido: 'User',
          fechaNacimiento: '1995-05-05',
          telefono: '2901444555',
          email: 'distinto@menorcost.local',
          password: PASSWORD,
        })
        .expect(409);

      await request(server())
        .post('/auth/registro')
        .send({
          dni: '40999888',
          nombre: 'Otro',
          apellido: 'User',
          fechaNacimiento: '1995-05-05',
          telefono: '2901444555',
          email: 'dup@menorcost.local',
          password: PASSWORD,
        })
        .expect(409);
    });

    it('bloquea el login de cuentas sin verificar', async () => {
      await crearUsuario({
        email: 'pendiente@menorcost.local',
        dni: '41111222',
        estado: 'PENDIENTE_VERIFICACION',
      });

      const res = await login('pendiente@menorcost.local').expect(403);
      expect(res.body.code).toBe('CUENTA_PENDIENTE_VERIFICACION');
    });
  });

  describe('Recuperación de contraseña [1.06]', () => {
    it('responde genérico ante correos desconocidos', async () => {
      const res = await request(server())
        .post('/auth/olvidar-password')
        .send({ email: 'inexistente@menorcost.local' })
        .expect(200);
      expect(res.body.message).toMatch(/Si el correo ingresado/);
    });

    it('restablece la contraseña e invalida sesiones previas', async () => {
      const email = 'recupera@menorcost.local';
      const usuario = await crearUsuario({ email, dni: '42222333' });

      const ingreso = await login(email).expect(200);
      const tokenViejo = ingreso.body.accessToken as string;

      await request(server())
        .post('/auth/olvidar-password')
        .send({ email })
        .expect(200);

      await codigos.crear(
        usuario.id,
        'RECUPERACION_PASSWORD',
        'reset-token',
        15,
      );

      await request(server())
        .post('/auth/restablecer-password')
        .send({ token: 'token-invalido', password: 'NuevaClave123' })
        .expect(400);

      await request(server())
        .post('/auth/restablecer-password')
        .send({ token: 'reset-token', password: 'NuevaClave123' })
        .expect(200);

      await login(email).expect(401);
      await login(email, 'NuevaClave123').expect(200);

      await request(server())
        .get('/auth/me')
        .set('Authorization', `Bearer ${tokenViejo}`)
        .expect(401);
    });
  });

  describe('Gestión de direcciones [1.02]', () => {
    let token: string;
    let usuarioId: string;

    beforeAll(async () => {
      const email = 'direcciones@menorcost.local';
      const usuario = await crearUsuario({ email, dni: '43333444' });
      usuarioId = usuario.id;
      const res = await login(email).expect(200);
      token = res.body.accessToken as string;
    });

    const auth = () => ({ Authorization: `Bearer ${token}` });

    it('la primera dirección es predeterminada', async () => {
      const res = await request(server())
        .post('/direcciones')
        .set(auth())
        .send({
          etiqueta: 'Casa',
          calle: 'San Martin',
          numero: '123',
          localidad: 'Ushuaia',
          latitud: -54.8,
          longitud: -68.3,
        })
        .expect(201);

      expect(res.body.esPredeterminada).toBe(true);
    });

    it('no permite borrar la predeterminada y reasigna correctamente', async () => {
      const segunda = await request(server())
        .post('/direcciones')
        .set(auth())
        .send({
          etiqueta: 'Trabajo',
          calle: 'Belgrano',
          numero: '45',
          localidad: 'Ushuaia',
          latitud: -54.81,
          longitud: -68.31,
        })
        .expect(201);

      expect(segunda.body.esPredeterminada).toBe(false);

      const lista = await request(server())
        .get('/direcciones')
        .set(auth())
        .expect(200);

      const predeterminada = lista.body.find(
        (d: { esPredeterminada: boolean }) => d.esPredeterminada,
      );

      await request(server())
        .delete(`/direcciones/${predeterminada.id}`)
        .set(auth())
        .expect(400);

      await request(server())
        .patch(`/direcciones/${segunda.body.id}/predeterminada`)
        .set(auth())
        .expect(200);

      await request(server())
        .delete(`/direcciones/${predeterminada.id}`)
        .set(auth())
        .expect(200);
    });

    it('aísla las direcciones por dueño', async () => {
      const otro = await crearUsuario({
        email: 'otro-dir@menorcost.local',
        dni: '44444555',
      });
      const ajena = await prisma.direccion.create({
        data: {
          usuarioId: otro.id,
          etiqueta: 'Ajena',
          calle: 'X',
          numero: '1',
          localidad: 'Ushuaia',
          latitud: -54.8,
          longitud: -68.3,
        },
      });

      await request(server())
        .patch(`/direcciones/${ajena.id}`)
        .set(auth())
        .send({ etiqueta: 'Hack' })
        .expect(404);

      await request(server())
        .delete(`/direcciones/${ajena.id}`)
        .set(auth())
        .expect(404);

      expect(usuarioId).toBeDefined();
    });
  });

  describe('Baja de cuenta y backoffice [1.07]', () => {
    it('valida contraseña, rol y ejecuta la baja', async () => {
      const email = 'baja@menorcost.local';
      const usuario = await crearUsuario({ email, dni: '45555666' });

      const ingreso = await login(email).expect(200);
      const token = ingreso.body.accessToken as string;
      const auth = { Authorization: `Bearer ${token}` };

      await request(server())
        .post('/baja-cuenta')
        .set(auth)
        .send({ motivo: 'x', password: 'Incorrecta1' })
        .expect(401);

      await request(server())
        .post('/baja-cuenta')
        .set(auth)
        .send({ motivo: 'Ya no la uso', password: PASSWORD })
        .expect(200);

      await request(server())
        .post('/baja-cuenta')
        .set(auth)
        .send({ motivo: 'Otra vez', password: PASSWORD })
        .expect(409);

      await request(server()).get('/admin/bajas').set(auth).expect(403);

      const adminEmail = 'admin@menorcost.local';
      await crearUsuario({
        email: adminEmail,
        dni: '46666777',
        rol: 'ADMINISTRADOR',
      });
      const adminLogin = await login(adminEmail).expect(200);
      const adminAuth = {
        Authorization: `Bearer ${adminLogin.body.accessToken as string}`,
      };

      const pendientes = await request(server())
        .get('/admin/bajas?estado=PENDIENTE')
        .set(adminAuth)
        .expect(200);

      const solicitud = pendientes.body.find(
        (s: { usuario: { id: string } }) => s.usuario.id === usuario.id,
      );
      expect(solicitud).toBeDefined();
      expect(solicitud).toMatchObject({
        pedidosCompletados: 0,
        saldoTarifas: 0,
      });

      await request(server())
        .patch(`/admin/bajas/${solicitud.id}/aprobar`)
        .set(adminAuth)
        .expect(200);

      const inactivado = await prisma.usuario.findUnique({
        where: { id: usuario.id },
      });
      expect(inactivado?.deletedAt).not.toBeNull();

      await request(server()).get('/auth/me').set(auth).expect(401);
    });

    it('el rechazo restaura la cuenta', async () => {
      const email = 'rechazo@menorcost.local';
      const usuario = await crearUsuario({ email, dni: '47777888' });
      const token = (await login(email).expect(200)).body.accessToken as string;

      await request(server())
        .post('/baja-cuenta')
        .set('Authorization', `Bearer ${token}`)
        .send({ motivo: 'Duda', password: PASSWORD })
        .expect(200);

      const adminEmail = 'admin2@menorcost.local';
      await crearUsuario({
        email: adminEmail,
        dni: '48888999',
        rol: 'ADMINISTRADOR',
      });
      const adminAuth = {
        Authorization: `Bearer ${(await login(adminEmail).expect(200)).body.accessToken as string}`,
      };

      const pendientes = await request(server())
        .get('/admin/bajas?estado=PENDIENTE')
        .set(adminAuth)
        .expect(200);

      const solicitud = pendientes.body.find(
        (s: { usuario: { id: string } }) => s.usuario.id === usuario.id,
      );

      await request(server())
        .patch(`/admin/bajas/${solicitud.id}/rechazar`)
        .set(adminAuth)
        .send({ observaciones: 'Revisar manualmente' })
        .expect(200);

      const restaurado = await prisma.usuario.findUnique({
        where: { id: usuario.id },
      });
      expect(restaurado?.estado).toBe('HABILITADO');

      await login(email).expect(200);
    });
  });
});
