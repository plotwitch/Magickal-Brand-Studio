import {
  AssetCopyDraft,
  BrandBrief,
  BrandPreset,
  CanonicalProductSpec,
  GeneratedMediumShot,
  MediumDefinition,
  SavedProductListing,
  ScheduledPost,
} from "../types/brand";

export const DEFAULT_PLOT_WITCH_PRESET: BrandPreset = {
  id: "plot-witch-default",
  presetName: "Plot Witch Default",
  brandName: "The Plot Witch",
  primaryColor: "#2A1442", // Deep Plum
  secondaryColor: "#00E5CC", // Vibrant Teal
  accentColor: "#EB238E", // Sassy Magenta
  goldColor: "#D4AF37", // Gold
  headingFont: "Cinzel",
  bodyFont: "Plus Jakarta Sans",
};

export const BUILTIN_BRAND_PRESETS: BrandPreset[] = [
  DEFAULT_PLOT_WITCH_PRESET,
  {
    id: "dark-studio",
    presetName: "Dark Studio",
    brandName: "The Plot Witch",
    primaryColor: "#1F0D3D",
    secondaryColor: "#00F5D4",
    accentColor: "#FF2A85",
    goldColor: "#E5C158",
    headingFont: "Cormorant Garamond",
    bodyFont: "Plus Jakarta Sans",
  },
  {
    id: "archive",
    presetName: "Archive",
    brandName: "The Plot Witch",
    primaryColor: "#190A28",
    secondaryColor: "#14B8A6",
    accentColor: "#D91B7A",
    goldColor: "#F3D36B",
    headingFont: "Fraunces",
    bodyFont: "Plus Jakarta Sans",
  },
];

export const WEEKLY_ASSET_MEDIUM_IDS: string[] = [
  "etsy_listing",
  "instagram_portrait",
  "square",
  "tiktok_reel_cover",
  "pinterest_pin",
];

export const CAMPAIGN_MEDIUMS: MediumDefinition[] = [
  {
    id: "etsy_listing",
    slug: "etsy_listing",
    title: "Etsy Listing",
    category: "marketplace",
    categoryLabel: "Etsy · 4:3",
    aspectRatio: "4:3",
    targetWidth: 2700,
    targetHeight: 2025,
    dimensionsLabel: "2700×2025 px",
    description: "High-resolution 2700×2025 horizontal product listing photo.",
    promptTemplate:
      "High-resolution Etsy product listing studio photograph (4:3 composition for 2700x2025) of the exact product arranged as the clear centerpiece on a dark midnight velvet and slate studio desk, surrounded by subtle brass desk tools, glowing teal circuit-etched tarot accents, and warm gold and magenta rim light.",
    defaultEnabled: true,
  },
  {
    id: "instagram_portrait",
    slug: "instagram_portrait",
    title: "Instagram Portrait",
    category: "social",
    categoryLabel: "Instagram · 4:5",
    aspectRatio: "3:4",
    targetWidth: 1080,
    targetHeight: 1350,
    dimensionsLabel: "1080×1350 px",
    description: "Vertical 1080×1350 portrait photo sized for Instagram feeds.",
    promptTemplate:
      "Vertical editorial Instagram portrait photograph (1080x1350 composition) of the exact product propped on a brass and dark wood stand on a dark studio desk at night, subtle glowing vibrant teal geometric lines in the background and magenta ambient rim lighting.",
    defaultEnabled: true,
  },
  {
    id: "square",
    slug: "square",
    title: "Square",
    category: "social",
    categoryLabel: "Square · 1:1",
    aspectRatio: "1:1",
    targetWidth: 1080,
    targetHeight: 1080,
    dimensionsLabel: "1080×1080 px",
    description: "Centered 1080×1080 square product image for catalog and social grids.",
    promptTemplate:
      "Centered square 1:1 commercial studio photograph (1080x1080 composition) of the exact product resting on a dark plum and slate surface with delicate gold circuitry traces, dark quartz crystals, and balanced teal and magenta studio lighting.",
    defaultEnabled: true,
  },
  {
    id: "tiktok_reel_cover",
    slug: "tiktok_reel_cover",
    title: "TikTok Cover",
    category: "social",
    categoryLabel: "Vertical · 9:16",
    aspectRatio: "9:16",
    targetWidth: 1080,
    targetHeight: 1920,
    dimensionsLabel: "1080×1920 px",
    description: "Full-screen 1080×1920 vertical video cover with space for titles.",
    promptTemplate:
      "Full-screen vertical 9:16 TikTok and Reel cover photograph (1080x1920 composition) featuring the exact product in the central safe zone on a dark studio desk at night, vertical beams of vibrant teal and magenta light with gold accents and clean space at top and bottom.",
    defaultEnabled: true,
  },
  {
    id: "pinterest_pin",
    slug: "pinterest_pin",
    title: "Pinterest Pin",
    category: "marketplace",
    categoryLabel: "Pinterest · 2:3",
    aspectRatio: "3:4",
    targetWidth: 1000,
    targetHeight: 1500,
    dimensionsLabel: "1000×1500 px",
    description: "Vertical 1000×1500 pin layout designed for product discovery.",
    promptTemplate:
      "Editorial 2:3 vertical Pinterest Pin photograph (1000x1500 composition) showcasing the exact product on a dark writer's studio desk with brass candleholders, circuit-tarot cards, deep plum shadows, and warm gold highlights.",
    defaultEnabled: true,
  },
  {
    id: "hero_shot",
    slug: "hero_shot",
    title: "Hero Shot",
    category: "hero",
    categoryLabel: "Widescreen · 16:9",
    aspectRatio: "16:9",
    targetWidth: 1920,
    targetHeight: 1080,
    dimensionsLabel: "1920×1080 px",
    description: "Widescreen 1920×1080 banner image for website headers and launches.",
    promptTemplate:
      "Cinematic widescreen 16:9 hero banner photograph (1920x1080 composition) of the exact product centered on a dark slate studio desk etched with glowing gold circuitry traces, flanked by dark crystals and deep plum, vibrant teal, and magenta studio lighting.",
    defaultEnabled: true,
  },
];

