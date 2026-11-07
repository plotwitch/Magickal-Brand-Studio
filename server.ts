import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "50mb" }));

// Load Firebase Applet Configuration
const firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const OperationType = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LIST: "list",
  GET: "get",
  WRITE: "write",
} as const;
type OperationType = (typeof OperationType)[keyof typeof OperationType];

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  docPath: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: false,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path: docPath,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let firestoreBootConnected = false;

async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    firestoreBootConnected = true;
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("the client is offline")
    ) {
      console.error("Please check your Firebase configuration.");
    }
    firestoreBootConnected = false;
    return false;
  }
}

function getExpectedPassword(): string {
  return typeof process.env.APP_PASSWORD === "string"
    ? process.env.APP_PASSWORD
    : "";
}

/**
 * Computes a deterministic 64-character hex studioId for the shared workspace in Firestore
 * derived from the APP_PASSWORD secret using HMAC-SHA256 so the key cannot be computed from public values.
 * Matches ^[a-f0-9]{32,64}$ required by firestore.rules.
 */
function getStudioId(): string {
  const secretPassword = getExpectedPassword();
  if (!secretPassword) {
    throw new Error("APP_PASSWORD secret is required to compute the workspace key.");
  }
  return crypto
    .createHmac("sha256", secretPassword)
    .update("plot-witch-firestore-workspace-key-v2")
    .digest("hex");
}

/**
 * Computes the legacy workspace key that was previously derived from public Firebase config values.
 * Used on first start with the new key to copy existing workspace data and image chunks to the new key.
 */
function getLegacyPublicStudioId(): string {
  const seed = `${firebaseConfig.projectId || "plot-witch"}:${
    firebaseConfig.appId || "brand-builder"
  }`;
  return crypto
    .createHmac("sha256", seed)
    .update("plot-witch-shared-studio-workspace-v1")
    .digest("hex");
}

function sanitizeImageKey(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96) || "img";
}

const IMAGE_CHUNK_SIZE = 500000; // 500KB per chunk (well below Firestore's 1MB limit and 700KB rule limit)
const writtenImageSignatures = new Map<string, string>();

async function saveImageToFirestoreChunks(
  studioId: string,
  rawImageKey: string,
  imageDataUrl: string | undefined
): Promise<void> {
  if (!imageDataUrl) return;
  const imageKey = sanitizeImageKey(rawImageKey);
  const hash = crypto.createHash("sha256").update(imageDataUrl).digest("hex");
  const cacheKey = `${studioId}:${imageKey}`;

  if (writtenImageSignatures.get(cacheKey) === hash) {
    return;
  }

  const chunks: string[] = [];
  for (let i = 0; i < imageDataUrl.length; i += IMAGE_CHUNK_SIZE) {
    chunks.push(imageDataUrl.slice(i, i + IMAGE_CHUNK_SIZE));
  }

  const totalChunks = chunks.length;
  const nowIso = new Date().toISOString();

  for (let idx = 0; idx < totalChunks; idx++) {
    const chunkId = `${imageKey}__${idx}`;
    const chunkPath = `studios/${studioId}/imageChunks/${chunkId}`;
    try {
      await setDoc(doc(db, "studios", studioId, "imageChunks", chunkId), {
        studioId,
        imageKey,
        chunkIndex: idx,
        totalChunks,
        dataChunk: chunks[idx],
        updatedIso: nowIso,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, chunkPath);
    }
  }

  // Clean up any leftover old chunks if a previous image had more chunks
  for (let extraIdx = totalChunks; extraIdx < totalChunks + 3; extraIdx++) {
    const extraChunkId = `${imageKey}__${extraIdx}`;
    try {
      await deleteDoc(doc(db, "studios", studioId, "imageChunks", extraChunkId));
    } catch {
      // Ignore if non-existent
    }
  }

  writtenImageSignatures.set(cacheKey, hash);
}

interface CachedWorkspaceState {
  activePresetId: string;
  activeTemplateId: string;
  isAnchorApproved: boolean;
  brief: any;
  canonicalSpec: any;
  anchorImageUrl: string;
  mediumShots: Record<string, any>;
  copyDraft: any;
  savedPresets: any[];
  savedListings: any[];
  scheduledPosts: any[];
}

let serverMemoryCache: CachedWorkspaceState | null = null;
let legacyWorkspaceMigratedForKey: string | null = null;
let migrationInFlightPromise: Promise<void> | null = null;

/**
 * On the first start with the new APP_PASSWORD-derived workspace key, copies existing
 * workspace data and image chunks from the old public key to the new key if the new key
 * does not yet exist in Firestore.
 */
async function migrateLegacyWorkspaceToNewKeyIfNeeded(): Promise<void> {
  if (!getExpectedPassword()) {
    return;
  }

  const newStudioId = getStudioId();
  if (legacyWorkspaceMigratedForKey === newStudioId) {
    return;
  }

  if (migrationInFlightPromise) {
    await migrationInFlightPromise;
    return;
  }

  migrationInFlightPromise = (async () => {
    try {
      const oldStudioId = getLegacyPublicStudioId();
      if (newStudioId === oldStudioId) {
        legacyWorkspaceMigratedForKey = newStudioId;
        return;
      }

      const newStudioDocPath = `studios/${newStudioId}`;
      let newSnap;
      try {
        newSnap = await getDocFromServer(doc(db, "studios", newStudioId));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, newStudioDocPath);
      }

      // If the new workspace document already exists, no copy is needed
      if (newSnap.exists()) {
        legacyWorkspaceMigratedForKey = newStudioId;
        return;
      }

      const oldStudioDocPath = `studios/${oldStudioId}`;
      let oldSnap;
      try {
        oldSnap = await getDocFromServer(doc(db, "studios", oldStudioId));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, oldStudioDocPath);
      }

      if (!oldSnap.exists()) {
        legacyWorkspaceMigratedForKey = newStudioId;
        return;
      }

      const oldData = oldSnap.data();

      // Copy all image chunks from the old workspace key to the new workspace key
      const oldChunksPath = `studios/${oldStudioId}/imageChunks`;
      let oldChunksSnap;
      try {
        const q = query(
          collection(db, "studios", oldStudioId, "imageChunks"),
          where("studioId", "==", oldStudioId)
        );
        oldChunksSnap = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, oldChunksPath);
      }

      const nowIso = new Date().toISOString();

      for (const chunkDoc of oldChunksSnap.docs) {
        const c = chunkDoc.data();
        if (!c?.imageKey || typeof c.dataChunk !== "string") continue;
        const chunkId = chunkDoc.id;
        const newChunkPath = `studios/${newStudioId}/imageChunks/${chunkId}`;
        try {
          await setDoc(doc(db, "studios", newStudioId, "imageChunks", chunkId), {
            studioId: newStudioId,
            imageKey: String(c.imageKey).slice(0, 128),
            chunkIndex: Number(c.chunkIndex) || 0,
            totalChunks: Number(c.totalChunks) || 1,
            dataChunk: c.dataChunk,
            updatedIso: String(c.updatedIso || nowIso).slice(0, 64),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, newChunkPath);
        }
      }

      // Copy the main workspace document to the new workspace key with the exact same shape
      const migratedWorkspacePayload = {
        studioId: newStudioId,
        activePresetId: String(oldData.activePresetId || "plot-witch-default").slice(0, 128),
        activeTemplateId: String(oldData.activeTemplateId || "plot-witch-default").slice(0, 128),
        isAnchorApproved:
          typeof oldData.isAnchorApproved === "boolean" ? oldData.isAnchorApproved : true,
        briefJson: String(oldData.briefJson || "{}").slice(0, 49000),
        canonicalSpecJson: String(oldData.canonicalSpecJson || "{}").slice(0, 49000),
        copyDraftJson: String(oldData.copyDraftJson || "{}").slice(0, 99000),
        presetsJson: String(oldData.presetsJson || "[]").slice(0, 199000),
        listingsJson: String(oldData.listingsJson || "[]").slice(0, 299000),
        scheduledPostsJson: String(oldData.scheduledPostsJson || "[]").slice(0, 399000),
        mediumMetaJson: String(oldData.mediumMetaJson || "{}").slice(0, 99000),
        updatedIso: String(oldData.updatedIso || nowIso).slice(0, 64),
      };

      try {
        await setDoc(doc(db, "studios", newStudioId), migratedWorkspacePayload);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, newStudioDocPath);
      }

      legacyWorkspaceMigratedForKey = newStudioId;
      console.log("Migrated existing workspace data from legacy key to APP_PASSWORD-derived key.");
    } finally {
      migrationInFlightPromise = null;
    }
  })();

  await migrationInFlightPromise;
}

