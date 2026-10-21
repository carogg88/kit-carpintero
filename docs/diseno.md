# Diseño de Kit Carpintero

Diseño final del MVP (9 pantallas, celular y escritorio): https://claude.ai/artifact/9HhVEFCx3SfjSFp8pjc3VN

Cada sección de la app se construye siguiendo esas pantallas y las reglas de abajo, que salen del skill ui-ux-pro-max adaptadas a la paleta del proyecto.

## Tokens

Los colores, tipografías y espacios viven en `apps/web/src/styles/tokens.css`. Los componentes usan solo esas variables.

Estilo desde 2026-10-21: inspirado en WoodHaven (verde bosque, madera y beige sobre un blanco cálido), con botones de píldora y tarjetas redondeadas.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#F7F8F4` | `#161A15` | Fondo de la app |
| `--surface` | `#FFFFFF` | `#1F251D` | Paneles y tarjetas |
| `--surface-2` | `#EEEFE9` | `#272E25` | Fondos suaves |
| `--ink` | `#2B3628` | `#E8E9E3` | Texto principal |
| `--muted` | `#5E6759` | `#A9B0A3` | Texto secundario (4,5:1 o más) |
| `--accent` | `#9E6027` | `#D49A5E` | Madera: acción principal, enlaces, cotas, pestaña actual |
| `--accent-soft` | `#E6DCD2` | `#3A2E22` | Fondo de lo elegido en listas |
| `--forest` | `#343F31` | `#E6DCD2` | Lo elegido en controles (herramienta, vista, unidades, opciones) y botones secundarios |
| `--dark-card` | `#343F31` | `#2B3628` | Tarjetas oscuras de resumen |
| `--signal` | `#C98A4E` | `#E0A86A` | Encastres resaltados y medida conocida en la foto |

Regla de color: madera para actuar, verde para lo elegido y la estructura, beige para fondos suaves. Nada de colores sueltos fuera de los tokens.

Tipografía: Inter (400 a 700) en toda la app; las medidas usan cifras de ancho fijo (`tabular-nums`). Radios: 12 px en campos, 18 px en tarjetas y píldora (`--radius-pill`) en botones y controles.

## Reglas

- Botones y controles de 44 × 44 px como mínimo; en el celular, la acción principal abajo, de 48 a 52 px de alto.
- Íconos SVG de trazo 2 px, nunca emoji. Los botones de solo ícono llevan `aria-label`.
- Campos con etiqueta visible; las medidas usan `inputmode="decimal"` y se validan al salir del campo, con el aviso al lado del campo.
- Los avisos no dependen solo del color: llevan ícono y texto.
- Tablas anchas dentro de una caja con scroll horizontal; en el celular, la lista de cortes se muestra como tarjetas.
- Navegación del proyecto: Modelo, Uniones, Cortes y Plano (barra inferior en el celular, pestañas arriba en escritorio).
- Animaciones de 150 a 320 ms y siempre respetando `prefers-reduced-motion`.
- Modo claro y oscuro con los mismos tokens; revisar contraste en los dos.
