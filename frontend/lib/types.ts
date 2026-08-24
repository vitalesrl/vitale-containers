export type MediaAsset = {
  id: string;
  productId: string | null;
  containerId: string | null;
  storageProvider: "local" | "supabase";
  storagePath: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  position: number;
  isPrimary: boolean;
  createdAt: string;
};

export type Product = {
  id: string;
  slug: string;
  title: string;
  size: string;
  type: string;
  condition: string;
  location: string;
  price: number | null;
  vatIncluded: boolean;
  availability: number | null;
  description: string;
  imageUrl?: string | null;
  /** URL esterno/legacy salvato manualmente, separato dalla foto principale della galleria. */
  externalImageUrl?: string | null;
  images?: MediaAsset[];
  lengthM?: number | null;
  widthM?: number | null;
  heightM?: number | null;
  volumeM3?: number | null;
  isPublished?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ContainerStatus = "available" | "reserved" | "sold" | "incoming" | "unavailable";

export type ContainerUnit = {
  id: string;
  productId: string | null;
  productTitle?: string | null;
  containerNumber: string;
  status: ContainerStatus;
  year: number | null;
  manufacturer: string;
  color: string;
  tareKg: number | null;
  cscExpiry: string | null;
  purchasePrice: number | null;
  salePrice: number | null;
  notes: string;
  images?: MediaAsset[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export type Lead = {
  id: string;
  productId: string | null;
  productTitle?: string | null;
  name: string;
  company: string;
  vatNumber: string;
  email: string;
  phone: string;
  destination: string;
  quantity: number;
  transportRequired: boolean;
  message: string;
  status: LeadStatus;
  createdAt: string;
};

export type AdminStats = {
  products: number;
  availableUnits: number | null;
  reservedUnits: number;
  leads: number;
  activeListings: number;
};