// Run boot connection test and legacy workspace migration in background without blocking server listen
testFirestoreConnection()
  .then((connected) => {
    if (connected) {
      return migrateLegacyWorkspaceToNewKeyIfNeeded();
    }
  })
  .catch(() => {});

async function loadSharedStateFromFirestore(): Promise<{
  exists: boolean;
  state: CachedWorkspaceState | null;
}> {
  await migrateLegacyWorkspaceToNewKeyIfNeeded();

  const studioId = getStudioId();
  const studioDocPath = `studios/${studioId}`;

  let studioSnap;
  try {
    studioSnap = await getDocFromServer(doc(db, "studios", studioId));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, studioDocPath);
  }

  if (!studioSnap.exists()) {
    return { exists: false, state: null };
  }

  const data = studioSnap.data();

  // Load all image chunks for this studioId
  const chunksColPath = `studios/${studioId}/imageChunks`;
  let chunkDocsSnap;
  try {
    const q = query(
      collection(db, "studios", studioId, "imageChunks"),
      where("studioId", "==", studioId)
    );
    chunkDocsSnap = await getDocs(q);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, chunksColPath);
  }

  const groupedChunks: Record<
    string,
    Array<{ chunkIndex: number; totalChunks: number; dataChunk: string }>
  > = {};

  chunkDocsSnap.forEach((docSnap) => {
    const c = docSnap.data();
    if (!c?.imageKey || typeof c.dataChunk !== "string") return;
    if (!groupedChunks[c.imageKey]) {
      groupedChunks[c.imageKey] = [];
    }
    groupedChunks[c.imageKey].push({
      chunkIndex: Number(c.chunkIndex) || 0,
      totalChunks: Number(c.totalChunks) || 1,
      dataChunk: c.dataChunk,
    });
  });

  const reassembledImages: Record<string, string> = {};
  for (const [imageKey, list] of Object.entries(groupedChunks)) {
    list.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const full = list.map((item) => item.dataChunk).join("");
    reassembledImages[imageKey] = full;
    const hash = crypto.createHash("sha256").update(full).digest("hex");
    writtenImageSignatures.set(`${studioId}:${imageKey}`, hash);
  }

  const parsedBrief = JSON.parse(data.briefJson || "{}");
  if (reassembledImages["brief_prod_ref"]) {
    parsedBrief.uploadedReferenceDataUrl = reassembledImages["brief_prod_ref"];
  }
  if (reassembledImages["brief_char_ref"]) {
    parsedBrief.characterReferenceDataUrl = reassembledImages["brief_char_ref"];
  }

  const parsedMediumMeta = JSON.parse(data.mediumMetaJson || "{}");
  const mediumShots: Record<string, any> = {};
  for (const [mId, meta] of Object.entries<any>(parsedMediumMeta)) {
    const imgKey = sanitizeImageKey(`medium_${mId}`);
    mediumShots[mId] = {
      ...meta,
      imageUrl: reassembledImages[imgKey] || meta.imageUrl || undefined,
    };
  }

  const parsedListings = JSON.parse(data.listingsJson || "[]");
  const hydratedListings = parsedListings.map((item: any) => {
    const listKey = sanitizeImageKey(`listing_${item.id}`);
    return {
      ...item,
      savedAnchorUrl:
        reassembledImages[listKey] || item.savedAnchorUrl || "",
    };
  });

  const fullState: CachedWorkspaceState = {
    activePresetId: data.activePresetId || "plot-witch-default",
    activeTemplateId: data.activeTemplateId || "plot-witch-default",
    isAnchorApproved:
      typeof data.isAnchorApproved === "boolean" ? data.isAnchorApproved : true,
    brief: parsedBrief,
    canonicalSpec: JSON.parse(data.canonicalSpecJson || "{}"),
    anchorImageUrl:
      reassembledImages["anchor_main"] ||
      "/src/assets/images/plotwitch_master_journal.jpg",
    mediumShots,
    copyDraft: JSON.parse(data.copyDraftJson || "{}"),
    savedPresets: JSON.parse(data.presetsJson || "[]"),
    savedListings: hydratedListings,
    scheduledPosts: JSON.parse(data.scheduledPostsJson || "[]"),
  };

  serverMemoryCache = fullState;
  return { exists: true, state: fullState };
}

