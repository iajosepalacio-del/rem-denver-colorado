export const EVENT_ID = "rem-denver-2027";

export const DEFAULT_SHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Otra / Por confirmar"];
export const DEFAULT_JACKET_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Otra / Por confirmar"];

export type PackingGroup = "ropa" | "accesorios" | "documentos" | "evento";

export type PackingItem = {
  key: string;
  group: PackingGroup;
  es: string;
  en: string;
};

export const DEFAULT_PACKING: PackingItem[] = [
  { key: "chaqueta", group: "ropa", es: "Chaqueta de invierno impermeable y aislante.", en: "Waterproof insulated winter jacket." },
  { key: "camisetas", group: "ropa", es: "Camisetas térmicas.", en: "Thermal shirts." },
  { key: "pantalones_termicos", group: "ropa", es: "Pantalones térmicos.", en: "Thermal pants." },
  { key: "pantalon_nieve", group: "ropa", es: "Pantalón impermeable para nieve.", en: "Waterproof snow pants." },
  { key: "capa_intermedia", group: "ropa", es: "Suéter o capa intermedia cálida.", en: "Sweater or warm mid-layer." },
  { key: "botas", group: "ropa", es: "Botas impermeables con buen agarre.", en: "Waterproof boots with good grip." },
  { key: "medias", group: "ropa", es: "Medias térmicas.", en: "Thermal socks." },
  { key: "guantes", group: "ropa", es: "Guantes impermeables.", en: "Waterproof gloves." },
  { key: "gorro", group: "ropa", es: "Gorro de invierno.", en: "Winter hat." },
  { key: "bufanda", group: "ropa", es: "Bufanda o cuello térmico.", en: "Scarf or neck gaiter." },
  { key: "ropa_interior", group: "ropa", es: "Ropa interior y prendas de cambio.", en: "Underwear and a change of clothes." },
  { key: "gafas", group: "accesorios", es: "Gafas de sol con protección UV.", en: "UV-protection sunglasses." },
  { key: "protector_solar", group: "accesorios", es: "Protector solar.", en: "Sunscreen." },
  { key: "protector_labial", group: "accesorios", es: "Protector labial.", en: "Lip balm." },
  { key: "crema", group: "accesorios", es: "Crema hidratante.", en: "Moisturizer." },
  { key: "medicamentos", group: "accesorios", es: "Medicamentos personales.", en: "Personal medication." },
  { key: "higiene", group: "accesorios", es: "Artículos de higiene.", en: "Toiletries." },
  { key: "cargadores", group: "accesorios", es: "Cargadores de dispositivos.", en: "Device chargers." },
  { key: "identificacion", group: "documentos", es: "Identificación.", en: "Identification." },
  { key: "documentacion_viaje", group: "documentos", es: "Documentación necesaria para el viaje.", en: "Documents required for the trip." },
  { key: "reservas", group: "documentos", es: "Reservas y transporte, cuando aplique.", en: "Reservations and transport, when applicable." },
  { key: "info_evento", group: "documentos", es: "Información del evento.", en: "Event information." },
  { key: "contacto_emergencia", group: "documentos", es: "Contacto de emergencia.", en: "Emergency contact." },
  { key: "camiseta_rem", group: "evento", es: "Camiseta REM.", en: "REM t-shirt." },
  { key: "chaqueta_rem", group: "evento", es: "Chaqueta REM, si se entrega.", en: "REM jacket, if provided." },
  { key: "material_org", group: "evento", es: "Material solicitado por la organización.", en: "Materials requested by the organizers." },
];

export const CALLING_CODES = [
  "+1",
  "+52",
  "+57",
  "+51",
  "+56",
  "+54",
  "+58",
  "+593",
  "+591",
  "+595",
  "+598",
  "+507",
  "+506",
  "+503",
  "+502",
  "+504",
  "+505",
  "+53",
  "+34",
  "+55",
  "+351",
  "+44",
  "+49",
  "+33",
  "+39",
];

export const COUNTRIES = [
  "Colombia",
  "México",
  "Estados Unidos",
  "Perú",
  "Chile",
  "Argentina",
  "Ecuador",
  "Venezuela",
  "Bolivia",
  "Paraguay",
  "Uruguay",
  "Panamá",
  "Costa Rica",
  "Guatemala",
  "El Salvador",
  "Honduras",
  "Nicaragua",
  "República Dominicana",
  "Puerto Rico",
  "Cuba",
  "España",
  "Brasil",
  "Canadá",
  "Otro",
];

export const PAYMENT_METHODS = ["transferencia", "efectivo", "otro"] as const;

export const OFFICIAL_SEMAFORO_URL = "https://matrimoniosrem.com/semaforo-rem-paso-1/";
export const OFFICIAL_SITE = "https://matrimoniosrem.com";
export const ORGANIZER_EMAIL = "remdenvercolorado@gmail.com";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
