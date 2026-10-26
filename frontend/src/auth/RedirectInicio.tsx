import { Center, Loader } from '@mantine/core';
import { Navigate } from 'react-router-dom';
import { useAuth } from './contexto';
import { rutaInicio } from './rutaInicio';

/** "/" y rutas desconocidas: llevan a la pantalla de inicio del rol. */
export function RedirectInicio() {
  const { usuario, cargando } = useAuth();

  if (cargando) {
    return (
      <Center mih="60vh">
        <Loader color="brand" />
      </Center>
    );
  }

  return <Navigate to={usuario ? rutaInicio(usuario.rol) : '/login'} replace />;
}