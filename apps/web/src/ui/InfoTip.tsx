import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { t } from "@kitc/core";
import styles from "./InfoTip.module.css";

/**
 * Ícono (i) que muestra una explicación al pasar el mouse, al llegar con el teclado o al tocarlo en el celular.
 * Sirve adentro de una etiqueta o un botón: el toque no los activa.
 */
export function InfoTip({
  label,
  children,
  align = "start",
  side = "bottom",
  wide,
  card,
}: {
  label: string;
  children: ReactNode;
  align?: "start" | "end";
  /** Arriba cuando abajo queda poco lugar (al pie de un panel con scroll). */
  side?: "top" | "bottom";
  wide?: boolean;
  /** Clara y con borde: para una explicación con dibujo, no solo texto. */
  card?: boolean;
}) {
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!pinned) return;
    const away = (e: PointerEvent) =>
      !ref.current?.contains(e.target as Node) && setPinned(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPinned(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [pinned]);
  return (
    <span
      ref={ref}
      className={styles.wrap}
      data-pinned={pinned || undefined}
      data-align={align}
      data-side={side}
      data-wide={wide || undefined}
      data-card={card || undefined}
    >
      <button
        type="button"
        className={styles.icon}
        aria-label={t("Más información: {what}", { what: label })}
        aria-describedby={id}
        aria-expanded={pinned}
        onClick={(e) => {
          // Adentro de una etiqueta, el toque no tiene que elegir la opción.
          e.preventDefault();
          e.stopPropagation();
          setPinned(!pinned);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5.5M12 7.6v.4" />
        </svg>
      </button>
      {/* Un toque en la explicación tampoco elige la opción de la etiqueta. */}
      <span
        id={id}
        role="tooltip"
        className={styles.tip}
        onClick={(e) => e.preventDefault()}
      >
        {children}
      </span>
    </span>
  );
}
