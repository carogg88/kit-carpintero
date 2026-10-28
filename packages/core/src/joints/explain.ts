import { t, tk } from '../i18n';
import type { JointType } from '../project';
import { FLOATING_HOLDS, holdOf, type Hold } from './hold';
import { isBreadboard } from './fine';
import { tenonStyle, type TenonStyle } from './mortise';
import { jointName } from './index';

/**
 * Una unión explicada como en un libro de ebanistería: el nombre completo con su variante, para qué sirve y qué
 * cuidar al hacerla. Va en la hoja de encastres del plano y en la pantalla de Uniones.
 */

type Params = Record<string, number>;
interface JointLike {
  type: JointType;
  params: Params;
}

/** La forma de trabar la espiga, dicha después del nombre: "Mortaja y espiga, pasante con cuñas". */
const STYLE_WORDS: Record<TenonStyle, string> = {
  ciega: tk('ciega'),
  pasante: tk('pasante'),
  cunas: tk('pasante con cuñas'),
  'ciega-cunas': tk('ciega con cuñas'),
  tarugada: tk('tarugada'),
  llave: tk('pasante con llave'),
};

const HOLD_WORDS: Partial<Record<Hold, string>> = {
  cola: tk('encolada'),
  tornillos: tk('con tornillos fijos'),
  botones: tk('con botones de madera'),
  ovalados: tk('con tornillos en agujero ovalado'),
  grampas: tk('con grampas en 8'),
};

/** Lo que se dice después del nombre, en partes: "doble", "pasante con cuñas", "con media caja". */
function variantWords(j: JointLike, crossing: boolean): string[] {
  const p = j.params;
  switch (j.type) {
    case 'mortaja':
      return [
        ...((p.count ?? 1) > 1 ? [t('doble')] : []),
        t(STYLE_WORDS[tenonStyle(p)]),
        ...((p.haunch ?? 0) > 0 ? [t('con media caja')] : []),
      ];
    case 'tope': {
      const words = crossing ? undefined : HOLD_WORDS[holdOf(p)];
      return words ? [t(words)] : [];
    }
    case 'canal':
      return (p.play ?? 0) > 0 ? [t('panel flotante con {play} mm de juego', { play: p.play! })] : [];
    case 'machiembrado':
      return isBreadboard(p) ? [t('testero con {n} tarugos', { n: Math.round(p.pegs!) })] : [];
    case 'cola-milano':
      return p.count ? [t(p.count === 1 ? tk('{n} cola') : tk('{n} colas'), { n: p.count }), `1:${p.slope ?? 8}`] : [];
    case 'dedos':
      return p.count ? [t('{n} dedos', { n: p.count })] : [];
    case 'clavija':
      return p.count ? [t('{n} de {d} mm', { n: p.count, d: p.diameter ?? 8 })] : [];
    case 'galleta':
      return p.count ? [t('{n} del {size}', { n: p.count, size: p.size ?? 20 })] : [];
    case 'bolsillo':
      return p.count ? [t(p.count === 1 ? tk('{n} tornillo') : tk('{n} tornillos'), { n: p.count })] : [];
    default:
      return [];
  }
}

/** Nombre completo, ya traducido: "Mortaja y espiga, doble, pasante con cuñas". */
export function jointFullName(j: JointLike, crossing = false): string {
  const name = t(jointName(j.type, crossing));
  const words = variantWords(j, crossing);
  return words.length ? t('{joint}, {variant}', { joint: name, variant: words.join(', ') }) : name;
}

const PURPOSE: Record<JointType, string> = {
  tope: tk('Apoya una pieza sobre otra, sin cortes.'),
  mortaja: tk('Une patas y faldones: fuerte, y la espiga queda escondida.'),
  'media-madera': tk('Cruza dos piezas y las deja al ras.'),
  canal: tk('Aloja un fondo o un panel sin tornillos.'),
  rebaje: tk('Esconde el canto del fondo y le da donde apoyar.'),
  clavija: tk('Alinea y une las piezas con tarugos encolados.'),
  'cola-milano': tk('No se abre tirando: el cajón aguanta años de uso.'),
  dedos: tk('Mucha superficie para la cola en la esquina de una caja.'),
  brida: tk('Esquina de marco fuerte y fácil de cortar.'),
  inglete: tk('La veta da la vuelta a la esquina sin mostrar la testa.'),
  galleta: tk('Alinea tablas o placas mientras se encolan.'),
  machiembrado: tk('Une tablas de canto y deja las caras alineadas.'),
  bolsillo: tk('Unión rápida, con los tornillos escondidos y sin prensas.'),
};

