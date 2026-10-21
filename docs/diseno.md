# Diseño de Kit Carpintero

Diseño final del MVP (9 pantallas, celular y escritorio): https://claude.ai/artifact/9HhVEFCx3SfjSFp8pjc3VN

Cada sección de la app se construye siguiendo esas pantallas y las reglas de abajo, que salen del skill ui-ux-pro-max adaptadas a la paleta del proyecto.

## Tokens

Los colores, tipografías y espacios viven en `apps/web/src/styles/tokens.css`. Los componentes usan solo esas variables.

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| `--bg` | `#F2F1EC` | `#121614` | Fondo de la app |
| `--surface` | `#FFFFFF` | `#1A1F1D` | Paneles y tarjetas |
| `--ink` | `#1C2320` | `#E8EBE9` | Texto principal |
| `--muted` | `#5B6460` | `#A3ACA8` | Texto secundario (4,5:1 o más) |
| `--accent` | `#1E5A7A` | `#7DB9D6` | Acción principal, selección, cotas |
| `--signal` | `#F2B544` | `#F2B544` | Encastres, botón de agregar |

Tipografía: IBM Plex Sans para la interfaz, IBM Plex Mono para todas las medidas.

## Reglas

- Botones y controles de 44 × 44 px como mínimo; en el celular, la acción principal abajo, de 48 a 52 px de alto.
- Íconos SVG de trazo 2 px, nunca emoji. Los botones de solo ícono llevan `aria-label`.
- Campos con etiqueta visible; las medidas usan `inputmode="decimal"` y se validan al salir del campo, con el aviso al lado del campo.
- Los avisos no dependen solo del color: llevan ícono y texto.
- Tablas anchas dentro de una caja con scroll horizontal; en el celular, la lista de cortes se muestra como tarjetas.
- Navegación del proyecto: Modelo, Uniones, Cortes y Plano (barra inferior en el celular, pestañas arriba en escritorio).
- Animaciones de 150 a 320 ms y siempre respetando `prefers-reduced-motion`.
- Modo claro y oscuro con los mismos tokens; revisar contraste en los dos.