export const INITIAL_SHOWCASE_BRIEF: BrandBrief = {
  brandName: "The Plot Witch",
  productName: "Hardcover Journal",
  productDescription:
    "A matte deep-plum leather hardcover writer's journal embossed with gold foil tarot-and-circuitry geometry reading 'THE PLOT WITCH', paired with a hexagonal brushed gold pen.",
  tagline: "STORY PLANNING AND DIGITAL TOOLS",
  aestheticStyle: "Modern Tech-Witch Studio Desk at Night",
  colorPalette: "Deep Plum · Vibrant Teal · Sassy Magenta · Gold · Night Black",
  humanPresenceMode: "product_only",
  imageSize: "1K",
};

export const INITIAL_CANONICAL_SPEC: CanonicalProductSpec = {
  canonicalObjectDescription:
    "Matte deep-plum leather hardcover writer's journal with gilded page edges, brass clasp, and gold-foil tarot-and-circuitry embossing reading 'THE PLOT WITCH', paired with a hexagonal brushed-gold pen.",
  silhouetteLock:
    "Hardcover leather journal with brass clasp · Hexagonal brushed-gold pen alongside",
  surfaceMaterials:
    "Pebbled deep-plum leather · Gold foil stamping · Gilded paper edges · Brushed solid brass",
  labelTypographySpec:
    "Gold-foil serif title 'THE PLOT WITCH' centered above tarot-circuitry medallion",
  lightingSignature:
    "Night studio desk lighting with vibrant teal and magenta rim lights and warm gold reflections",
};

export const INITIAL_ANCHOR_IMAGE = "/src/assets/images/plotwitch_master_journal.jpg";

export const VOICE_GUIDE_ASSET_URL =
  "/assets/aistudio/Tasha-Driver-Informative-Voice-Guide_24f0a969";