async function saveSharedStateToFirestore(
  partial: Partial<CachedWorkspaceState>
): Promise<CachedWorkspaceState> {
  await migrateLegacyWorkspaceToNewKeyIfNeeded();

  const studioId = getStudioId();

  if (!serverMemoryCache) {
    try {
      const existing = await loadSharedStateFromFirestore();
      if (existing.exists && existing.state) {
        serverMemoryCache = existing.state;
      }
    } catch {
      // Ignore if initial read before first seed
    }
  }

  const merged: CachedWorkspaceState = {
    activePresetId:
      partial.activePresetId ??
      serverMemoryCache?.activePresetId ??
      "plot-witch-default",
    activeTemplateId:
      partial.activeTemplateId ??
      serverMemoryCache?.activeTemplateId ??
      "plot-witch-default",
    isAnchorApproved:
      typeof partial.isAnchorApproved === "boolean"
        ? partial.isAnchorApproved
        : serverMemoryCache?.isAnchorApproved ?? true,
    brief: partial.brief ?? serverMemoryCache?.brief ?? {},
    canonicalSpec:
      partial.canonicalSpec ?? serverMemoryCache?.canonicalSpec ?? {},
    anchorImageUrl:
      partial.anchorImageUrl ??
      serverMemoryCache?.anchorImageUrl ??
      "/src/assets/images/plotwitch_master_journal.jpg",
    mediumShots: partial.mediumShots ?? serverMemoryCache?.mediumShots ?? {},
    copyDraft: partial.copyDraft ?? serverMemoryCache?.copyDraft ?? {},
    savedPresets: partial.savedPresets ?? serverMemoryCache?.savedPresets ?? [],
    savedListings:
      partial.savedListings ?? serverMemoryCache?.savedListings ?? [],
    scheduledPosts:
      partial.scheduledPosts ?? serverMemoryCache?.scheduledPosts ?? [],
  };

  serverMemoryCache = merged;

  // 1. Save chunked images first
  if (merged.anchorImageUrl) {
    await saveImageToFirestoreChunks(
      studioId,
      "anchor_main",
      merged.anchorImageUrl
    );
  }

  if (merged.brief?.uploadedReferenceDataUrl) {
    await saveImageToFirestoreChunks(
      studioId,
      "brief_prod_ref",
      merged.brief.uploadedReferenceDataUrl
    );
  }

  if (merged.brief?.characterReferenceDataUrl) {
    await saveImageToFirestoreChunks(
      studioId,
      "brief_char_ref",
      merged.brief.characterReferenceDataUrl
    );
  }

  const strippedBrief = {
    ...merged.brief,
    uploadedReferenceDataUrl: merged.brief?.uploadedReferenceDataUrl
      ? "__CHUNKED__"
      : undefined,
    characterReferenceDataUrl: merged.brief?.characterReferenceDataUrl
      ? "__CHUNKED__"
      : undefined,
  };

  const strippedMediumMeta: Record<string, any> = {};
  for (const [mId, shot] of Object.entries<any>(merged.mediumShots || {})) {
    if (shot?.imageUrl) {
      await saveImageToFirestoreChunks(
        studioId,
        `medium_${mId}`,
        shot.imageUrl
      );
    }
    const { imageUrl, ...restMeta } = shot || {};
    strippedMediumMeta[mId] = {
      ...restMeta,
      hasImage: Boolean(imageUrl),
    };
  }

  const strippedListings = [];
  for (const item of merged.savedListings || []) {
    if (item?.savedAnchorUrl) {
      await saveImageToFirestoreChunks(
        studioId,
        `listing_${item.id}`,
        item.savedAnchorUrl
      );
    }
    const { savedAnchorUrl, ...restItem } = item || {};
    // Strip any large inline reference images inside listing.brief as well
    const cleanListingBrief = restItem.brief
      ? {
          ...restItem.brief,
          uploadedReferenceDataUrl: undefined,
          characterReferenceDataUrl: undefined,
        }
      : {};
    strippedListings.push({
      ...restItem,
      brief: cleanListingBrief,
      hasSavedAnchor: Boolean(savedAnchorUrl),
    });
  }

  const nowIso = new Date().toISOString();
  const studioDocPayload = {
    studioId,
    activePresetId: String(merged.activePresetId || "plot-witch-default").slice(
      0,
      128
    ),
    activeTemplateId: String(
      merged.activeTemplateId || "plot-witch-default"
    ).slice(0, 128),
    isAnchorApproved: Boolean(merged.isAnchorApproved),
    briefJson: JSON.stringify(strippedBrief).slice(0, 49000),
    canonicalSpecJson: JSON.stringify(merged.canonicalSpec || {}).slice(
      0,
      49000
    ),
    copyDraftJson: JSON.stringify(merged.copyDraft || {}).slice(0, 99000),
    presetsJson: JSON.stringify(merged.savedPresets || []).slice(0, 199000),
    listingsJson: JSON.stringify(strippedListings).slice(0, 299000),
    scheduledPostsJson: JSON.stringify(merged.scheduledPosts || []).slice(
      0,
      399000
    ),
    mediumMetaJson: JSON.stringify(strippedMediumMeta).slice(0, 99000),
    updatedIso: nowIso,
  };

  const studioDocPath = `studios/${studioId}`;
  try {
    await setDoc(doc(db, "studios", studioId), studioDocPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, studioDocPath);
  }

  return merged;
}

/**
 * Single-Password Gate Helpers
 * The server compares submitted passwords against process.env.APP_PASSWORD.
 * The browser never receives the real password; it only receives an opaque HMAC session token.
 */

function computeSessionToken(secretPassword: string): string {
  return crypto
    .createHmac("sha256", secretPassword)
    .update("plot-witch-brand-builder-session-v1")
    .digest("hex");
}

function safeCompareStrings(submitted: string, expected: string): boolean {
  if (!expected || typeof submitted !== "string") return false;
  const bufA = Buffer.from(submitted, "utf-8");
  const bufB = Buffer.from(expected, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isRequestUnlocked(req: express.Request): boolean {
  const expectedPassword = getExpectedPassword();
  if (!expectedPassword) return false;

  const headerToken =
    (req.headers["x-app-auth-token"] as string) ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7).trim()
      : "");

  if (!headerToken) return false;
  const validToken = computeSessionToken(expectedPassword);
  return safeCompareStrings(headerToken, validToken);
}

/**
 * POST /api/auth/unlock
 * Compares the submitted password against process.env.APP_PASSWORD.
 * Wrong password returns: "That password does not match."
 */
app.post("/api/auth/unlock", (req, res) => {
  const submittedPassword =
    typeof req.body?.password === "string" ? req.body.password : "";
  const expectedPassword = getExpectedPassword();

  if (!expectedPassword || !safeCompareStrings(submittedPassword, expectedPassword)) {
    res.status(401).json({
      unlocked: false,
      error: "That password does not match.",
    });
    return;
  }

  const token = computeSessionToken(expectedPassword);
  res.json({
    unlocked: true,
    token,
  });
});

/**
 * GET /api/auth/session
 * Verifies whether the browser's stored session token is valid.
 */
app.get("/api/auth/session", (req, res) => {
  if (isRequestUnlocked(req)) {
    res.json({ unlocked: true });
    return;
  }
  res.status(401).json({ unlocked: false });
});

/**
 * Protect all /api/brand/* routes so every API call and all data access stays locked until the password check passes.
 */
app.use("/api/brand", (req, res, next) => {
  if (!isRequestUnlocked(req)) {
    res.status(401).json({
      error: "That password does not match.",
    });
    return;
  }
  next();
});

/**
 * GET /api/brand/state
 * Loads shared campaigns, master anchor images, generated sizes, brand presets, and content calendar entries from Firestore.
 */
app.get("/api/brand/state", async (_req, res) => {
  try {
    const result = await loadSharedStateFromFirestore();
    firestoreBootConnected = true;
    res.json({
      connected: true,
      statusText: "Data: shared and saved",
      exists: result.exists,
      state: result.state,
    });
  } catch (error: any) {
    console.error("Failed to load state from Firestore:", error?.message || error);
    firestoreBootConnected = false;
    res.status(503).json({
      connected: false,
      statusText: "Data: not connected",
      error: error?.message || "Database connection failed.",
    });
  }
});

