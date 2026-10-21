# Kit Carpintero

Web app gratuita para diseñar muebles de carpintería fina: piezas editables en 3D, encastres, lista de cortes, tablas de madereras de Buenos Aires y planos técnicos. Corre entera en el navegador, sin cuenta.

## Estructura

| Carpeta | Qué tiene |
| --- | --- |
| `packages/core` | Núcleo sin React: modelo del proyecto (Zod, con versión y migraciones), unidades cm/pulgadas, maderas, catálogo de madereras, encastres base, imán y encastres que se actualizan solos. |
| `apps/web` | La app (React + Vite + TypeScript): inicio, editor 3D (React Three Fiber, Zustand con deshacer) y guardado en el dispositivo (IndexedDB con Dexie). |

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
- Se publica en GitHub Pages en cada push a `main`.