export const OFFICIAL_PLOT_WITCH_VOICE_GUIDE_TEXT = `TASHA L. DRIVER / INFORMATIVE VOICE (Source-based reassessment • 8 October 2026)
• Core Stance: Practical, opinionated, conversational, and mischievous. Write as a working writer explaining something she has had to figure out because other writers keep running into the same problem.
• Recalibration: Lead with useful explanation. Let attitude emerge naturally from the subject without sounding hostile or jaded. Keep the slightly witchy Plot Witch identity light and grounded in real craft—don't turn every writing task into a spell or potion.
• Paragraph & Sentence Shape: Build developed prose paragraphs around a complete thought (no choppy succession of one-sentence paragraphs). Use natural contractions, direct address ("you" for the reader's actions, "I" for Tasha's own practice/judgment), and occasional earned parenthetical asides.
• How Explanation Develops: Begin with a recognizable problem, define terms plainly, connect advice to its real consequence on the page, give a concrete demonstration (down to index cards, divider tabs, and where the outline sits), include relevant exceptions, and finish with a usable next step.`;

export const INITIAL_COPY_DRAFT: AssetCopyDraft = {
  socialCaption:
    "If you have ever lost an entire evening looking for the scrap of paper where you fixed your Act II timeline, you already know why loose notes become a trap (and why the distraction fairies love a messy desk). I set up the Hardcover Journal with structured scene spreads and a brass clasp so your chapter outline, character motives, and continuity notes stay in one place when you sit down to draft. Open to the current chapter tab, write the next three scene beats before checking your phone, and see how much faster the pages move.\n\n#writingprompts #bookishfeatures #novelwriting\n\nAI Content Note: Product scene visual generated with AI from our studio master image.",
  hashtags: [
    {
      tag: "#writingprompts",
      countText: "1,240,000 posts (verified in 850k–1.5M range)",
      verified: true,
    },
    {
      tag: "#bookishfeatures",
      countText: "980,000 posts (verified in 850k–1.5M range)",
      verified: true,
    },
    {
      tag: "#novelwriting",
      countText: "Count not verified in search results",
      verified: false,
    },
  ],
  aiDisclosureNote:
    "AI Content Note: Product scene visual generated with AI from our studio master image.",
  pinterestTitle: "The Plot Witch Hardcover Writer's Journal & Brass Pen",
  pinterestDescription:
    "Keep your chapter outline, character cards, and scene beats in one place instead of scattered across twenty tabs. The Plot Witch Hardcover Journal pairs deep-plum leather and gold-foil tarot circuitry with a weighted brass pen for practical novel planning.",
};

export const INITIAL_MEDIUM_SHOTS: Record<string, GeneratedMediumShot> = {
  etsy_listing: {
    mediumId: "etsy_listing",
    status: "completed",
    imageUrl: "/src/assets/images/plotwitch_etsy_listing_1794064898448.jpg",
    promptUsed:
      "Overhead flat-lay Etsy product listing photography (2700x2025) of The Plot Witch Hardcover Journal and hexagonal brushed gold pen on dark velvet with brass calipers and teal circuit tarot cards.",
    updatedAt: "2700×2025 px",
    exactWidth: 2700,
    exactHeight: 2025,
  },
  instagram_portrait: {
    mediumId: "instagram_portrait",
    status: "completed",
    imageUrl: "/src/assets/images/plotwitch_insta_portrait_1794064900503.jpg",
    promptUsed:
      "Vertical Instagram portrait product photograph (1080x1350) of The Plot Witch Hardcover Journal propped on an ornate brass stand on a studio desk at night.",
    updatedAt: "1080×1350 px",
    exactWidth: 1080,
    exactHeight: 1350,
  },
  square: {
    mediumId: "square",
    status: "completed",
    imageUrl: "/src/assets/images/plotwitch_master_journal.jpg",
    promptUsed:
      "Square 1080x1080 studio photo of The Plot Witch Hardcover Journal and brushed gold pen on dark slate.",
    updatedAt: "1080×1080 px",
    exactWidth: 1080,
    exactHeight: 1080,
  },
  tiktok_reel_cover: {
    mediumId: "tiktok_reel_cover",
    status: "idle",
  },
  pinterest_pin: {
    mediumId: "pinterest_pin",
    status: "idle",
  },
  hero_shot: {
    mediumId: "hero_shot",
    status: "completed",
    imageUrl: "/src/assets/images/plotwitch_hero_shot_1794064900438.jpg",
    promptUsed:
      "Widescreen 1920x1080 hero shot of The Plot Witch Hardcover Journal and gold pen on a dark slate desk etched with gold circuitry traces.",
    updatedAt: "1920×1080 px",
    exactWidth: 1920,
    exactHeight: 1080,
  },
};