const STYLE_PURPOSE: Partial<Record<TenonStyle, string>> = {
  pasante: tk('Une patas y faldones; la espiga se ve del otro lado y queda de adorno.'),
  cunas: tk('Las cuñas abren la espiga contra la mortaja: queda trabada aunque falle la cola.'),
  'ciega-cunas': tk('Trabada desde adentro con cuñas: no se ve y no se desarma.'),
  tarugada: tk('El tarugo cierra la unión y la traba aunque falle la cola.'),
  llave: tk('Se arma y se desarma sacando la llave, sin cola.'),
};

/** Para qué sirve, en una frase. */
export function jointPurpose(j: JointLike, crossing = false): string {
  const p = j.params;
  if (j.type === 'tope') {
    if (crossing) return t('La pieza apoya en una muesca y no se corre.');
    const hold = holdOf(p);
    if (FLOATING_HOLDS.has(hold)) return t('Sujeta la tapa contra el faldón y la deja moverse con la humedad.');
    if (hold === 'cola' || hold === 'tornillos') return t('Fija una pieza a la otra. Solo para piezas angostas o de placa.');
  }
  if (j.type === 'mortaja') {
    const s = STYLE_PURPOSE[tenonStyle(p)];
    if (s) return t(s);
  }
  if (j.type === 'canal' && (p.play ?? 0) > 0) return t('El panel queda libre para hincharse con la humedad sin abrir el marco.');
  if (j.type === 'machiembrado' && isBreadboard(p)) return t('Tapa la testa y mantiene la tapa plana, dejándola moverse a lo ancho.');
  return t(PURPOSE[j.type]);
}

const CARE: Partial<Record<JointType, string>> = {
  'media-madera': tk('Cortá un poco justo y ajustá con formón hasta que entre a mano.'),
  canal: tk('Medí el espesor real del fondo o del panel antes de cortar la canal.'),
  rebaje: tk('Medí el espesor real del fondo antes de rebajar.'),
  clavija: tk('Marcá los agujeros de las dos piezas juntos, con la plantilla, para que coincidan.'),
  'cola-milano': tk('Marcá la otra pieza con cuchilla siguiendo las colas ya cortadas, no con regla.'),
  dedos: tk('Probá en un retazo: medio milímetro de más y no entra.'),
  brida: tk('Probá el ajuste en seco: la horquilla abraza sin forzar ni bailar.'),
  inglete: tk('Probá el ángulo en dos retazos: un grado de error se ve en la esquina.'),
  galleta: tk('Encolá y prensá rápido: la galleta se hincha con la cola.'),
  machiembrado: tk('Dejá aire al fondo de la canal para la cola.'),
  bolsillo: tk('Prensá las piezas al atornillar: si no, se corren.'),
};

const STYLE_CARE: Record<TenonStyle, string> = {
  ciega: tk('La mortaja 2 mm más honda que la espiga: lugar para la cola sobrante.'),
  pasante: tk('Escoplá la mortaja desde las dos caras, así no se astilla al salir.'),
  cunas: tk('Las cuñas, cruzadas a la veta de la pata: si van con la veta, la rajan.'),
  'ciega-cunas': tk('Presentala en seco sin cuñas: con las cuñas puestas ya no sale.'),
  tarugada: tk('El agujero de la espiga va 1,5 mm corrido hacia el hombro.'),
  llave: tk('La llave va sin cola: es lo que deja desarmarla.'),
};

/** Qué cuidar al hacerla, en una frase. Vacío si no hay nada especial (a tope apoyada sin más). */
export function jointCare(j: JointLike, crossing = false): string {
  const p = j.params;
  switch (j.type) {
    case 'tope': {
      if (crossing) return t('La muesca justa: que la pieza entre sin forzar y no baile.');
      const hold = holdOf(p);
      if (FLOATING_HOLDS.has(hold)) return t('Sin cola entre la tapa y el faldón.');
      if (hold === 'cola' || hold === 'tornillos') return t('Si la pieza es maciza y ancha, se raja: usá botones o grampas en 8.');
      return '';
    }
    case 'mortaja':
      return t(STYLE_CARE[tenonStyle(p)]);
    case 'canal':
      if ((p.play ?? 0) > 0) return t('Sin cola en el panel: flota con {play} mm de juego de cada lado.', { play: p.play! });
      break;
    case 'machiembrado':
      if (isBreadboard(p)) return t('Cola solo en el centro y en el tarugo del medio; los de las puntas van sin cola.');
      break;
  }
  const c = CARE[j.type];
  return c ? t(c) : '';
}
