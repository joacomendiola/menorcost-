import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InicioClientePage } from "./InicioClientePage";

const mocks = vi.hoisted(() => ({ api: vi.fn(), listar: vi.fn() }));

vi.mock("../api", () => ({
  api: mocks.api,
  direccionesApi: { listar: mocks.listar },
}));
vi.mock("../auth/contexto", () => ({
  useAuth: () => ({
    token: "token-demo",
    usuario: { nombre: "Ana" },
  }),
}));
vi.mock("./MapaExploracion", () => ({
  MapaExploracion: () => <div data-testid="mapa-inicio-cliente" />,
}));

const direccion = {
  id: "dir-1",
  usuarioId: "user-1",
  etiqueta: "Casa",
  calle: "San Martín",
  numero: "1200",
  piso: null,
  localidad: "Ushuaia",
  descripcion: null,
  latitud: "-54.8019",
  longitud: "-68.3029",
  esPredeterminada: true,
  createdAt: "",
  updatedAt: "",
};

const producto = {
  id: "product-1",
  titulo: "Leche entera",
  descripcion: "Oferta de prueba",
  imagen: "/uploads/leche.png",
  precioLista: "3200.00",
  precioPublico: "2500.00",
  fechaVencimiento: "2026-11-20",
  distanciaKm: 1.2,
  comercio: {
    id: "store-1",
    nombreFantasia: "Almacén del Centro",
    localidad: "Ushuaia",
    logoUrl: null,
    latitud: "-54.8018",
    longitud: "-68.3028",
    abierto: true,
  },
};

function UbicacionActual() {
  const ubicacion = useLocation();
  return <output>{ubicacion.pathname + ubicacion.search}</output>;
}

function renderizar() {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={["/inicio"]}>
        <Routes>
          <Route path="/inicio" element={<InicioClientePage />} />
          <Route path="/buscar" element={<UbicacionActual />} />
          <Route path="/canastas" element={<div>CANASTAS</div>} />
          <Route path="/perfil" element={<div>PERFIL</div>} />
        </Routes>
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe("InicioClientePage", () => {
  beforeEach(() => {
    mocks.api.mockReset().mockResolvedValue([producto]);
    mocks.listar.mockReset().mockResolvedValue([direccion]);
  });

  it("muestra la dirección, el mapa y los locales agrupados por comercio", async () => {
    renderizar();

    expect(
      await screen.findByTestId("mapa-inicio-cliente"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ushuaia · Casa/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Locales cercanos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Almacén del Centro")).toBeInTheDocument();
    expect(screen.getByText("Leche entera")).toBeInTheDocument();
    expect(mocks.api).toHaveBeenCalledWith(
      "/catalogo?latitud=-54.8019&longitud=-68.3029",
    );
  });

  it("lleva el buscador a la exploración con la consulta ingresada", async () => {
    renderizar();
    await screen.findByText("Almacén del Centro");

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar locales" }), {
      target: { value: "Almacén" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => {
      expect(screen.getByText("/buscar?q=Almac%C3%A9n")).toBeInTheDocument();
    });
  });

  it("ofrece agregar una dirección si no hay una predeterminada", async () => {
    mocks.listar.mockResolvedValue([]);
    renderizar();

    expect(
      await screen.findByRole("button", { name: "Agregar dirección" }),
    ).toBeInTheDocument();
    expect(mocks.api).not.toHaveBeenCalled();
  });
});