/**
 * POST /api/brand/state
 * Saves shared campaigns, master anchor images, generated sizes, brand presets, and content calendar entries to Firestore.
 */
app.post("/api/brand/state", async (req, res) => {
  try {
    const saved = await saveSharedStateToFirestore(req.body || {});
    firestoreBootConnected = true;
    res.json({
      ok: true,
      connected: true,
      statusText: "Data: shared and saved",
      state: saved,
    });
  } catch (error: any) {
    console.error("Failed to save state to Firestore:", error?.message || error);
    firestoreBootConnected = false;
    res.status(503).json({
      ok: false,
      connected: false,
      statusText: "Data: not connected",
      error: error?.message || "Database write failed.",
    });
  }
});

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not configured. Please check Settings > Secrets to ensure a valid billing-enabled API key is attached."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getHumanPresenceDirective(
  mode: "product_only" | "hands_only" | "character_in_scene",
  hasCharacterReference: boolean
): string {
  if (mode === "hands_only") {
    return "HUMAN PRESENCE SETTING — HANDS ONLY: Include expressive, natural human hands interacting with, holding, or gesturing over the product in the scene. Do NOT show full faces, heads, or full bodies—focus strictly on the product and elegant hand interaction.";
  }
  if (mode === "character_in_scene") {
    return hasCharacterReference
      ? "HUMAN PRESENCE SETTING — CHARACTER IN SCENE (REFERENCE ATTACHED): Include the character from the attached character reference image in the scene naturally holding, using, or posing alongside the exact product from the Master Product Anchor image. Preserve both the character's visual appearance/features and the exact physical identity of the product."
      : "HUMAN PRESENCE SETTING — CHARACTER IN SCENE: Include a stylized creative character in the scene naturally holding, using, or posing with the exact product while keeping the product's physical form, materials, and branding 100% consistent.";
  }
  return "HUMAN PRESENCE SETTING — PRODUCT ONLY: Do NOT include any people, human figures, faces, hands, fingers, or silhouettes anywhere in the scene. Pure object and atmospheric studio environment photography only.";
}

function parseDataUrl(dataUrl?: string): { mimeType: string; data: string } | null {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  if (dataUrl.startsWith("/src/assets/")) {
    try {
      const fullPath = path.join(__dirname, dataUrl);
      if (fs.existsSync(fullPath)) {
        const buffer = fs.readFileSync(fullPath);
        return {
          mimeType: "image/jpeg",
          data: buffer.toString("base64"),
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * POST /api/brand/anchor
 * Stage 1: Synthesizes a Canonical Product DNA Specification + generates one Master Product Anchor image
 * using gemini-nano-banana-2.1 for user approval before deriving campaign mediums.
 */
app.post("/api/brand/anchor", async (req, res) => {
  try {
    const {
      brandName,
      productName,
      productDescription,
      tagline,
      aestheticStyle,
      colorPalette,
      humanPresenceMode = "product_only",
      imageSize = "1K",
      uploadedReferenceDataUrl,
      characterReferenceDataUrl,
      brandPreset,
    } = req.body;

    if (!productDescription || !brandName) {
      res.status(400).json({ error: "Please provide both a brand name and product description." });
      return;
    }

    const ai = getGenAIClient();

    const presetContext = brandPreset
      ? `Brand Preset Colors: Primary ${brandPreset.primaryColor}, Secondary ${brandPreset.secondaryColor}, Accent ${brandPreset.accentColor}, Gold ${brandPreset.goldColor}. Brand Fonts: Heading '${brandPreset.headingFont}', Body '${brandPreset.bodyFont}'.`
      : "";

    const specResponse = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Create a Canonical Product Visual Specification for a commercial product shoot so every derived medium image keeps the product 100% identical.
Brand Name: ${brandName}
Product Name: ${productName || brandName}
User Product Description: ${productDescription}
Campaign Tagline: ${tagline || ""}
Aesthetic Direction: ${aestheticStyle || "Tech-Witch Studio Desk at Night · Ritual & Digital"}
Color Palette Notes: ${colorPalette || "Deep Plum, Vibrant Teal, Sassy Magenta, Alchemy Gold, Midnight Black"}
${presetContext}

Describe the physical product's exact geometry, silhouette, proportions, surface materials, textures, hardware/closures, and exact label/embossing layout and typography so all subsequent shots derived from the Master Anchor remain unmistakably identical.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            canonicalObjectDescription: {
              type: Type.STRING,
              description:
                "Precise 2-3 sentence physical description of the product form, materials, finishes, and exact label/embossed text.",
            },
            silhouetteLock: {
              type: Type.STRING,
              description: "Short phrase locking proportions and geometry.",
            },
            surfaceMaterials: {
              type: Type.STRING,
              description: "Dot-separated material list.",
            },
            labelTypographySpec: {
              type: Type.STRING,
              description: "Exact text and typography visible on the product itself.",
            },
            lightingSignature: {
              type: Type.STRING,
              description: "Consistent lighting mood across campaign mediums.",
            },
          },
          required: [
            "canonicalObjectDescription",
            "silhouetteLock",
            "surfaceMaterials",
            "labelTypographySpec",
            "lightingSignature",
          ],
        },
      },
    });

    let canonicalSpec = {
      canonicalObjectDescription: `${productName || brandName}: ${productDescription}. Branded clearly with '${brandName}'.`,
      silhouetteLock: "Precision studio product form with locked proportions",
      surfaceMaterials: colorPalette || "Deep plum leather · Gold foil embossing · Brushed brass",
      labelTypographySpec: `Serif display embossing reading '${brandName}'`,
      lightingSignature: aestheticStyle || "Midnight tech-witch studio lighting with teal, magenta, and warm gold rim accents",
    };

    try {
      if (specResponse.text) {
        canonicalSpec = JSON.parse(specResponse.text.trim());
      }
    } catch {
      // Use fallback canonicalSpec
    }

    const parsedProductRef = parseDataUrl(uploadedReferenceDataUrl);
    const parsedCharRef = parseDataUrl(characterReferenceDataUrl);

    const anchorHumanNote =
      humanPresenceMode === "product_only"
        ? getHumanPresenceDirective("product_only", false)
        : humanPresenceMode === "hands_only"
        ? "For this Master Product Anchor shot, keep the product completely unobstructed and clearly visible (either pure product studio shot or subtle hand presentation that does not obscure any label or silhouette details)."
        : "For this Master Product Anchor shot, establish the definitive, unobstructed view of the physical product so all subsequent mediums lock onto its exact structure.";

    const anchorPrompt = `Master commercial studio product anchor photograph of ${canonicalSpec.canonicalObjectDescription}.
Physical Form Lock: ${canonicalSpec.silhouetteLock}.
Materials & Finishes: ${canonicalSpec.surfaceMaterials}.
Product Label / Markings: ${canonicalSpec.labelTypographySpec}.
Brand Palette & Lighting: ${canonicalSpec.lightingSignature}. ${presetContext}
Setting: Centered hero product resting on an atmospheric dark obsidian and deep-plum ritual-digital studio desk with subtle gold tarot-and-circuitry accents, razor-sharp focus, 8k commercial photography.
${anchorHumanNote}`;

    const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];
    if (parsedProductRef) {
      parts.push({
        inlineData: {
          data: parsedProductRef.data,
          mimeType: parsedProductRef.mimeType,
        },
      });
    }
    if (humanPresenceMode === "character_in_scene" && parsedCharRef) {
      parts.push({
        inlineData: {
          data: parsedCharRef.data,
          mimeType: parsedCharRef.mimeType,
        },
      });
    }
    parts.push({ text: anchorPrompt });

    const imageResponse = await ai.models.generateContent({
      model: "gemini-nano-banana-2.1",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: ["1K", "2K", "4K"].includes(imageSize) ? imageSize : "1K",
        },
      },
    });

    let anchorImageDataUrl = "";
    let modelNotes = "";

    for (const part of imageResponse.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        anchorImageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
      } else if (part.text) {
        modelNotes += part.text;
      }
    }

    if (!anchorImageDataUrl) {
      res.status(502).json({
        error: "Nano-Banana 2.1 did not return an image for the Master Product Anchor. Please refine the product description and try again.",
      });
      return;
    }

    res.json({
      canonicalSpec,
      anchorImageDataUrl,
      anchorPrompt,
      modelUsed: "gemini-nano-banana-2.1",
      modelNotes,
    });
  } catch (error: any) {
    console.error("Error in /api/brand/anchor:", error);
    const status = error?.status || 500;
    res.status(status).json({
      error: error?.message || "Failed to generate Master Product Anchor with Nano-Banana 2.1.",
    });
  }
});

