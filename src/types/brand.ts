export type WorkMode = "campaign" | "asset" | "calendar";
export type AspectRatioOption = "1:1" | "4:3" | "3:4" | "16:9" | "9:16" | "4:1" | "1:4";
export type ImageResolutionOption = "1K" | "2K" | "4K";
export type HumanPresenceMode = "product_only" | "hands_only" | "character_in_scene";
export type ScheduledPostStatus = "drafted" | "ready" | "posted";
export type CalendarViewMode = "month" | "week";

export interface BrandPreset {
  id: string;
  presetName: string;
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  goldColor: string;
  headingFont: string;
  bodyFont: string;
}

export interface CanonicalProductSpec {
  canonicalObjectDescription: string;
  silhouetteLock: string;
  surfaceMaterials: string;
  labelTypographySpec: string;
  lightingSignature: string;
}

export type MediumCategory = "marketplace" | "social" | "hero";

export interface MediumDefinition {
  id: string;
  slug: string;
  title: string;
  category: MediumCategory;
  categoryLabel: string;
  aspectRatio: AspectRatioOption;
  targetWidth: number;
  targetHeight: number;
  dimensionsLabel: string;
  description: string;
  promptTemplate: string;
  defaultEnabled: boolean;
}

export interface GeneratedMediumShot {
  mediumId: string;
  status: "idle" | "generating" | "completed" | "error";
  imageUrl?: string;
  promptUsed?: string;
  error?: string;
  customSceneNote?: string;
  updatedAt?: string;
  exactWidth?: number;
  exactHeight?: number;
}

export interface BrandBrief {
  brandName: string;
  productName: string;
  productDescription: string;
  tagline: string;
  aestheticStyle: string;
  colorPalette: string;
  humanPresenceMode: HumanPresenceMode;
  imageSize: ImageResolutionOption;
  uploadedReferenceDataUrl?: string;
  characterReferenceDataUrl?: string;
}

export interface ResearchedHashtag {
  tag: string;
  countText: string;
  verified: boolean;
}

export interface SearchSourceLink {
  title: string;
  uri: string;
}

export interface AssistantChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp?: string;
  modelUsed?: string;
}

export interface AssetCopyDraft {
  socialCaption: string;
  pinterestTitle: string;
  pinterestDescription: string;
  hashtags?: ResearchedHashtag[];
  aiDisclosureNote?: string;
  modelUsed?: string;
  searchSources?: SearchSourceLink[];
}

export interface SavedProductListing {
  id: string;
  label: string;
  brief: BrandBrief;
  canonicalSpec: CanonicalProductSpec;
  savedAnchorUrl: string;
  defaultCopy: AssetCopyDraft;
}

export interface ScheduledPost {
  id: string;
  date: string; // YYYY-MM-DD
  platform: string; // e.g., "Instagram Portrait", "Pinterest Pin", "Etsy Listing", "Square", "TikTok Cover"
  mediumId: string; // e.g., "instagram_portrait", "pinterest_pin", "etsy_listing", "square", "tiktok_reel_cover"
  productId: string;
  productName: string;
  shortNote: string;
  status: ScheduledPostStatus;
  copyDraft: AssetCopyDraft;
}
