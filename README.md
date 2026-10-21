# Kit Carpintero

Web app gratuita para diseñar muebles de carpintería fina: piezas editables en 3D, encastres, lista de cortes, tablas de madereras de Buenos Aires y planos técnicos. Corre entera en el navegador, sin cuenta.

## Estructura

| Carpeta | Qué tiene |
| --- | --- |
| `packages/core` | Núcleo sin React: modelo del proyecto (Zod, con versión y migraciones), unidades cm/pulgadas, maderas, catálogo de madereras, encastres base, imán, encastres que se actualizan solos, lista de cortes, plan de corte por tabla comercial y dibujo técnico con líneas ocultas. |
| `apps/web` | La app (React + Vite + TypeScript): inicio, editor 3D (React Three Fiber, Zustand con deshacer), Uniones con detalle 3D, Cortes con lista de compras y planilla CSV, Plano en hojas A4 con PDF, y guardado en el dispositivo (IndexedDB con Dexie). |

## Comandos

```bash
npm install
npm run dev        # app en http://localhost:5173
npm run check      # lint + tipos + pruebas + build (lo mismo que corre CI)
```

## Decisiones

- Medidas internas siempre en mm; cm y pulgadas (fracciones de 1/16″) son solo presentación.
- Cada pieza es una receta (forma base + posición + operaciones); el 3D, el plano y los cortes se calculan desde el proyecto.
- Geometría exacta con replicad (OpenCascade) en un Web Worker, para encastres y redondeos.
- Plan de corte: 3 mm por corte de sierra y 1 cm para escuadrar cada punta; las tapas anchas se encolan con tablas de 6″.
- El PDF del plano sale de la impresión del navegador («Guardar como PDF»): hojas SVG en A4 apaisado, sin librerías extra.
- Se publica en GitHub Pages en cada push a `main`.