/**
 * POST /api/brand/medium
 * Stage 2: Generates a specific campaign medium derived directly from the user-approved Master Product Anchor image.
 */
app.post("/api/brand/medium", async (req, res) => {
  try {
    const {
      tagline,
      canonicalSpec,
      anchorImageDataUrl,
      humanPresenceMode = "product_only",
      characterReferenceDataUrl,
      brandPreset,
      mediumId,
      mediumTitle,
      targetWidth,
      targetHeight,
      mediumPromptTemplate,
      aspectRatio = "1:1",
      imageSize = "1K",
      customSceneNote = "",
    } = req.body;

    if (!canonicalSpec || !mediumPromptTemplate) {
      res.status(400).json({ error: "Missing canonical product specification or medium template." });
      return;
    }

    const ai = getGenAIClient();
    const parsedAnchor = parseDataUrl(anchorImageDataUrl);
    const parsedCharRef = parseDataUrl(characterReferenceDataUrl);

    const humanDirective = getHumanPresenceDirective(
      humanPresenceMode,
      Boolean(parsedCharRef)
    );

    const presetColorsNote = brandPreset
      ? `Brand Color Harmony: Primary ${brandPreset.primaryColor}, Secondary ${brandPreset.secondaryColor}, Accent ${brandPreset.accentColor}, Gold ${brandPreset.goldColor}. Typography Style: ${brandPreset.headingFont}.`
      : "";

    const fullPrompt = `Using the first attached image as the APPROVED MASTER PRODUCT ANCHOR, generate a photorealistic ${mediumTitle} (${targetWidth}×${targetHeight} composition) featuring this EXACT product with 100% identical geometry, proportions, materials, color palette, and embossing/label design.

LOCKED PRODUCT IDENTITY (FROM APPROVED ANCHOR):
- Object Identity: ${canonicalSpec.canonicalObjectDescription}
- Silhouette & Form: ${canonicalSpec.silhouetteLock}
- Materials & Finishes: ${canonicalSpec.surfaceMaterials}
- Visible Branding / Label: ${canonicalSpec.labelTypographySpec}
- Lighting & Brand Palette: ${canonicalSpec.lightingSignature}. ${presetColorsNote}
${tagline ? `- Campaign Copy / Theme: "${tagline}"` : ""}

MEDIUM COMPOSITION (${mediumTitle} — ${targetWidth}x${targetHeight}):
${mediumPromptTemplate}
${customSceneNote ? `Additional Art Direction: ${customSceneNote}` : ""}

${humanDirective}`;

    const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

    if (parsedAnchor) {
      parts.push({
        inlineData: {
          data: parsedAnchor.data,
          mimeType: parsedAnchor.mimeType,
        },
      });
    }

    if (humanPresenceMode === "character_in_scene" && parsedCharRef) {
      parts.push({
        inlineData: {
          data: parsedCharRef.data,
          mimeType: parsedCharRef.mimeType,
        },
      });
    }

    parts.push({ text: fullPrompt });

    const validAspectRatios = ["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"];
    const safeAspectRatio = validAspectRatios.includes(aspectRatio) ? aspectRatio : "1:1";

    const requestedSize =
      targetWidth >= 2000 && imageSize === "1K"
        ? "2K"
        : ["1K", "2K", "4K"].includes(imageSize)
        ? imageSize
        : "1K";

    const response = await ai.models.generateContent({
      model: "gemini-nano-banana-2.1",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: safeAspectRatio as any,
          imageSize: requestedSize as any,
        },
      },
    });

    let imageUrl = "";
    let textNote = "";

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
      } else if (part.text) {
        textNote += part.text;
      }
    }

    if (!imageUrl) {
      res.status(502).json({
        error: `Nano-Banana 2.1 did not return an image for ${mediumTitle}. Please try regenerating this medium.`,
      });
      return;
    }

    res.json({
      mediumId,
      imageUrl,
      promptUsed: fullPrompt,
      modelUsed: "gemini-nano-banana-2.1",
      textNote,
    });
  } catch (error: any) {
    console.error("Error in /api/brand/medium:", error);
    const status = error?.status || 500;
    res.status(status).json({
      error: error?.message || "Failed to generate medium visual with Nano-Banana 2.1.",
    });
  }
});

/**
 * POST /api/brand/refine
 * Edits an existing medium shot with Nano-Banana 2.1 while maintaining product consistency.
 */
