import { Button, Loader, TextInput } from "@mantine/core";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, direccionesApi, type Direccion } from "../api";
import { useAuth } from "../auth/contexto";
import { Logo } from "../components/Logo";
import { resolverImagen } from "./api";
import type { OfertaMapa } from "./mapaCatalogo";
import "./inicio-cliente.css";

const MapaExploracion = lazy(() =>
  import("./MapaExploracion").then(({ MapaExploracion }) => ({
    default: MapaExploracion,
  })),
);

interface ProductoInicio extends OfertaMapa {
  imagen: string;
  descripcion: string;
  precioLista: string | number;
  fechaVencimiento: string;
  distanciaKm: number | null;
  comercio: OfertaMapa["comercio"] & {
    localidad: string;
    logoUrl: string | null;
  };
}

interface LocalCercano {
  id: string;
  nombre: string;
  localidad: string;
  abierto: boolean;
  logoUrl: string | null;
  ofertas: ProductoInicio[];
  distanciaKm: number | null;
}

const moneda = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function InicioClientePage() {
  const { token, usuario } = useAuth();
  const navigate = useNavigate();
  const [direccion, setDireccion] = useState<Direccion | null>(null);
  const [productos, setProductos] = useState<ProductoInicio[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!token) {
      setCargando(false);
      setError(
        "Iniciá sesión como cliente para explorar los locales cercanos.",
      );
      return;
    }

    let activo = true;
    setCargando(true);
    setError("");

    void (async () => {
      try {
        const direcciones = await direccionesApi.listar(token);
        const predeterminada =
          direcciones.find((item) => item.esPredeterminada) ?? null;
        if (!activo) return;
        setDireccion(predeterminada);

        if (!predeterminada) {
          setProductos([]);
          return;
        }

        const parametros = new URLSearchParams({
          latitud: String(predeterminada.latitud),
          longitud: String(predeterminada.longitud),
        });
        const ofertas = await api<ProductoInicio[]>(
          `/catalogo?${parametros.toString()}`,
        );
        if (activo) setProductos(ofertas);
      } catch (errorDesconocido) {
        if (activo) {
          setError(
            errorDesconocido instanceof Error
              ? errorDesconocido.message
              : "No pudimos cargar los locales cercanos.",
          );
        }
      } finally {
        if (activo) setCargando(false);
      }
    })();

    return () => {
      activo = false;
    };
  }, [token, intento]);

  const locales = useMemo(() => {
    const agrupados = new Map<string, LocalCercano>();
    for (const producto of productos) {
      const comercio = producto.comercio;
      const local = agrupados.get(comercio.id);
      if (local) {
        local.ofertas.push(producto);
        if (
          producto.distanciaKm !== null &&
          (local.distanciaKm === null ||
            producto.distanciaKm < local.distanciaKm)
        ) {
          local.distanciaKm = producto.distanciaKm;
        }
      } else {
        agrupados.set(comercio.id, {
          id: comercio.id,
          nombre: comercio.nombreFantasia,
          localidad: comercio.localidad,
          abierto: comercio.abierto,
          logoUrl: comercio.logoUrl,
          ofertas: [producto],
          distanciaKm: producto.distanciaKm,
        });
      }
    }
    return [...agrupados.values()].sort(
      (a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity),
    );
  }, [productos]);

  function buscarLocales(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const consulta = busqueda.trim();
    navigate(
      consulta ? `/buscar?q=${encodeURIComponent(consulta)}` : "/buscar",
    );
  }

  const direccionLabel = direccion
    ? `${direccion.localidad}${direccion.etiqueta ? ` · ${direccion.etiqueta}` : ""}`
    : "Agregá una dirección";

  return (
    <>
      <header className="inicio-cliente__top">
        <Link to="/inicio" aria-label="Ir al inicio de Menorcost">
          <Logo />
        </Link>

        <button
          type="button"
          className="inicio-cliente__direccion"
          onClick={() => navigate("/perfil")}
        >
          <span>Enviar a</span>
          <strong>{direccionLabel} ⌄</strong>
        </button>

        <form className="inicio-cliente__search" onSubmit={buscarLocales}>
          <TextInput
            aria-label="Buscar locales"
            placeholder="Buscar locales"
            value={busqueda}
            onChange={(event) => setBusqueda(event.currentTarget.value)}
          />
          <Button type="submit" aria-label="Buscar">
            🔍
          </Button>
        </form>

        <nav
          className="inicio-cliente__actions"
          aria-label="Acciones de cliente"
        >
          <Link className="pill" to="/canastas">
            <span aria-hidden="true">🧺</span>
            Mis canastas
          </Link>
          <Link className="pill" to="/perfil">
            <span aria-hidden="true">👤</span>
            {usuario?.nombre ?? "Mi perfil"}
          </Link>
        </nav>
      </header>

      <main className="inicio-cliente">
        <section
          className="inicio-cliente__map-wrap"
          aria-label="Locales cercanos en el mapa"
        >
          {direccion ? (
            <Suspense
              fallback={
                <div className="inicio-cliente__map-loading">
                  <Loader />
                </div>
              }
            >
              <MapaExploracion
                ofertas={productos}
                latitudOrigen={Number(direccion.latitud)}
                longitudOrigen={Number(direccion.longitud)}
              />
            </Suspense>
          ) : (
            <div className="inicio-cliente__map-empty">
              <h1>Encontrá ofertas cerca tuyo</h1>
              <p>Agregá una dirección para ubicar los comercios en el mapa.</p>
              <Button onClick={() => navigate("/perfil")}>
                Agregar dirección
              </Button>
            </div>
          )}
        </section>

        <section className="inicio-cliente__locals">
          <div className="inicio-cliente__locals-heading">
            <div>
              <h1>Locales cercanos</h1>
              <p>Comercios habilitados con ofertas disponibles</p>
            </div>
            <Link to="/buscar">
              Ver todos <span aria-hidden="true">→</span>
            </Link>
          </div>

          {error ? (
            <div className="inicio-cliente__state" role="alert">
              <p>{error}</p>
              <Button
                variant="default"
                onClick={() => setIntento((n) => n + 1)}
              >
                Reintentar
              </Button>
            </div>
          ) : cargando ? (
            <div className="inicio-cliente__state" role="status">
              <Loader />
            </div>
          ) : !direccion ? null : locales.length === 0 ? (
            <div className="inicio-cliente__state">
              <p>
                No encontramos locales con ofertas activas cerca de esa
                dirección.
              </p>
              <Button variant="default" onClick={() => navigate("/buscar")}>
                Explorar ofertas
              </Button>
            </div>
          ) : (
            <div className="inicio-cliente__grid">
              {locales.map((local) => {
                const primeraOferta = local.ofertas[0];
                const imagen = resolverImagen(primeraOferta.imagen);
                const logo = resolverImagen(local.logoUrl);
                const distancia =
                  local.distanciaKm === null
                    ? null
                    : local.distanciaKm < 1
                      ? `${Math.round(local.distanciaKm * 1000)} m`
                      : `${local.distanciaKm.toFixed(1)} km`;

                return (
                  <Link
                    className="inicio-cliente__store"
                    key={local.id}
                    to={`/comercios/${encodeURIComponent(local.id)}`}
                  >
                    <div className="inicio-cliente__store-cover">
                      {imagen && <img src={imagen} alt="" />}
                      <span className="inicio-cliente__offer-count">
                        {local.ofertas.length}{" "}
                        {local.ofertas.length === 1 ? "oferta" : "ofertas"}
                      </span>
                    </div>
                    <div className="inicio-cliente__store-body">
                      <div className="inicio-cliente__store-heading">
                        {logo ? (
                          <img src={logo} alt="" />
                        ) : (
                          <span aria-hidden="true">
                            {local.nombre.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <strong>{local.nombre}</strong>
                        <span
                          className={`inicio-cliente__status ${local.abierto ? "is-open" : ""}`}
                        >
                          {local.abierto ? "Abierto" : "Cerrado"}
                        </span>
                      </div>
                      <p>{local.localidad}</p>
                      <div className="inicio-cliente__store-offer">
                        <span>{primeraOferta.titulo}</span>
                        <strong>
                          {moneda.format(Number(primeraOferta.precioPublico))}
                        </strong>
                      </div>
                      {distancia && <small>A {distancia}</small>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
