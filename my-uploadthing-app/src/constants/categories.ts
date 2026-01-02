export type CategoryDef = {
  slug: string;
  label: string;
  cover: string;
  desc?: string;
};

export const CATS: CategoryDef[] = [
  { slug: "peliculas",    label: "Películas",    cover: "/peliculas.png",    desc: "Largometrajes y estrenos seleccionados." },
  { slug: "documentales", label: "Documentales", cover: "/documentales.png", desc: "Historias reales con mirada autoral." },
  { slug: "cortos",       label: "Cortos",       cover: "/cortos.png",       desc: "Piezas breves con alto impacto." },
  { slug: "otros",        label: "Otros...",     cover: "/otros.png",        desc: "Videos varios, making of y más." },
];