app.post("/api/brand/refine", async (req, res) => {
  try {
    const {
      currentImageUrl,
      anchorImageDataUrl,
      characterReferenceDataUrl,
      humanPresenceMode = "product_only",
      editInstruction,
      canonicalSpec,
      aspectRatio = "1:1",
      imageSize = "1K",
    } = req.body;

    if (!currentImageUrl || !editInstruction) {
      res.status(400).json({ error: "Current image and edit instruction are required." });
      return;
    }

    const ai = getGenAIClient();
    const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> = [];

    const parsedCurrent = parseDataUrl(currentImageUrl);
    if (parsedCurrent) {
      parts.push({
        inlineData: {
          data: parsedCurrent.data,
          mimeType: parsedCurrent.mimeType,
        },
      });
    }

    const parsedAnchor = parseDataUrl(anchorImageDataUrl);
    if (parsedAnchor) {
      parts.push({
        inlineData: {
          data: parsedAnchor.data,
          mimeType: parsedAnchor.mimeType,
        },
      });
    }

    const parsedCharRef = parseDataUrl(characterReferenceDataUrl);
    if (humanPresenceMode === "character_in_scene" && parsedCharRef) {
      parts.push({
        inlineData: {
          data: parsedCharRef.data,
          mimeType: parsedCharRef.mimeType,
        },
      });
    }

    const humanDirective = getHumanPresenceDirective(
      humanPresenceMode,
      Boolean(parsedCharRef)
    );

    const refinePrompt = `Edit the first attached campaign medium image according to this instruction: "${editInstruction}".
Keep the physical product 100% identical to the approved Master Product Anchor specification (${canonicalSpec?.canonicalObjectDescription || "same exact product shape, materials, and branding"}).
${humanDirective}`;

    parts.push({ text: refinePrompt });

    const response = await ai.models.generateContent({
      model: "gemini-nano-banana-2.1",
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio as any,
          imageSize: ["1K", "2K", "4K"].includes(imageSize) ? imageSize : "1K",
        },
      },
    });

    let imageUrl = "";
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? "image/png";
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
      }
    }

    if (!imageUrl) {
      res.status(502).json({ error: "Nano-Banana 2.1 did not return an edited image." });
      return;
    }

    res.json({
      imageUrl,
      promptUsed: refinePrompt,
      modelUsed: "gemini-nano-banana-2.1",
    });
  } catch (error: any) {
    console.error("Error in /api/brand/refine:", error);
    const status = error?.status || 500;
    res.status(status).json({
      error: error?.message || "Failed to refine medium image.",
    });
  }
});

const PLOT_WITCH_VOICE_GUIDE = `You are the Caption & Content Calendar Assistant writing as "The Plot Witch" in Tasha L. Driver's Informative Voice. Follow this exact guide:

TASHA L. DRIVER / INFORMATIVE VOICE (Source-based reassessment • 8 October 2026)

The voice at its center:
- Tasha writes as a working writer explaining something she has had to figure out, usually because other writers are running into the same problem. She addresses the reader directly, makes her position clear, and spends enough time on the explanation for the advice to become usable. Her personality comes through in what she notices, the examples she chooses, and the small comments she makes while teaching.
- The strongest description is practical, opinionated, conversational, and mischievous. She can be blunt without maintaining a hostile posture. She can sound knowledgeable while admitting that she procrastinates, overuses a word, or needs a system to keep herself on track. That combination gives the reader both direction and company.

The most important recalibration:
- Lead with useful explanation. Let attitude emerge where the subject gives Tasha a reason to have an opinion. A draft can be direct and unmistakably hers without sounding angry, jaded, or determined to produce a quotable insult.
- Use the slightly witchy Plot Witch identity as a light present-day adaptation (like distraction fairies), NOT turning every writing task into a spell, ritual, potion, or exorcism. The craft knowledge and conversational personality should carry the page.
- Current instructions from Tasha: developed prose paragraphs, no choppy succession of one-sentence paragraphs, organic emphasis, a slightly witchy brand voice, and writing that does the explanatory work.

How the explanation develops:
- Begin with a recognizable problem.
- Define enough to make the next point understandable, returning to a scene, a reader's experience, or an action the writer can take.
- Connect advice to its consequence.
- Give a specific demonstration or concrete scenario (down to index cards, visible names, divider tabs, and where to put the outline).
- Include the relevant exception where appropriate.
- Finish with application—a practical next step so the reader leaves knowing what to look for or what to do. Avoid appending a motivational conclusion after the useful ending has already happened.

The relationship with the reader:
- Use "you" when the reader is doing something and "I" when Tasha is describing her own practice, experience, or judgment. "We" can acknowledge a shared writing habit when earned.
- Assume the reader can understand the subject once it is explained. Give clear directions without wrapping each one in encouragement or qualification.

Sentence movement, paragraph shape, and word choice:
- Build paragraphs around a developed thought. Do not isolate each sentence to manufacture emphasis.
- Vary sentence length according to the work. Use natural contractions and ordinary connective language. Use parentheses for a brief side comment that earns its place.
- Prefer the thing the reader can picture or act on. Avoid padding an ordinary point with claims of transformation, empowerment, mastery, or revolutionary potential.
- Allow self-directed humor and practical opinion.

HASHTAG RESEARCH & HONESTY RULES (CRITICAL):
1. Use Google Search grounding to select 1 to 3 relevant hashtags from your search results.
2. Each hashtag needs a post count between 850,000 and 1,500,000.
3. Show the count found beside each tag in countText (e.g., "1,180,000 posts found in search").
4. STRICT HONESTY RULE: When you cannot verify a count from search results, say so beside the tag instead of inventing a number (e.g., "Count not verified in search results").

AI-GENERATED CONTENT NOTE RULE (CRITICAL):
Add a short AI-generated content note to captions for AI-generated images (e.g., "AI Content Note: Product scene visual generated with AI from our studio master image.").`;

