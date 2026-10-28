import type { ReactNode } from 'react';
import { tk, type JointType } from '@kitc/core';
import styles from './Help.module.css';

/**
 * Palabras de taller con una frase y un dibujo chico, para quien no sabe dibujo técnico ni conoce los
 * nombres de los encastres. Los dibujos son cortes o vistas de frente simples: madera clara para lo que
 * queda, madera oscura para lo que entra o lo que importa, y rayas para lo que se saca.
 */

const Svg = ({ children }: { children: ReactNode }) => (
  <svg className={styles.drawing} viewBox="0 0 120 72" aria-hidden="true">
    {children}
  </svg>
);

// Clases: pieza (madera clara), marca (madera oscura) y hueco (raya, sin relleno).
const P = styles.piece;
const M = styles.mark;
const H = styles.hole;

/** Qué es cada encastre: se ve al elegirlo en las plantillas y en la pantalla de Uniones. */
export const JOINT_ABOUT: Partial<Record<JointType, string>> = {
  tope: tk('Las piezas solo se apoyan, sin cortes. Se fijan con tornillos o cola; una tapa maciza, con botones de madera o grampas en 8 que la dejan moverse.'),
  mortaja: tk('Encastre clásico para patas y faldones: fuerte y oculto. Se hace con escoplo o fresadora; la espiga va encolada.'),
  'media-madera': tk('Cada pieza se rebaja a la mitad de su espesor y quedan al ras. Se hace con sierra y formón, o con fresadora.'),
  canal: tk('Una ranura a lo largo de una pieza donde entra el canto de la otra. Ideal para fondos y paneles; se hace con fresadora o sierra de mesa.'),
  rebaje: tk('Un escalón en el canto de una pieza donde apoya la otra. Se usa en fondos y tapas; se hace con fresadora o sierra de mesa.'),
  clavija: tk('Tarugos de madera encolados en agujeros enfrentados. Rápido y prolijo con una plantilla para tarugos.'),
  'cola-milano': tk('El encastre de los cajones finos: las colas se ensanchan hacia la punta y no se pueden sacar tirando. Se marca con falsa escuadra y se corta con serrucho de costilla y formón.'),
  dedos: tk('Dedos rectos que se alternan entre las dos piezas: mucha superficie para la cola. Se hace con sierra de mesa y un patrón de dedos, o con fresadora.'),
  brida: tk('Una horquilla en la punta de una pieza abraza a la otra. Fuerte y fácil de hacer con sierra de cinta o sierra de mesa.'),
  inglete: tk('Las dos piezas se cortan en diagonal y la veta da la vuelta a la esquina sin que se vea la testa. Se corta con ingletadora o sierra de mesa inclinada.'),
  galleta: tk('Galletas de madera comprimida encoladas en ranuras enfrentadas. Alinean paneles rápido; se hacen con galletera.'),
  machiembrado: tk('Una lengüeta en el canto de una tabla entra en la canal de la otra. Para paneles y tablas encoladas de canto; se hace con fresas de machimbre o sierra de mesa.'),
  bolsillo: tk('Tornillos que entran inclinados desde la cara de adentro. Rápido y sin prensas; se hace con una plantilla de bolsillo y mecha escalonada.'),
};

export type JointLevel = 'facil' | 'media' | 'dificil';

/** Qué tan difícil es cada encastre para alguien que empieza, y con qué se hace. */
export const JOINT_LEVEL: Record<JointType, { level: JointLevel; tools: string }> = {
  tope: { level: 'facil', tools: tk('Atornillador y prensas') },
  clavija: { level: 'facil', tools: tk('Taladro y plantilla para tarugos') },
  bolsillo: { level: 'facil', tools: tk('Taladro y plantilla de bolsillo') },
  galleta: { level: 'facil', tools: tk('Galletera') },
  rebaje: { level: 'facil', tools: tk('Fresadora o sierra de mesa') },
  canal: { level: 'facil', tools: tk('Fresadora o sierra de mesa') },
  'media-madera': { level: 'media', tools: tk('Serrucho y formón, o fresadora') },
  machiembrado: { level: 'media', tools: tk('Fresas de machimbre o sierra de mesa') },
  brida: { level: 'media', tools: tk('Sierra de cinta o de mesa, y formón') },
  mortaja: { level: 'media', tools: tk('Escoplo o fresadora, y serrucho para la espiga') },
  dedos: { level: 'media', tools: tk('Sierra de mesa con patrón de dedos') },
  inglete: { level: 'media', tools: tk('Ingletadora o sierra de mesa inclinada') },
  'cola-milano': { level: 'dificil', tools: tk('Serrucho de costilla, formón y falsa escuadra') },
};

export const LEVEL_NAMES: Record<JointLevel, string> = { facil: tk('Fácil'), media: tk('Media'), dificil: tk('Difícil') };