export interface ProductBriefTemplate {
  id: string;
  label: string;
  brief: BrandBrief;
}

export const PRODUCT_BRIEF_TEMPLATES: ProductBriefTemplate[] = [
  {
    id: "plot-witch-default",
    label: "Plot Witch Default",
    brief: INITIAL_SHOWCASE_BRIEF,
  },
  {
    id: "dark-studio",
    label: "Dark Studio",
    brief: {
      brandName: "The Plot Witch",
      productName: "Tarot Card Deck",
      productDescription:
        "A matte black-plum magnetic keepsake box with gold-foil circuitry edges and glowing teal foil title 'THE PLOT WITCH', beside three fanned black-core cards featuring gold circuit traces and crescent moons.",
      tagline: "STORY STRUCTURE CARD DECK",
      aestheticStyle: "Night Studio Desk · Warm Gold & Teal Lighting",
      colorPalette: "Deep Plum · Vibrant Teal · Sassy Magenta · Gold",
      humanPresenceMode: "product_only",
      imageSize: "1K",
    },
  },
  {
    id: "archive",
    label: "Archive",
    brief: {
      brandName: "The Plot Witch",
      productName: "Macro Keypad",
      productDescription:
        "A machined deep-plum aluminum 12-key mechanical writer's keypad with translucent dark keycaps, gold-engraved icons, a solid brass rotary dial, and teal and magenta underglow.",
      tagline: "CUSTOM WRITER KEYPAD",
      aestheticStyle: "Dark Studio Desk at Night",
      colorPalette: "Deep Plum · Brushed Brass · Vibrant Teal · Sassy Magenta",
      humanPresenceMode: "hands_only",
      imageSize: "1K",
    },
  },
];