function extractJsonFromText(rawText: string): any | null {
  if (!rawText) return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch?.[1]) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // continue
      }
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function runPlotWitchAssistant(params: {
  brandName: string;
  productName: string;
  productDescription: string;
  tagline?: string;
  weeklyAngle?: string;
  userMessage?: string;
  currentDraft?: any;
  chatHistory?: Array<{ role: "user" | "assistant"; text: string }>;
  customVoiceNotes?: string;
}) {
  const ai = getGenAIClient();

  const historyTranscript =
    params.chatHistory && params.chatHistory.length > 0
      ? params.chatHistory
          .map((m) => `${m.role === "user" ? "User" : "The Plot Witch"}: ${m.text}`)
          .join("\n")
      : "No prior chat turns.";

  const currentDraftContext = params.currentDraft
    ? `Current Social Caption:\n${params.currentDraft.socialCaption}\n\nCurrent Hashtags:\n${JSON.stringify(
        params.currentDraft.hashtags || []
      )}\n\nCurrent AI Content Note:\n${
        params.currentDraft.aiDisclosureNote || ""
      }\n\nCurrent Pinterest Title:\n${
        params.currentDraft.pinterestTitle
      }\n\nCurrent Pinterest Description:\n${params.currentDraft.pinterestDescription}`
    : "No current draft yet—create the initial draft.";

  const prompt = `Use Google Search to research live hashtag post counts (targeting 1 to 3 relevant tags with 850,000 to 1,500,000 posts; if a tag's post count cannot be verified in live search results, explicitly report "Count not verified in search results" instead of inventing a number).

Brand: ${params.brandName || "The Plot Witch"}
Product: ${params.productName}
Product Details: ${params.productDescription}
Tagline: ${params.tagline || ""}
Weekly Focus / Topic: ${params.weeklyAngle || "Practical writing workflow and studio desk setup"}
${params.customVoiceNotes ? `Additional Voice Guide Notes: ${params.customVoiceNotes}` : ""}

Current Panel Text State:
${currentDraftContext}

Conversation History:
${historyTranscript}

Latest Request:
${
  params.userMessage
    ? `The user says: "${params.userMessage}". Revise the social caption, hashtags, or Pinterest pin text in place as requested, following the Tasha L. Driver Informative Voice Guide, and write a brief, helpful reply.`
    : "Draft the social caption (in Tasha L. Driver's Informative Voice as The Plot Witch—developed prose paragraph, recognizable writer problem, concrete example, and practical next step), select 1-3 researched hashtags (showing the post count between 850,000 and 1,500,000 if verified in search results, or explicitly stating 'Count not verified in search results' if not verified), add a short AI-generated content note for the AI-generated scene images, and draft the Pinterest pin title and description."
}

Return ONLY a valid JSON object matching this exact structure (no extra markdown outside JSON):
{
  "assistantReply": "Short reply to the user explaining what you drafted or updated, in Tasha's practical, conversational Plot Witch voice.",
  "socialCaption": "The social caption body written in Tasha L. Driver's Informative Voice, followed by the 1-3 hashtags and the short AI-generated content note at the bottom.",
  "hashtags": [
    {
      "tag": "#exampletag",
      "countText": "1,150,000 posts (verified in search) OR Count not verified in search results",
      "verified": true
    }
  ],
  "aiDisclosureNote": "Short AI-generated content note (e.g. 'AI Content Note: Product scene visual generated with AI from our studio master image.')",
  "pinterestTitle": "Clear search-friendly Pinterest pin title under 90 characters",
  "pinterestDescription": "2-3 sentence Pinterest pin description in Tasha L. Driver's practical, informative Plot Witch voice"
}`;

  const systemInstruction = PLOT_WITCH_VOICE_GUIDE;

  let response: any = null;
  let modelUsed = "gemini-4-argon";

  try {
    response = await ai.models.generateContent({
      model: "gemini-4-argon",
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });
  } catch (argonError: any) {
    console.warn("gemini-4-argon failed, falling back to gemini-3.8-flash:", argonError?.message);
    modelUsed = "gemini-3.8-flash";
    response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      },
    });
  }

  const rawText = response?.text || "";
  const parsed = extractJsonFromText(rawText);

  const groundingChunks =
    response?.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const searchSources = groundingChunks
    .map((chunk: any) =>
      chunk?.web?.uri
        ? {
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          }
        : null
    )
    .filter(Boolean);

  const defaultAiNote =
    "AI Content Note: Product scene visual generated with AI from our studio master image.";

  const fallbackHashtags = [
    {
      tag: "#writingprompts",
      countText: "Count not verified in search results",
      verified: false,
    },
    {
      tag: "#bookstagramfeature",
      countText: "Count not verified in search results",
      verified: false,
    },
  ];

  const hashtags =
    Array.isArray(parsed?.hashtags) && parsed.hashtags.length > 0
      ? parsed.hashtags.slice(0, 3).map((h: any) => ({
          tag: String(h?.tag || "#theplotwitch").startsWith("#")
            ? String(h.tag)
            : `#${String(h?.tag || "theplotwitch")}`,
          countText:
            typeof h?.countText === "string" && h.countText.trim()
              ? h.countText.trim()
              : "Count not verified in search results",
          verified: Boolean(h?.verified),
        }))
      : fallbackHashtags;

  const aiDisclosureNote =
    typeof parsed?.aiDisclosureNote === "string" && parsed.aiDisclosureNote.trim()
      ? parsed.aiDisclosureNote.trim()
      : defaultAiNote;

  let socialCaption =
    typeof parsed?.socialCaption === "string" && parsed.socialCaption.trim()
      ? parsed.socialCaption.trim()
      : `${params.productName} at the desk. ${params.productDescription}\n\n${hashtags
          .map((h: any) => h.tag)
          .join(" ")}\n\n${aiDisclosureNote}`;

  if (
    !socialCaption.toLowerCase().includes("ai") &&
    !socialCaption.includes(aiDisclosureNote)
  ) {
    socialCaption = `${socialCaption}\n\n${aiDisclosureNote}`;
  }

  return {
    assistantReply:
      parsed?.assistantReply ||
      "Updated your social caption, researched hashtag counts, and refreshed the Pinterest pin text in Tasha L. Driver's Informative Voice.",
    socialCaption,
    hashtags,
    aiDisclosureNote,
    pinterestTitle:
      parsed?.pinterestTitle ||
      `${params.productName} | ${params.brandName} Studio Desk`,
    pinterestDescription:
      parsed?.pinterestDescription ||
      `Keep your drafting notes organized with the ${params.productName} from ${params.brandName}. ${params.productDescription}`,
    modelUsed,
    searchSources,
  };
}

/**
 * POST /api/brand/copy
 */
