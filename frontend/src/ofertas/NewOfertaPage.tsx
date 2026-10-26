import { useAuth } from '../auth/contexto';

export function NuevaOfertaPage() {
  const { usuario } = useAuth();

  if (usuario?.rol !== 'COMERCIANTE') {
    return (
      <main>
        <h1>Publicar oferta</h1>
        <p role="alert">
          Esta sección está disponible para cuentas de comerciante.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Publicar oferta</h1>
      <p role="status">
        El formulario estará disponible cuando se integren los datos de
        comercios y categorías.
      </p>

      {/*
        TODO integración: cuando llegue el PR de comercios y categorías:
        1. Consultar las opciones usando el token de useAuth().
        2. Mostrar estados de carga y error.
        3. Reemplazar este mensaje por NewOfferForm y pasarle token,
           comercios y categorías obtenidos de la API.
      */}
    </main>
  );
}