export type SubitoAdapterMode = "manual" | "api";

export type SubitoProductSource = {
  title?: unknown;
  size?: unknown;
  type?: unknown;
  condition?: unknown;
  location?: unknown;
  description?: unknown;
  price?: unknown;
  vat_included?: unknown;
  availability?: unknown;
  length_m?: unknown;
  width_m?: unknown;
  height_m?: unknown;
  volume_m3?: unknown;
};

export type PreparedSubitoListing = {
  title: string;
  description: string;
  price: number | null;
  location: string;
  photoUrls: string[];
};

export interface SubitoAdapter {
  readonly mode: SubitoAdapterMode;
  prepare(product: SubitoProductSource, photoUrls: string[]): PreparedSubitoListing;
}

function text(value: unknown, maxLength = 500) {
  return String(value ?? "").replace(/\0/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function numeric(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decimal(value: unknown) {
  const number = numeric(value);
  if (number === null) return "";
  return number.toLocaleString("it-IT", { maximumFractionDigits: 2 });
}

class ManualSubitoAdapter implements SubitoAdapter {
  readonly mode = "manual" as const;

  prepare(product: SubitoProductSource, photoUrls: string[]): PreparedSubitoListing {
    const sourceTitle = text(product.title, 80);
    const condition = text(product.condition, 60);
    const size = text(product.size, 60);
    const type = text(product.type, 80);
    const location = text(product.location, 100) || "Salerno";

    let title = /^container\b/i.test(sourceTitle)
      ? sourceTitle
      : `Container marittimo ${sourceTitle || [size, type].filter(Boolean).join(" ")}`;
    if (condition && !title.toLocaleLowerCase("it-IT").includes(condition.toLocaleLowerCase("it-IT"))) {
      title = `${title} ${condition.toLocaleLowerCase("it-IT")}`;
    }
    title = text(title, 70);

    const intro = [
      "Container marittimo",
      size,
      type,
      condition ? condition.toLocaleLowerCase("it-IT") : ""
    ].filter(Boolean).join(" ");
    const customDescription = text(product.description, 1800);
    const dimensions = [product.length_m, product.width_m, product.height_m]
      .map(decimal)
      .filter(Boolean);
    const availability = numeric(product.availability);
    const availabilityText = availability === null
      ? "Disponibilità su richiesta."
      : availability > 1
        ? `Disponibilità immediata: ${availability} unità.`
        : availability === 1
          ? "Disponibilità immediata."
          : "Disponibilità da verificare.";

    const blocks = [
      `${intro},\ndisponibile presso ${location}.`,
      customDescription && !intro.toLocaleLowerCase("it-IT").includes(customDescription.toLocaleLowerCase("it-IT"))
        ? customDescription
        : "",
      dimensions.length === 3
        ? `Dimensioni esterne:\n${dimensions.join(" x ")} m`
        : "",
      decimal(product.volume_m3) ? `Volume indicativo: ${decimal(product.volume_m3)} m³` : "",
      condition ? `Condizioni: ${condition}` : "",
      type ? `Tipologia: ${type}` : "",
      availabilityText,
      "Possibilità di trasporto su richiesta."
    ].filter(Boolean);

    return {
      title,
      description: blocks.join("\n\n").slice(0, 4000),
      price: numeric(product.price),
      location,
      photoUrls: Array.from(new Set(photoUrls)).slice(0, 30)
    };
  }
}

const manualAdapter = new ManualSubitoAdapter();

export function getSubitoAdapterMode(): SubitoAdapterMode {
  return process.env.SUBITO_ADAPTER_MODE?.toLowerCase() === "api" ? "api" : "manual";
}

export function getSubitoAdapter(): SubitoAdapter {
  if (getSubitoAdapterMode() === "api") {
    throw new Error(
      "SubitoAdapter API non è ancora disponibile: imposta SUBITO_ADAPTER_MODE=manual."
    );
  }
  return manualAdapter;
}