export const INITIAL_SAVED_LISTINGS: SavedProductListing[] = [
  {
    id: "plot-witch-default",
    label: "Hardcover Journal (Plot Witch Default)",
    brief: INITIAL_SHOWCASE_BRIEF,
    canonicalSpec: INITIAL_CANONICAL_SPEC,
    savedAnchorUrl: INITIAL_ANCHOR_IMAGE,
    defaultCopy: INITIAL_COPY_DRAFT,
  },
  {
    id: "dark-studio",
    label: "Tarot Card Deck (Dark Studio)",
    brief: PRODUCT_BRIEF_TEMPLATES[1].brief,
    canonicalSpec: {
      canonicalObjectDescription:
        "Matte black-plum magnetic keepsake box with gold-foil circuitry edges and glowing teal foil title 'THE PLOT WITCH', beside three fanned black-core cards featuring gold circuit traces and crescent moons.",
      silhouetteLock: "Rigid two-piece keepsake box with three fanned cards alongside",
      surfaceMaterials: "Matte black-plum board · Gold and teal foil stamping · Black-core card stock",
      labelTypographySpec: "Teal and gold serif title 'THE PLOT WITCH' centered on lid",
      lightingSignature: "Night studio desk lighting with warm gold and teal accents",
    },
    savedAnchorUrl: "/src/assets/images/plotwitch_etsy_listing_1794064898448.jpg",
    defaultCopy: {
      socialCaption:
        "When a scene stalls out halfway through a chapter, the problem usually isn't your prose—it's that your character doesn't have a clear reason to stay in the room. I built the Story Structure Tarot Card Deck so you can lay out three concrete conflict prompts on the desk, test what breaks if you flip the scene goal, and pick the option that actually moves the plot forward.\n\n#writingprompts #tarotcommunity\n\nAI Content Note: Product scene visual generated with AI from our studio master image.",
      hashtags: [
        {
          tag: "#writingprompts",
          countText: "1,240,000 posts (verified in 850k–1.5M range)",
          verified: true,
        },
        {
          tag: "#tarotcommunity",
          countText: "Count not verified in search results",
          verified: false,
        },
      ],
      aiDisclosureNote:
        "AI Content Note: Product scene visual generated with AI from our studio master image.",
      pinterestTitle: "The Plot Witch Story Structure Tarot Deck for Writers",
      pinterestDescription:
        "Troubleshoot stuck scenes and flat character decisions with 78 story-structure prompt cards stamped in gold circuitry foil. Lay out three cards beside your outline to test what your chapter actually needs next.",
    },
  },
  {
    id: "archive",
    label: "Macro Keypad (Archive)",
    brief: PRODUCT_BRIEF_TEMPLATES[2].brief,
    canonicalSpec: {
      canonicalObjectDescription:
        "Machined deep-plum aluminum 12-key mechanical writer's keypad with translucent dark keycaps, gold-engraved icons, a solid brass rotary dial, and teal and magenta underglow.",
      silhouetteLock: "Compact 12-key aluminum keypad with top-right solid brass rotary knob",
      surfaceMaterials: "Anodized deep-plum aluminum · Solid brushed brass · Smoked translucent keycaps",
      labelTypographySpec: "Gold-engraved key legends and subtle 'THE PLOT WITCH' front edge mark",
      lightingSignature: "Dark studio desk at night with teal and magenta RGB underglow",
    },
    savedAnchorUrl: "/src/assets/images/plotwitch_hero_shot_1794064900438.jpg",
    defaultCopy: {
      socialCaption:
        "Every time you take your hands off the keyboard to dig through three menus for a scene break or a sprint timer, you give yourself an excuse to check something else entirely. I set up this 12-key Macro Keypad so common drafting actions—inserting a clean scene divider, flagging a line to verify later, or dimming the monitor—happen in one keypress so you can finish the paragraph first.\n\n#mechanicalkeyboards #desksetupideas\n\nAI Content Note: Product scene visual generated with AI from our studio master image.",
      hashtags: [
        {
          tag: "#mechanicalkeyboards",
          countText: "1,380,000 posts (verified in 850k–1.5M range)",
          verified: true,
        },
        {
          tag: "#desksetupideas",
          countText: "Count not verified in search results",
          verified: false,
        },
      ],
      aiDisclosureNote:
        "AI Content Note: Product scene visual generated with AI from our studio master image.",
      pinterestTitle: "The Plot Witch 12-Key Aluminum Writer's Macro Keypad",
      pinterestDescription:
        "Keep your hands on the draft instead of hunting through menus. A machined deep-plum aluminum 12-key keypad with a solid brass rotary dial programmed for scene breaks, revision flags, and timed writing sprints.",
    },
  },
];

export const INITIAL_SCHEDULED_POSTS: ScheduledPost[] = [
  {
    id: "sched-post-1",
    date: "2026-11-07",
    platform: "Instagram Portrait",
    mediumId: "instagram_portrait",
    productId: "plot-witch-default",
    productName: "Hardcover Journal",
    shortNote: "How to organize chapter tabs and character index cards before drafting Act II",
    status: "ready",
    copyDraft: INITIAL_COPY_DRAFT,
  },
  {
    id: "sched-post-2",
    date: "2026-11-09",
    platform: "Pinterest Pin",
    mediumId: "pinterest_pin",
    productId: "dark-studio",
    productName: "Tarot Card Deck",
    shortNote: "Testing viewpoint switches and scene stakes with a 3-card spread",
    status: "drafted",
    copyDraft: INITIAL_SAVED_LISTINGS[1].defaultCopy,
  },
  {
    id: "sched-post-3",
    date: "2026-11-11",
    platform: "Etsy Listing",
    mediumId: "etsy_listing",
    productId: "archive",
    productName: "Macro Keypad",
    shortNote: "Cutting filler words and flagging revision notes with single-key macros",
    status: "posted",
    copyDraft: INITIAL_SAVED_LISTINGS[2].defaultCopy,
  },
];