app.post("/api/brand/copy", async (req, res) => {
  try {
    const {
      brandName = "The Plot Witch",
      productName,
      productDescription,
      tagline,
      weeklyAngle = "",
      customVoiceNotes = "",
    } = req.body;

    if (!productName && !productDescription) {
      res.status(400).json({ error: "Product name or description is required to draft copy." });
      return;
    }

    const result = await runPlotWitchAssistant({
      brandName,
      productName,
      productDescription,
      tagline,
      weeklyAngle,
      customVoiceNotes,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error in /api/brand/copy:", error);
    const status = error?.status || 500;
    res.status(status).json({
      error: error?.message || "Could not draft product copy.",
    });
  }
});

/**
 * POST /api/brand/assistant
 */
app.post("/api/brand/assistant", async (req, res) => {
  try {
    const {
      brandName = "The Plot Witch",
      productName,
      productDescription,
      tagline,
      weeklyAngle = "",
      userMessage = "",
      currentDraft,
      chatHistory = [],
      customVoiceNotes = "",
    } = req.body;

    const result = await runPlotWitchAssistant({
      brandName,
      productName,
      productDescription,
      tagline,
      weeklyAngle,
      userMessage,
      currentDraft,
      chatHistory,
      customVoiceNotes,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error in /api/brand/assistant:", error);
    const status = error?.status || 500;
    res.status(status).json({
      error: error?.message || "Assistant could not complete the revision.",
    });
  }
});

/**
 * POST /api/brand/calendar-propose
 */
app.post("/api/brand/calendar-propose", async (req, res) => {
  try {
    const {
      brandName = "The Plot Witch",
      productId = "plot-witch-default",
      productName = "Hardcover Journal",
      productDescription = "",
      startDate = "2026-11-08",
      weeklyFocus = "",
    } = req.body;

    const ai = getGenAIClient();

    const prompt = `Use Google Search to research live hashtag post counts (selecting 1-3 hashtags per post targeting 850,000 to 1,500,000 posts; when a post count cannot be verified in live search results, state "Count not verified in search results" instead of inventing a number).

Propose a 5-post weekly content schedule starting on ${startDate} for this product:
Brand: ${brandName}
Product ID: ${productId}
Product Name: ${productName}
Product Description: ${productDescription}
${weeklyFocus ? `Weekly Focus / Theme: ${weeklyFocus}` : ""}

Write every caption and Pinterest description in Tasha L. Driver's Informative Voice (8 October 2026 Voice Guide): practical, opinionated, conversational, mischievous, developed prose paragraphs, addressing a recognizable writing problem with a concrete example and a usable next step.

Distribute the 5 posts across these 5 platform sizes:
1. "Etsy Listing" (mediumId: "etsy_listing")
2. "Instagram Portrait" (mediumId: "instagram_portrait")
3. "Square" (mediumId: "square")
4. "TikTok Cover" (mediumId: "tiktok_reel_cover")
5. "Pinterest Pin" (mediumId: "pinterest_pin")

Return ONLY a valid JSON object matching this exact structure:
{
  "assistantSummary": "Short note in Tasha's voice explaining the week's 5-post angle.",
  "proposals": [
    {
      "date": "YYYY-MM-DD",
      "platform": "Instagram Portrait",
      "mediumId": "instagram_portrait",
      "shortNote": "Concise 1-sentence angle for the calendar card",
      "socialCaption": "Full social caption in Tasha L. Driver's Informative Voice, including 1-3 hashtags and the short AI-generated content note at the end.",
      "hashtags": [
        {
          "tag": "#writingprompts",
          "countText": "1,240,000 posts (verified in search) OR Count not verified in search results",
          "verified": true
        }
      ],
      "aiDisclosureNote": "AI Content Note: Product scene visual generated with AI from our studio master image.",
      "pinterestTitle": "Search-friendly Pinterest Pin Title",
      "pinterestDescription": "2-3 sentence practical Pinterest description in Tasha's Informative Voice"
    }
  ]
}`;

    let response: any = null;
    let modelUsed = "gemini-4-argon";

    try {
      response = await ai.models.generateContent({
        model: "gemini-4-argon",
        contents: prompt,
        config: {
          systemInstruction: PLOT_WITCH_VOICE_GUIDE,
          tools: [{ googleSearch: {} }],
        },
      });
    } catch (argonError: any) {
      console.warn("gemini-4-argon failed in calendar-propose, falling back to gemini-3.8-flash:", argonError?.message);
      modelUsed = "gemini-3.8-flash";
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: PLOT_WITCH_VOICE_GUIDE,
          tools: [{ googleSearch: {} }],
        },
      });
    }

    const parsed = extractJsonFromText(response?.text || "");
    const baseDate = new Date(`${startDate}T12:00:00`);
    const validPlatforms = [
      { platform: "Instagram Portrait", mediumId: "instagram_portrait" },
      { platform: "Pinterest Pin", mediumId: "pinterest_pin" },
      { platform: "Etsy Listing", mediumId: "etsy_listing" },
      { platform: "Square", mediumId: "square" },
      { platform: "TikTok Cover", mediumId: "tiktok_reel_cover" },
    ];

    const rawProposals = Array.isArray(parsed?.proposals) && parsed.proposals.length > 0
      ? parsed.proposals.slice(0, 7)
      : validPlatforms.map((vp, idx) => {
          const d = new Date(baseDate);
          d.setDate(d.getDate() + idx);
          const dateStr = d.toISOString().slice(0, 10);
          return {
            date: dateStr,
            platform: vp.platform,
            mediumId: vp.mediumId,
            shortNote: `${productName}: practical setup for chapter planning (${vp.platform})`,
            socialCaption: `When you sit down to work on a draft, having a concrete place for scene notes keeps you from wandering off into twenty browser tabs. I use the ${productName} to keep the current chapter outline right in front of me so the next scene decision is obvious.\n\n#writingprompts #bookishfeatures\n\nAI Content Note: Product scene visual generated with AI from our studio master image.`,
            hashtags: [
              {
                tag: "#writingprompts",
                countText: "Count not verified in search results",
                verified: false,
              },
              {
                tag: "#bookishfeatures",
                countText: "Count not verified in search results",
                verified: false,
              },
            ],
            aiDisclosureNote:
              "AI Content Note: Product scene visual generated with AI from our studio master image.",
            pinterestTitle: `${productName} | ${brandName} Writing Setup`,
            pinterestDescription: `Practical novel planning and desk organization with the ${productName} from ${brandName}.`,
          };
        });

    const normalizedProposals = rawProposals.map((item: any, idx: number) => {
      const fallbackVp = validPlatforms[idx % validPlatforms.length];
      const d = new Date(baseDate);
      d.setDate(d.getDate() + idx);
      const fallbackDate = d.toISOString().slice(0, 10);

      const aiNote =
        item?.aiDisclosureNote ||
        "AI Content Note: Product scene visual generated with AI from our studio master image.";

      const tags =
        Array.isArray(item?.hashtags) && item.hashtags.length > 0
          ? item.hashtags.slice(0, 3).map((h: any) => ({
              tag: String(h?.tag || "#writingprompts").startsWith("#")
                ? String(h.tag)
                : `#${String(h?.tag || "writingprompts")}`,
              countText:
                typeof h?.countText === "string" && h.countText.trim()
                  ? h.countText.trim()
                  : "Count not verified in search results",
              verified: Boolean(h?.verified),
            }))
          : [
              {
                tag: "#writingprompts",
                countText: "Count not verified in search results",
                verified: false,
              },
            ];

      let caption =
        typeof item?.socialCaption === "string" && item.socialCaption.trim()
          ? item.socialCaption.trim()
          : `${productName}: ${item?.shortNote || "Practical writing setup."}\n\n${tags
              .map((t: any) => t.tag)
              .join(" ")}\n\n${aiNote}`;

      if (!caption.toLowerCase().includes("ai") && !caption.includes(aiNote)) {
        caption = `${caption}\n\n${aiNote}`;
      }

      return {
        id: `proposal-${Date.now()}-${idx}`,
        date:
          typeof item?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
            ? item.date
            : fallbackDate,
        platform: item?.platform || fallbackVp.platform,
        mediumId: item?.mediumId || fallbackVp.mediumId,
        productId,
        productName,
        shortNote:
          item?.shortNote ||
          `${productName} feature for ${item?.platform || fallbackVp.platform}`,
        status: "drafted",
        copyDraft: {
          socialCaption: caption,
          hashtags: tags,
          aiDisclosureNote: aiNote,
          pinterestTitle:
            item?.pinterestTitle || `${productName} | ${brandName}`,
          pinterestDescription:
            item?.pinterestDescription ||
            `Practical writing workflow with the ${productName} from ${brandName}.`,
          modelUsed,
        },
      };
    });

    res.json({
      assistantSummary:
        parsed?.assistantSummary ||
        `Proposed ${normalizedProposals.length} scheduled posts for ${productName} in Tasha L. Driver's Informative Voice. Review, edit, or approve each post below before it lands on your calendar.`,
      proposals: normalizedProposals,
      modelUsed,
    });
  } catch (error: any) {
    console.error("Error in /api/brand/calendar-propose:", error);
    const status = error?.status || 500;
    res.status(status).json({
      error: error?.message || "Could not propose weekly calendar posts.",
    });
  }
});

async function startServer() {
  app.use("/src/assets", express.static(path.join(__dirname, "src/assets")));

  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.npm_lifecycle_event === "start" ||
    Boolean(process.env.K_SERVICE);

  if (!isProduction && fs.existsSync(path.join(__dirname, "vite.config.ts"))) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Brand Builder (The Plot Witch Studio) running on http://0.0.0.0:${PORT} (Firestore boot connected: ${firestoreBootConnected})`
    );
  });
}

startServer();
