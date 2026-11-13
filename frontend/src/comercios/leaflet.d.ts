declare module 'leaflet' {
  export interface Map {
    setView(center: [number, number], zoom: number): Map;
    remove(): void;
    fitBounds(bounds: [[number, number], [number, number]], options?: { padding?: [number, number]; maxZoom?: number }): void;
  }
  export interface LayerGroup { addTo(map: Map): LayerGroup; clearLayers(): void }
  export interface Marker { addTo(group: LayerGroup): Marker; bindPopup(content: string): Marker }
  const L: {
    map(container: HTMLElement, options?: { scrollWheelZoom?: boolean }): Map;
    tileLayer(url: string, options: { attribution: string; subdomains?: string }): { addTo(map: Map): void };
    layerGroup(): LayerGroup;
    marker(position: [number, number], options?: { icon?: unknown }): Marker;
    divIcon(options: { className?: string; html?: string; iconSize?: [number, number]; iconAnchor?: [number, number] }): unknown;
  };
  export default L;
}