/** Dibujo de cada encastre que se puede elegir en una plantilla, separado para ver qué entra dónde. */
export const JOINT_DRAWING: Partial<Record<JointType, ReactNode>> = {
  tope: (
    <Svg>
      <rect className={P} x="10" y="30" width="62" height="16" />
      <rect className={M} x="72" y="10" width="18" height="52" />
    </Svg>
  ),
  mortaja: (
    <Svg>
      <rect className={P} x="12" y="22" width="44" height="24" />
      <rect className={M} x="56" y="27" width="14" height="14" />
      <rect className={P} x="78" y="6" width="22" height="60" />
      <rect className={H} x="78" y="27" width="14" height="14" />
    </Svg>
  ),
  clavija: (
    <Svg>
      <rect className={P} x="8" y="18" width="40" height="36" />
      <rect className={P} x="72" y="18" width="40" height="36" />
      <rect className={M} x="40" y="25" width="40" height="6" rx="3" />
      <rect className={M} x="40" y="41" width="40" height="6" rx="3" />
    </Svg>
  ),
  canal: (
    <Svg>
      <path className={P} d="M10 40 H54 V50 H66 V40 H110 V62 H10 Z" />
      <rect className={M} x="55" y="6" width="10" height="34" />
      <rect className={H} x="55" y="40" width="10" height="10" />
    </Svg>
  ),
  rebaje: (
    <Svg>
      <path className={P} d="M10 34 H88 V44 H110 V62 H10 Z" />
      <rect className={M} x="88" y="6" width="22" height="28" />
      <rect className={H} x="88" y="34" width="22" height="10" />
    </Svg>
  ),
  'cola-milano': (
    <Svg>
      <path className={P} d="M8 20 H62 V24 L80 20 V34 L62 30 V42 L80 38 V52 L62 48 V52 H8 Z" />
      <rect className={M} x="88" y="12" width="24" height="48" />
      <path className={H} d="M88 24 L106 20 V34 L88 30 M88 42 L106 38 V52 L88 48" />
    </Svg>
  ),
  dedos: (
    <Svg>
      <path className={P} d="M10 22 H72 V30 H60 V38 H72 V46 H60 V54 H10 Z" />
      <path className={M} d="M104 22 V54 H60 V46 H72 V38 H60 V30 H72 V22 Z" transform="translate(14 0)" />
    </Svg>
  ),
  inglete: (
    <Svg>
      <path className={P} d="M10 12 H96 L78 30 H10 Z" />
      <path className={M} d="M102 14 V66 H84 V32 Z" />
    </Svg>
  ),
  'media-madera': (
    <Svg>
      <path className={P} d="M8 30 H50 V38 H70 V30 H112 V50 H8 Z" />
      <rect className={M} x="50" y="10" width="20" height="28" />
      <rect className={H} x="50" y="30" width="20" height="8" />
    </Svg>
  ),
  brida: (
    <Svg>
      <path className={P} d="M8 22 H64 V30 H50 V42 H64 V50 H8 Z" />
      <rect className={M} x="66" y="6" width="22" height="60" />
      <rect className={H} x="50" y="30" width="16" height="12" />
    </Svg>
  ),
  galleta: (
    <Svg>
      <rect className={P} x="8" y="20" width="50" height="32" />
      <rect className={P} x="62" y="20" width="50" height="32" />
      <ellipse className={M} cx="60" cy="36" rx="16" ry="5" />
    </Svg>
  ),
  machiembrado: (
    <Svg>
      <path className={P} d="M8 20 H56 V32 H64 V40 H56 V52 H8 Z" />
      <path className={M} d="M58 20 H112 V52 H58 V40 H66 V32 H58 Z" />
    </Svg>
  ),
  bolsillo: (
    <Svg>
      <rect className={P} x="8" y="36" width="104" height="18" />
      <rect className={M} x="70" y="8" width="18" height="28" />
      <path className={H} d="M40 50 L76 24" />
    </Svg>
  ),
};

export interface Term {
  title: string;
  text: string;
  drawing: ReactNode;
}

