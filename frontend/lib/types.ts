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

export type EbayEnvironment = "sandbox" | "production";

export type EbaySettings = {
  environment: EbayEnvironment;
  marketplaceId: "EBAY_IT";
  merchantLocationKey: string;
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  currency: "EUR";
  updatedAt: string;
};

export type EbayStatus = {
  environment: EbayEnvironment;
  credentialsConfigured: boolean;
  missingConfiguration: string[];
  databaseReady: boolean;
  connected: boolean;
  connectedAt: string | null;
  refreshTokenExpiresAt: string | null;
  settings: EbaySettings | null;
};

export type EbayPolicy = {
  name?: string;
  marketplaceId?: string;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
};

export type EbayLocation = {
  merchantLocationKey: string;
  name?: string;
  status?: string;
  location?: {
    address?: {
      city?: string;
      stateOrProvince?: string;
      postalCode?: string;
      country?: string;
    };
  };
};

export type EbayResources = {
  fulfillmentPolicies: EbayPolicy[];
  paymentPolicies: EbayPolicy[];
  returnPolicies: EbayPolicy[];
  locations: EbayLocation[];
};

export type EbayListing = {
  id: string;
  productId: string;
  productTitle: string | null;
  marketplace: "ebay";
  environment: EbayEnvironment;
  sku: string | null;
  offerId: string | null;
  listingId: string | null;
  externalUrl: string | null;
  categoryId: string | null;
  title: string | null;
  price: number | null;
  status: "draft" | "active" | "paused" | "sold" | "error";
  syncStatus: string;
  lastError: string | null;
  metadata: {
    condition?: EbayCondition;
    quantity?: number;
    brand?: string;
    warnings?: unknown[];
  };
  publishedAt: string | null;
  updatedAt: string;
};

export type EbayCondition =
  | "NEW"
  | "LIKE_NEW"
  | "NEW_OTHER"
  | "NEW_WITH_DEFECTS"
  | "CERTIFIED_REFURBISHED"
  | "EXCELLENT_REFURBISHED"
  | "VERY_GOOD_REFURBISHED"
  | "GOOD_REFURBISHED"
  | "USED_EXCELLENT"
  | "USED_VERY_GOOD"
  | "USED_GOOD"
  | "USED_ACCEPTABLE"
  | "FOR_PARTS_OR_NOT_WORKING";

export type EbayPublishPayload = {
  categoryId: string;
  condition: EbayCondition;
  price?: number;
  quantity?: number;
  brand?: string;
  aspects?: Record<string, string[]>;
};

export type SubitoAdapterMode = "manual" | "api";

export type SubitoStatusInfo = {
  mode: SubitoAdapterMode;
  adapterAvailable: boolean;
  databaseReady: boolean;
};

export type SubitoListing = {
  id: string;
  productId: string;
  productTitle: string | null;
  adapterMode: SubitoAdapterMode;
  subitoStatus: "draft" | "active" | "paused" | "sold" | "error";
  subitoListingUrl: string | null;
  subitoListingId: string | null;
  subitoPublishedAt: string | null;
  subitoLastSync: string | null;
  title: string;
  description: string;
  price: number | null;
  location: string;
  photoCount: number;
  lastError: string | null;
  updatedAt: string;
};
