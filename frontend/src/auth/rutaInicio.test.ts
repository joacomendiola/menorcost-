import { describe, expect, it } from "vitest";
import { rutaInicio } from "./rutaInicio";

describe("rutaInicio", () => {
  it("dirige al cliente a la pantalla de inicio del flujo", () => {
    expect(rutaInicio("CLIENTE", "HABILITADO")).toBe("/inicio");
  });

  it("mantiene las pantallas de inicio de comerciante y administrador", () => {
    expect(rutaInicio("COMERCIANTE", "HABILITADO")).toBe("/panel");
    expect(rutaInicio("COMERCIANTE", "PENDIENTE_VERIFICACION")).toBe(
      "/comercio/estado",
    );
    expect(rutaInicio("ADMINISTRADOR")).toBe("/admin/altas");
  });
});