/** Palabras del editor y de los cortes que se explican con un "?". */
export const TERMS = {
  cantos: {
    title: tk('Cantos'),
    text: tk('Las aristas de la pieza. Rectos quedan en punta; redondeados, en curva (el radio dice qué tan grande); con chaflán, cortados en diagonal.'),
    drawing: (
      <Svg>
        <rect className={P} x="6" y="20" width="30" height="34" />
        <path className={P} d="M45 20 H65 A10 10 0 0 1 75 30 V54 H45 Z" />
        <path className={P} d="M84 20 H104 L114 30 V54 H84 Z" />
        <path className={H} d="M104 20 H114 V30 Z" />
      </Svg>
    ),
  },
  veta: {
    title: tk('Veta'),
    text: tk('Las fibras de la madera, que corren a lo largo del tronco. La pieza se corta con la veta a lo largo: así es fuerte. Con la veta cruzada (a la derecha), una pieza larga se parte con poco esfuerzo.'),
    drawing: (
      <Svg>
        <rect className={P} x="6" y="26" width="52" height="20" />
        <rect className={M} x="6" y="31" width="52" height="1.6" />
        <rect className={M} x="6" y="37" width="52" height="1.6" />
        <rect className={M} x="6" y="42" width="52" height="1.6" />
        <rect className={P} x="66" y="26" width="52" height="20" />
        <rect className={M} x="74" y="26" width="1.6" height="20" />
        <rect className={M} x="86" y="26" width="1.6" height="20" />
        <rect className={M} x="98" y="26" width="1.6" height="20" />
        <rect className={M} x="110" y="26" width="1.6" height="20" />
      </Svg>
    ),
  },
  vaciados: {
    title: tk('Vaciados y calados'),
    text: tk('Un vaciado saca madera de una cara sin atravesar la pieza, como el hueco de una manija. Un calado la atraviesa de lado a lado y deja un agujero.'),
    drawing: (
      <Svg>
        <path className={P} d="M4 24 H18 V36 H40 V24 H54 V52 H4 Z" />
        <rect className={H} x="18" y="24" width="22" height="12" />
        <path className={P} d="M66 24 H80 V52 H66 Z M102 24 H116 V52 H102 Z" />
        <rect className={H} x="80" y="24" width="22" height="28" />
      </Svg>
    ),
  },
  biseles: {
    title: tk('Biseles, redondeos y cortes en ángulo'),
    text: tk('Un bisel corta una arista o una esquina en ángulo. Si el corte cruza toda la cara, la punta de la pieza queda en ángulo: es un corte en ángulo.'),
    drawing: (
      <Svg>
        <path className={P} d="M8 22 H40 L50 32 V52 H8 Z" />
        <path className={H} d="M40 22 H50 V32 Z" />
        <path className={P} d="M64 22 H96 L112 52 H64 Z" />
        <path className={H} d="M96 22 H112 V52 Z" />
      </Svg>
    ),
  },
  tramos: {
    title: tk('Tramos'),
    text: tk('Un pedazo del largo de la pieza con otra medida: el pie más grueso de una pata o un cuello más fino.'),
    drawing: (
      <Svg>
        <rect className={P} x="53" y="4" width="14" height="44" />
        <rect className={M} x="48" y="48" width="24" height="20" />
      </Svg>
    ),
  },
  torneado: {
    title: tk('Torneado'),
    text: tk('Tornear es dar forma redonda a una pieza mientras gira en el torno. Se parte de un taco cuadrado, que es el que aparece en la lista de cortes.'),
    drawing: (
      <Svg>
        <rect className={P} x="22" y="6" width="20" height="62" />
        <rect className={H} x="78" y="6" width="20" height="62" />
        <path
          className={M}
          d="M80 6 H96 V18 H93 C99 24 99 32 93 36 H91 V50 C96 52 97 60 92 62 V68 H84 V62 C79 60 80 52 85 50 V36 H83 C77 32 77 24 83 18 H80 Z"
        />
      </Svg>
    ),
  },
  componente: {
    title: tk('Componente'),
    text: tk('Si hacés un componente, cada copia de esta pieza cambia junto con las demás: las medidas, la madera y los cantos. Sirve para las cuatro patas de una mesa.'),
    drawing: (
      <Svg>
        <rect className={P} x="20" y="22" width="16" height="44" />
        <rect className={M} x="20" y="10" width="16" height="12" />
        <rect className={P} x="84" y="22" width="16" height="44" />
        <rect className={M} x="84" y="10" width="16" height="12" />
        <path className={H} d="M36 16 H84" />
      </Svg>
    ),
  },
  pie: {
    title: tk('Pie maderero'),
    text: tk('Así se vende la madera en las madereras. Un pie es una tabla de 1 pulgada de espesor, 12 pulgadas de ancho y 1 pie (30,5 cm) de largo.'),
    drawing: (
      <Svg>
        <path className={P} d="M18 32 L60 18 L102 32 L60 46 Z" />
        <path className={M} d="M18 32 V40 L60 54 V46 Z M60 46 V54 L102 40 V32 Z" />
        <text className={styles.dimText} x="30" y="64">30,5 cm</text>
        <text className={styles.dimText} x="80" y="64">30,5 cm</text>
        <text className={styles.dimText} x="106" y="40">1″</text>
      </Svg>
    ),
  },
} satisfies Record<string, Term>;

export type TermId = keyof typeof TERMS;
