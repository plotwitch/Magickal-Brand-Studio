import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  RefreshCw,
  Upload,
  Check,
  Lock,
  Unlock,
  AlertCircle,
  Download,
  Sliders,
  Trash2,
  BookmarkCheck,
  Plus,
  Hand,
  UserCheck,
  Package,
  Layers,
  LayoutGrid,
  ShieldCheck,
  Calendar as CalendarIcon,
  Archive,
  Copy,
  RotateCcw,
} from "lucide-react";
import {
  AssetCopyDraft,
  AssistantChatMessage,
  BrandBrief,
  BrandPreset,
  CanonicalProductSpec,
  GeneratedMediumShot,
  HumanPresenceMode,
  ImageResolutionOption,
  MediumDefinition,
  SavedProductListing,
  ScheduledPost,
  ScheduledPostStatus,
  WorkMode,
} from "./types/brand";
import {
  BUILTIN_BRAND_PRESETS,
  CAMPAIGN_MEDIUMS,
  DEFAULT_PLOT_WITCH_PRESET,
  INITIAL_ANCHOR_IMAGE,
  INITIAL_CANONICAL_SPEC,
  INITIAL_COPY_DRAFT,
  INITIAL_MEDIUM_SHOTS,
  INITIAL_SAVED_LISTINGS,
  INITIAL_SCHEDULED_POSTS,
  INITIAL_SHOWCASE_BRIEF,
  PRODUCT_BRIEF_TEMPLATES,
  WEEKLY_ASSET_MEDIUM_IDS,
} from "./data/campaignPresets";
import { MediumCard } from "./components/MediumCard";
import { LightboxModal } from "./components/LightboxModal";
import { AssetCopyPanel } from "./components/AssetCopyPanel";
import { ContentCalendarPanel } from "./components/ContentCalendarPanel";
import { PasswordGateScreen } from "./components/PasswordGateScreen";
import { TarotCircuitCorner, TarotCircuitDivider } from "./components/TarotCircuitOrnament";
import {
  downloadExactSizedImage,
  renderImageAtExactDimensions,
} from "./utils/imageExport";
import {
  exportBrandBuilderBackupZip,
  parseBrandBuilderBackupZip,
} from "./utils/zipBackup";

const SESSION_TOKEN_STORAGE_KEY = "plot_witch_session_token_v1";

export default function App() {
  // Single-Password Gate State (only the unlocked session token is stored in the browser)
  const [authToken, setAuthToken] = useState<string>(() => {
    try {
      return localStorage.getItem(SESSION_TOKEN_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(true);

  // Database Connection Status ("Data: shared and saved" | "Data: not connected")
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [backupToast, setBackupToast] = useState<string | null>(null);

  // Work Mode: "campaign" | "asset" | "calendar"
  const [workMode, setWorkMode] = useState<WorkMode>("campaign");

  // Shared Server-Side Application State (Firestore)
  const [savedPresets, setSavedPresets] = useState<BrandPreset[]>(BUILTIN_BRAND_PRESETS);
  const [activeBrandPreset, setActiveBrandPreset] = useState<BrandPreset>(DEFAULT_PLOT_WITCH_PRESET);
  const [savedListings, setSavedListings] = useState<SavedProductListing[]>(INITIAL_SAVED_LISTINGS);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(INITIAL_SCHEDULED_POSTS);

  const [activeScheduledPostId, setActiveScheduledPostId] = useState<string | null>(null);
  const [isProposingWeek, setIsProposingWeek] = useState<boolean>(false);
  const [proposalSummary, setProposalSummary] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [isRestoringZip, setIsRestoringZip] = useState<boolean>(false);

  const [presetSaveToast, setPresetSaveToast] = useState<string | null>(null);
  const [listingSaveToast, setListingSaveToast] = useState<string | null>(null);

  // Campaign / Asset State
  const [activeTemplateId, setActiveTemplateId] = useState<string>("plot-witch-default");
  const [brief, setBrief] = useState<BrandBrief>(INITIAL_SHOWCASE_BRIEF);
  const [canonicalSpec, setCanonicalSpec] = useState<CanonicalProductSpec>(INITIAL_CANONICAL_SPEC);
  const [anchorImageUrl, setAnchorImageUrl] = useState<string>(INITIAL_ANCHOR_IMAGE);
  const [isAnchorApproved, setIsAnchorApproved] = useState<boolean>(true);
  const [approvalSealKey, setApprovalSealKey] = useState<number>(1);
  const [mediumShots, setMediumShots] = useState<Record<string, GeneratedMediumShot>>(INITIAL_MEDIUM_SHOTS);

  // Asset & Calendar Copy & Assistant State
  const [copyDraft, setCopyDraft] = useState<AssetCopyDraft>(INITIAL_COPY_DRAFT);
  const [isDraftingCopy, setIsDraftingCopy] = useState<boolean>(false);
  const [isAssistantWorking, setIsAssistantWorking] = useState<boolean>(false);
  const [assistantChatHistory, setAssistantChatHistory] = useState<AssistantChatMessage[]>([
    {
      id: "initial-assistant-msg",
      role: "assistant",
      text: "Ready at the desk. I am using the Tasha L. Driver Informative Voice Guide (8 Oct 2026) and Google Search grounding to research 1–3 hashtags (850,000–1,500,000 posts) and draft your social captions, Pinterest pin text, and weekly calendar proposals.",
      timestamp: "Studio Ready",
    },
  ]);
  const [assetAnchorSource, setAssetAnchorSource] = useState<"saved" | "fresh">("saved");
  const [assetCopiedField, setAssetCopiedField] = useState<"social" | "pinTitle" | "pinDesc" | null>(null);

  const [selectedMediumIds, setSelectedMediumIds] = useState<string[]>(
    CAMPAIGN_MEDIUMS.filter((m) => m.defaultEnabled).map((m) => m.id)
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [isGeneratingAnchor, setIsGeneratingAnchor] = useState<boolean>(false);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState<boolean>(false);
  const [isRefiningMedium, setIsRefiningMedium] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isEditingSpec, setIsEditingSpec] = useState<boolean>(false);

  const [inspectedMedium, setInspectedMedium] = useState<MediumDefinition | null>(null);
  const productFileInputRef = useRef<HTMLInputElement | null>(null);
  const characterFileInputRef = useRef<HTMLInputElement | null>(null);
  const restoreBackupInputRef = useRef<HTMLInputElement | null>(null);

  // Keep a ref to latest state so debounced/immediate saves always send the complete snapshot
  const stateRef = useRef({
    activePresetId: activeBrandPreset.id,
    activeTemplateId,
    isAnchorApproved,
    brief,
    canonicalSpec,
    anchorImageUrl,
    mediumShots,
    copyDraft,
    savedPresets,
    savedListings,
    scheduledPosts,
  });

  useEffect(() => {
    stateRef.current = {
      activePresetId: activeBrandPreset.id,
      activeTemplateId,
      isAnchorApproved,
      brief,
      canonicalSpec,
      anchorImageUrl,
      mediumShots,
      copyDraft,
      savedPresets,
      savedListings,
      scheduledPosts,
    };
  }, [
    activeBrandPreset.id,
    activeTemplateId,
    isAnchorApproved,
    brief,
    canonicalSpec,
    anchorImageUrl,
    mediumShots,
    copyDraft,
    savedPresets,
    savedListings,
    scheduledPosts,
  ]);

  const getAuthHeaders = (tokenOverride?: string): Record<string, string> => {
    const t = tokenOverride ?? authToken;
    return {
      "Content-Type": "application/json",
      ...(t ? { "x-app-auth-token": t } : {}),
    };
  };

  /**
   * Saves any state change immediately to the hosted Firestore database on the server.
   */
  const saveStateToDatabase = async (
    overrides: Partial<typeof stateRef.current> = {},
    tokenOverride?: string
  ): Promise<boolean> => {
    const tokenToUse = tokenOverride ?? authToken;
    if (!tokenToUse) return false;

    const payload = {
      ...stateRef.current,
      ...overrides,
    };

    try {
      const res = await fetch("/api/brand/state", {
        method: "POST",
        headers: getAuthHeaders(tokenToUse),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setDbConnected(true);
        return true;
      } else {
        setDbConnected(false);
        return false;
      }
    } catch {
      setDbConnected(false);
      return false;
    }
  };

  // Verify saved session token on startup
  useEffect(() => {
    let cancelled = false;
    async function checkSavedSession() {
      // Remove any legacy browser-storage data keys from earlier steps
      try {
        localStorage.removeItem("plot_witch_brand_presets_v2");
        localStorage.removeItem("plot_witch_active_preset_id_v2");
        localStorage.removeItem("plot_witch_saved_listings_v1");
        localStorage.removeItem("plot_witch_scheduled_posts_v1");
      } catch {
        // ignore
      }

      if (!authToken) {
        if (!cancelled) {
          setIsUnlocked(false);
          setIsCheckingSession(false);
        }
        return;
      }
      try {
        const res = await fetch("/api/auth/session", {
          headers: { "x-app-auth-token": authToken },
        });
        if (!cancelled) {
          if (res.ok) {
            setIsUnlocked(true);
          } else {
            setIsUnlocked(false);
            try {
              localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        if (!cancelled) {
          setIsUnlocked(false);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    }
    checkSavedSession();
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  // Load shared data from hosted Firestore when the app opens (after password gate check)
  useEffect(() => {
    if (!isUnlocked || !authToken) return;
    let cancelled = false;

    async function loadSharedFirestoreData() {
      try {
        const res = await fetch("/api/brand/state", {
          headers: { "x-app-auth-token": authToken },
        });
        if (!res.ok) {
          if (!cancelled) setDbConnected(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (data.connected) {
          setDbConnected(true);
        } else {
          setDbConnected(false);
          return;
        }

        if (data.exists && data.state) {
          const st = data.state;

          if (Array.isArray(st.savedPresets) && st.savedPresets.length > 0) {
            setSavedPresets(st.savedPresets);
            const foundPreset =
              st.savedPresets.find((p: BrandPreset) => p.id === st.activePresetId) ||
              st.savedPresets[0];
            if (foundPreset) {
              setActiveBrandPreset(foundPreset);
            }
          }

          if (st.activeTemplateId) {
            setActiveTemplateId(st.activeTemplateId);
          }
          if (typeof st.isAnchorApproved === "boolean") {
            setIsAnchorApproved(st.isAnchorApproved);
          }
          if (st.brief && st.brief.productName) {
            setBrief(st.brief);
          }
          if (st.canonicalSpec && st.canonicalSpec.canonicalObjectDescription) {
            setCanonicalSpec(st.canonicalSpec);
          }
          if (st.anchorImageUrl) {
            setAnchorImageUrl(st.anchorImageUrl);
          }
          if (st.mediumShots && Object.keys(st.mediumShots).length > 0) {
            setMediumShots(st.mediumShots);
          }
          if (st.copyDraft && st.copyDraft.socialCaption) {
            setCopyDraft(st.copyDraft);
          }
          if (Array.isArray(st.savedListings) && st.savedListings.length > 0) {
            setSavedListings(st.savedListings);
          }
          if (Array.isArray(st.scheduledPosts) && st.scheduledPosts.length > 0) {
            setScheduledPosts(st.scheduledPosts);
          }
        } else {
          // Seed initial shared state into Firestore on first boot
          await saveStateToDatabase({}, authToken);
        }
      } catch {
        if (!cancelled) setDbConnected(false);
      }
    }

    loadSharedFirestoreData();
    return () => {
      cancelled = true;
    };
  }, [isUnlocked, authToken]);

  // Sync dynamic heading & body font variables from active Brand Preset
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--font-display",
      `'${activeBrandPreset.headingFont}', 'Cinzel', Georgia, serif`
    );
    document.documentElement.style.setProperty(
      "--font-sans",
      `'${activeBrandPreset.bodyFont}', 'Plus Jakarta Sans', sans-serif`
    );
  }, [activeBrandPreset.headingFont, activeBrandPreset.bodyFont]);

  const handleUnlockSuccess = (token: string) => {
    setAuthToken(token);
    setIsUnlocked(true);
    try {
      localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
    } catch {
      // ignore
    }
  };

  const handleUpdateBriefAndSave = (nextBrief: BrandBrief, nextAnchorApproved?: boolean) => {
    setBrief(nextBrief);
    if (typeof nextAnchorApproved === "boolean") {
      setIsAnchorApproved(nextAnchorApproved);
    }
    saveStateToDatabase({
      brief: nextBrief,
      ...(typeof nextAnchorApproved === "boolean"
        ? { isAnchorApproved: nextAnchorApproved }
        : {}),
    });
  };

  const handleUpdateCanonicalSpecAndSave = (nextSpec: CanonicalProductSpec) => {
    setCanonicalSpec(nextSpec);
    saveStateToDatabase({ canonicalSpec: nextSpec });
  };

  const handleUpdateCopyDraft = (updated: AssetCopyDraft) => {
    setCopyDraft(updated);
    if (activeScheduledPostId) {
      const nextPosts = scheduledPosts.map((p) =>
        p.id === activeScheduledPostId ? { ...p, copyDraft: updated } : p
      );
      setScheduledPosts(nextPosts);
      saveStateToDatabase({
        copyDraft: updated,
        scheduledPosts: nextPosts,
      });
    } else {
      saveStateToDatabase({ copyDraft: updated });
    }
  };

  const handleSwitchWorkMode = (mode: WorkMode) => {
    setWorkMode(mode);
    setGlobalError(null);
    if (mode === "asset" && !activeScheduledPostId) {
      setSelectedMediumIds(WEEKLY_ASSET_MEDIUM_IDS);
    }
  };

  /**
   * Clicking a scheduled post on the Calendar opens Work Mode (Asset Mode) for that post
   */
  const handleOpenScheduledPostInAssetMode = (post: ScheduledPost) => {
    setGlobalError(null);
    setActiveScheduledPostId(post.id);

    const matchingListing =
      savedListings.find(
        (l) =>
          l.id === post.productId ||
          l.brief.productName.toLowerCase() === post.productName.toLowerCase()
      ) || savedListings[0];

    let nextBrief = brief;
    let nextSpec = canonicalSpec;
    let nextAnchor = anchorImageUrl;
    let nextTemplateId = activeTemplateId;

    if (matchingListing) {
      nextTemplateId = matchingListing.id;
      nextBrief = {
        ...matchingListing.brief,
        brandName: activeBrandPreset.brandName,
        productName: post.productName || matchingListing.brief.productName,
      };
      nextSpec = matchingListing.canonicalSpec;
      nextAnchor = matchingListing.savedAnchorUrl;
      setActiveTemplateId(nextTemplateId);
      setBrief(nextBrief);
      setCanonicalSpec(nextSpec);
      setAnchorImageUrl(nextAnchor);
      setIsAnchorApproved(true);
      setApprovalSealKey((prev) => prev + 1);
      setAssetAnchorSource("saved");
    } else {
      nextBrief = {
        ...brief,
        productName: post.productName,
      };
      setBrief(nextBrief);
    }

    const orderedIds = [
      post.mediumId,
      ...WEEKLY_ASSET_MEDIUM_IDS.filter((id) => id !== post.mediumId),
    ];
    setSelectedMediumIds(orderedIds);

    const nextCopy: AssetCopyDraft = {
      ...INITIAL_COPY_DRAFT,
      ...post.copyDraft,
    };
    setCopyDraft(nextCopy);

    saveStateToDatabase({
      activeTemplateId: nextTemplateId,
      brief: nextBrief,
      canonicalSpec: nextSpec,
      anchorImageUrl: nextAnchor,
      isAnchorApproved: true,
      copyDraft: nextCopy,
    });

    setWorkMode("asset");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddScheduledPost = (newPost: ScheduledPost) => {
    const updated = [...scheduledPosts, newPost];
    setScheduledPosts(updated);
    saveStateToDatabase({ scheduledPosts: updated });
  };

  const handleUpdateScheduledPost = (updatedPost: ScheduledPost) => {
    const updated = scheduledPosts.map((p) =>
      p.id === updatedPost.id ? updatedPost : p
    );
    setScheduledPosts(updated);
    saveStateToDatabase({ scheduledPosts: updated });
  };

  const handleDeleteScheduledPost = (postId: string) => {
    const updated = scheduledPosts.filter((p) => p.id !== postId);
    if (activeScheduledPostId === postId) {
      setActiveScheduledPostId(null);
    }
    setScheduledPosts(updated);
    saveStateToDatabase({ scheduledPosts: updated });
  };

  const handleProposeWeekOfPosts = async (params: {
    productId: string;
    startDate: string;
    weeklyFocus: string;
  }): Promise<ScheduledPost[]> => {
    setIsProposingWeek(true);
    setProposalSummary(null);
    try {
      const listing =
        savedListings.find((l) => l.id === params.productId) || savedListings[0];
      const response = await fetch("/api/brand/calendar-propose", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          brandName: activeBrandPreset.brandName,
          productId: listing?.id || params.productId,
          productName: listing?.brief.productName || brief.productName,
          productDescription:
            listing?.brief.productDescription || brief.productDescription,
          startDate: params.startDate,
          weeklyFocus: params.weeklyFocus,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not propose weekly schedule.");
      }
      if (data.assistantSummary) {
        setProposalSummary(data.assistantSummary);
      }
      return Array.isArray(data.proposals) ? data.proposals : [];
    } catch (err: any) {
      setGlobalError(err?.message || "Could not propose weekly schedule.");
      return [];
    } finally {
      setIsProposingWeek(false);
    }
  };

  /**
   * Backup Export: "Download backup"
   */
  const handleDownloadBackup = async () => {
    if (isExportingZip) return;
    setIsExportingZip(true);
    try {
      await exportBrandBuilderBackupZip({
        activePresetId: activeBrandPreset.id,
        activeTemplateId,
        isAnchorApproved,
        activeBrandPreset,
        savedPresets,
        savedListings,
        scheduledPosts,
        brief,
        canonicalSpec,
        anchorImageUrl,
        mediumShots,
        copyDraft,
      });
      setBackupToast("Backup downloaded.");
      setTimeout(() => setBackupToast(null), 3000);
    } finally {
      setIsExportingZip(false);
    }
  };

  /**
   * Backup Import: "Restore backup"
   */
  const handleRestoreBackupFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsRestoringZip(true);
    setGlobalError(null);

    try {
      const restored = await parseBrandBuilderBackupZip(file);

      const nextPresets =
        restored.savedPresets && restored.savedPresets.length > 0
          ? restored.savedPresets
          : savedPresets;
      const nextActivePreset =
        restored.activeBrandPreset ||
        nextPresets.find((p) => p.id === restored.activePresetId) ||
        activeBrandPreset;
      const nextListings =
        restored.savedListings && restored.savedListings.length > 0
          ? restored.savedListings
          : savedListings;
      const nextPosts =
        restored.scheduledPosts && restored.scheduledPosts.length > 0
          ? restored.scheduledPosts
          : scheduledPosts;
      const nextBrief = restored.brief || brief;
      const nextSpec = restored.canonicalSpec || canonicalSpec;
      const nextAnchor = restored.anchorImageUrl || anchorImageUrl;
      const nextMediums = restored.mediumShots || mediumShots;
      const nextCopy = restored.copyDraft || copyDraft;
      const nextTemplateId = restored.activeTemplateId || activeTemplateId;
      const nextApproved =
        typeof restored.isAnchorApproved === "boolean"
          ? restored.isAnchorApproved
          : isAnchorApproved;

      setSavedPresets(nextPresets);
      setActiveBrandPreset(nextActivePreset);
      setSavedListings(nextListings);
      setScheduledPosts(nextPosts);
      setBrief(nextBrief);
      setCanonicalSpec(nextSpec);
      setAnchorImageUrl(nextAnchor);
      setMediumShots(nextMediums);
      setCopyDraft(nextCopy);
      setActiveTemplateId(nextTemplateId);
      setIsAnchorApproved(nextApproved);

      await saveStateToDatabase({
        activePresetId: nextActivePreset.id,
        activeTemplateId: nextTemplateId,
        isAnchorApproved: nextApproved,
        brief: nextBrief,
        canonicalSpec: nextSpec,
        anchorImageUrl: nextAnchor,
        mediumShots: nextMediums,
        copyDraft: nextCopy,
        savedPresets: nextPresets,
        savedListings: nextListings,
        scheduledPosts: nextPosts,
      });

      setBackupToast("Backup restored and saved to Firestore.");
      setTimeout(() => setBackupToast(null), 3500);
    } catch (err: any) {
      setGlobalError(err?.message || "Could not restore backup file.");
    } finally {
      setIsRestoringZip(false);
      if (restoreBackupInputRef.current) {
        restoreBackupInputRef.current.value = "";
      }
    }
  };

  const handleApproveMasterAnchor = () => {
    setIsAnchorApproved(true);
    setApprovalSealKey((prev) => prev + 1);
    saveStateToDatabase({ isAnchorApproved: true });
  };

  const handleUnlockMasterAnchor = () => {
    setIsAnchorApproved(false);
    saveStateToDatabase({ isAnchorApproved: false });
  };

  const handleUpdateActivePresetField = (updatedPreset: BrandPreset) => {
    setActiveBrandPreset(updatedPreset);
    const updatedList = savedPresets.some((p) => p.id === updatedPreset.id)
      ? savedPresets.map((p) => (p.id === updatedPreset.id ? updatedPreset : p))
      : [...savedPresets, updatedPreset];
    setSavedPresets(updatedList);
    const nextBrief = { ...brief, brandName: updatedPreset.brandName };
    setBrief(nextBrief);
    saveStateToDatabase({
      activePresetId: updatedPreset.id,
      savedPresets: updatedList,
      brief: nextBrief,
    });
  };

  const handleSaveBrandPreset = () => {
    const updatedList = savedPresets.some((p) => p.id === activeBrandPreset.id)
      ? savedPresets.map((p) => (p.id === activeBrandPreset.id ? activeBrandPreset : p))
      : [...savedPresets, activeBrandPreset];

    setSavedPresets(updatedList);
    const nextBrief = { ...brief, brandName: activeBrandPreset.brandName };
    setBrief(nextBrief);
    saveStateToDatabase({
      activePresetId: activeBrandPreset.id,
      savedPresets: updatedList,
      brief: nextBrief,
    });
    setPresetSaveToast(`Saved "${activeBrandPreset.presetName}"`);
    setTimeout(() => setPresetSaveToast(null), 3000);
  };

  const handleCreateNewPreset = () => {
    const newId = `custom-preset-${Date.now()}`;
    const created: BrandPreset = {
      ...activeBrandPreset,
      id: newId,
      presetName: `${activeBrandPreset.brandName} Custom`,
    };
    const updatedList = [...savedPresets, created];
    setSavedPresets(updatedList);
    setActiveBrandPreset(created);
    saveStateToDatabase({
      activePresetId: created.id,
      savedPresets: updatedList,
    });
    setPresetSaveToast(`Saved "${created.presetName}"`);
    setTimeout(() => setPresetSaveToast(null), 3000);
  };

  const handleSelectBrandPreset = (presetId: string) => {
    const found = savedPresets.find((p) => p.id === presetId);
    if (!found) return;
    setActiveBrandPreset(found);
    const nextBrief = { ...brief, brandName: found.brandName };
    setBrief(nextBrief);
    saveStateToDatabase({
      activePresetId: found.id,
      brief: nextBrief,
    });
  };

  const handleSaveCurrentProductListing = () => {
    const listingId =
      activeTemplateId !== "custom"
        ? activeTemplateId
        : `listing-${brief.productName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;

    const newEntry: SavedProductListing = {
      id: listingId,
      label: brief.productName || "Saved Product",
      brief: { ...brief },
      canonicalSpec: { ...canonicalSpec },
      savedAnchorUrl: anchorImageUrl,
      defaultCopy: { ...copyDraft },
    };

    const updated = savedListings.some((item) => item.id === listingId)
      ? savedListings.map((item) => (item.id === listingId ? newEntry : item))
      : [...savedListings, newEntry];

    setSavedListings(updated);
    setActiveTemplateId(listingId);
    saveStateToDatabase({
      activeTemplateId: listingId,
      savedListings: updated,
    });
    setListingSaveToast(`Saved anchor for "${newEntry.label}"`);
    setTimeout(() => setListingSaveToast(null), 3000);
  };

  const handleSelectTemplate = (templateId: string) => {
    setGlobalError(null);
    setActiveTemplateId(templateId);

    const savedListing = savedListings.find((l) => l.id === templateId);
    if (savedListing) {
      const nextBrief = {
        ...savedListing.brief,
        brandName: activeBrandPreset.brandName,
      };
      setBrief(nextBrief);
      setCanonicalSpec(savedListing.canonicalSpec);
      setAnchorImageUrl(savedListing.savedAnchorUrl);
      setCopyDraft(savedListing.defaultCopy);
      setIsAnchorApproved(true);
      setApprovalSealKey((prev) => prev + 1);
      setAssetAnchorSource("saved");

      saveStateToDatabase({
        activeTemplateId: templateId,
        brief: nextBrief,
        canonicalSpec: savedListing.canonicalSpec,
        anchorImageUrl: savedListing.savedAnchorUrl,
        copyDraft: savedListing.defaultCopy,
        isAnchorApproved: true,
      });
      return;
    }

    const found = PRODUCT_BRIEF_TEMPLATES.find((t) => t.id === templateId);
    if (!found) return;

    const matchingBrandPreset = savedPresets.find((p) => p.id === templateId);
    if (matchingBrandPreset) {
      setActiveBrandPreset(matchingBrandPreset);
    }

    const nextBrief = {
      ...found.brief,
      brandName: matchingBrandPreset?.brandName || activeBrandPreset.brandName,
    };
    const nextSpec: CanonicalProductSpec = {
      canonicalObjectDescription: `${found.brief.productName}: ${found.brief.productDescription}`,
      silhouetteLock: found.brief.productName,
      surfaceMaterials: found.brief.colorPalette,
      labelTypographySpec: `Gold-foil display title reading '${matchingBrandPreset?.brandName || activeBrandPreset.brandName}'`,
      lightingSignature: found.brief.aestheticStyle,
    };

    setBrief(nextBrief);
    setCanonicalSpec(nextSpec);
    setIsAnchorApproved(false);

    saveStateToDatabase({
      activePresetId: matchingBrandPreset?.id || activeBrandPreset.id,
      activeTemplateId: templateId,
      brief: nextBrief,
      canonicalSpec: nextSpec,
      isAnchorApproved: false,
    });
  };

  const toggleMediumSelection = (id: string) => {
    setSelectedMediumIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleProductReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const nextBrief = {
          ...brief,
          uploadedReferenceDataUrl: reader.result as string,
        };
        handleUpdateBriefAndSave(nextBrief, false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCharacterReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        const nextBrief: BrandBrief = {
          ...brief,
          humanPresenceMode: "character_in_scene",
          characterReferenceDataUrl: reader.result as string,
        };
        handleUpdateBriefAndSave(nextBrief);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDraftCopy = async (weeklyAngle = "", customVoiceNotes = "") => {
    if (isDraftingCopy || isAssistantWorking) return;
    setIsDraftingCopy(true);
    try {
      const response = await fetch("/api/brand/copy", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          brandName: brief.brandName,
          productName: brief.productName,
          productDescription: brief.productDescription,
          tagline: brief.tagline,
          weeklyAngle,
          customVoiceNotes,
        }),
      });
      const data = await response.json();
      if (response.ok && data.socialCaption) {
        const nextDraft: AssetCopyDraft = {
          socialCaption: data.socialCaption,
          hashtags: data.hashtags || copyDraft.hashtags,
          aiDisclosureNote: data.aiDisclosureNote || copyDraft.aiDisclosureNote,
          pinterestTitle: data.pinterestTitle,
          pinterestDescription: data.pinterestDescription,
          modelUsed: data.modelUsed,
          searchSources: data.searchSources || [],
        };
        handleUpdateCopyDraft(nextDraft);
        if (data.assistantReply) {
          setAssistantChatHistory((prev) => [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text: data.assistantReply,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            },
          ]);
        }
      }
    } catch {
      // Keep current editable copy if request fails
    } finally {
      setIsDraftingCopy(false);
    }
  };

  const handleSendAssistantMessage = async (
    userMessage: string,
    weeklyAngle = "",
    customVoiceNotes = ""
  ) => {
    if (isAssistantWorking || isDraftingCopy) return;
    const userMsgObj: AssistantChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: userMessage,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const nextHistory = [...assistantChatHistory, userMsgObj];
    setAssistantChatHistory(nextHistory);
    setIsAssistantWorking(true);

    try {
      const response = await fetch("/api/brand/assistant", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          brandName: brief.brandName,
          productName: brief.productName,
          productDescription: brief.productDescription,
          tagline: brief.tagline,
          weeklyAngle,
          userMessage,
          currentDraft: copyDraft,
          chatHistory: nextHistory.map((m) => ({
            role: m.role,
            text: m.text,
          })),
          customVoiceNotes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Assistant could not update the text.");
      }

      if (data.socialCaption) {
        const nextDraft: AssetCopyDraft = {
          socialCaption: data.socialCaption,
          hashtags: data.hashtags || copyDraft.hashtags,
          aiDisclosureNote: data.aiDisclosureNote || copyDraft.aiDisclosureNote,
          pinterestTitle: data.pinterestTitle || copyDraft.pinterestTitle,
          pinterestDescription:
            data.pinterestDescription || copyDraft.pinterestDescription,
          modelUsed: data.modelUsed,
          searchSources: data.searchSources || copyDraft.searchSources || [],
        };
        handleUpdateCopyDraft(nextDraft);
      }

      setAssistantChatHistory((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text:
            data.assistantReply ||
            "Updated the caption, hashtags, and Pinterest text in place.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } catch (err: any) {
      setAssistantChatHistory((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: "assistant",
          text: err?.message || "Could not reach the assistant right now.",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    } finally {
      setIsAssistantWorking(false);
    }
  };

  /**
   * Step 1: Create the master image
   */
  const handleGenerateMasterAnchor = async () => {
    if (isGeneratingAnchor || isGeneratingCampaign) return;
    setIsGeneratingAnchor(true);
    setGlobalError(null);
    setIsAnchorApproved(false);

    try {
      const response = await fetch("/api/brand/anchor", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          ...brief,
          brandPreset: activeBrandPreset,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create master image.");
      }

      let exactAnchor = data.anchorImageDataUrl;
      try {
        exactAnchor = await renderImageAtExactDimensions(data.anchorImageDataUrl, 1080, 1080);
      } catch {
        // Fallback to raw dataUrl
      }

      setCanonicalSpec(data.canonicalSpec);
      setAnchorImageUrl(exactAnchor);
      setIsAnchorApproved(false);

      await saveStateToDatabase({
        canonicalSpec: data.canonicalSpec,
        anchorImageUrl: exactAnchor,
        isAnchorApproved: false,
      });
    } catch (err: any) {
      setGlobalError(err?.message || "Error creating master image.");
    } finally {
      setIsGeneratingAnchor(false);
    }
  };

  /**
   * Step 2 (Single Size): Make a single size from the approved master image
   */
  const generateSingleMedium = async (
    mediumId: string,
    customSceneNote?: string
  ) => {
    if (!isAnchorApproved) {
      setGlobalError("Please approve the master image in Step 1 before making the sizes.");
      return;
    }

    const mediumDef = CAMPAIGN_MEDIUMS.find((m) => m.id === mediumId);
    if (!mediumDef) return;

    setMediumShots((prev) => ({
      ...prev,
      [mediumId]: {
        ...prev[mediumId],
        mediumId,
        status: "generating",
        customSceneNote: customSceneNote ?? prev[mediumId]?.customSceneNote,
        error: undefined,
      },
    }));

    try {
      const response = await fetch("/api/brand/medium", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          brandName: brief.brandName,
          productName: brief.productName,
          tagline: brief.tagline,
          canonicalSpec,
          anchorImageDataUrl: anchorImageUrl,
          humanPresenceMode: brief.humanPresenceMode,
          characterReferenceDataUrl: brief.characterReferenceDataUrl,
          brandPreset: activeBrandPreset,
          mediumId: mediumDef.id,
          mediumTitle: mediumDef.title,
          targetWidth: mediumDef.targetWidth,
          targetHeight: mediumDef.targetHeight,
          mediumPromptTemplate: mediumDef.promptTemplate,
          aspectRatio: mediumDef.aspectRatio,
          imageSize: brief.imageSize,
          customSceneNote: customSceneNote ?? mediumShots[mediumId]?.customSceneNote ?? "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Could not create ${mediumDef.title}`);
      }

      let exactSizedDataUrl = data.imageUrl;
      try {
        exactSizedDataUrl = await renderImageAtExactDimensions(
          data.imageUrl,
          mediumDef.targetWidth,
          mediumDef.targetHeight
        );
      } catch {
        // Keep raw data.imageUrl if canvas fails
      }

      const completedShot: GeneratedMediumShot = {
        mediumId,
        status: "completed",
        imageUrl: exactSizedDataUrl,
        promptUsed: data.promptUsed,
        customSceneNote: customSceneNote ?? stateRef.current.mediumShots[mediumId]?.customSceneNote,
        updatedAt: `${mediumDef.targetWidth}×${mediumDef.targetHeight} px`,
        exactWidth: mediumDef.targetWidth,
        exactHeight: mediumDef.targetHeight,
      };

      const nextShots = {
        ...stateRef.current.mediumShots,
        [mediumId]: completedShot,
      };

      setMediumShots(nextShots);
      await saveStateToDatabase({ mediumShots: nextShots });
    } catch (err: any) {
      setMediumShots((prev) => ({
        ...prev,
        [mediumId]: {
          ...prev[mediumId],
          mediumId,
          status: "error",
          error: err?.message || "Could not create image.",
        },
      }));
    }
  };

  /**
   * Step 2 (Batch): Make all selected sizes from the approved master image
   */
  const handleDeriveSelectedMediums = async () => {
    if (!isAnchorApproved) {
      setGlobalError("Please approve the master image in Step 1 before making the sizes.");
      return;
    }
    if (isGeneratingCampaign || isGeneratingAnchor) return;

    setIsGeneratingCampaign(true);
    setGlobalError(null);

    try {
      const targetIds =
        workMode === "asset"
          ? selectedMediumIds.length > 0
            ? selectedMediumIds
            : WEEKLY_ASSET_MEDIUM_IDS
          : selectedMediumIds.length > 0
          ? selectedMediumIds
          : CAMPAIGN_MEDIUMS.map((m) => m.id);

      if (workMode === "asset") {
        handleDraftCopy();
      }

      await Promise.all(targetIds.map((id) => generateSingleMedium(id)));
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  const handleRefineMedium = async (mediumId: string, instruction: string) => {
    const currentShot = mediumShots[mediumId];
    const mediumDef = CAMPAIGN_MEDIUMS.find((m) => m.id === mediumId);
    if (!currentShot?.imageUrl || !mediumDef) return;

    setIsRefiningMedium(true);
    try {
      const response = await fetch("/api/brand/refine", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          currentImageUrl: currentShot.imageUrl,
          anchorImageDataUrl: anchorImageUrl,
          characterReferenceDataUrl: brief.characterReferenceDataUrl,
          humanPresenceMode: brief.humanPresenceMode,
          editInstruction: instruction,
          canonicalSpec,
          aspectRatio: mediumDef.aspectRatio,
          imageSize: brief.imageSize,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update image.");
      }

      let exactSizedDataUrl = data.imageUrl;
      try {
        exactSizedDataUrl = await renderImageAtExactDimensions(
          data.imageUrl,
          mediumDef.targetWidth,
          mediumDef.targetHeight
        );
      } catch {
        // Fallback
      }

      const refinedShot: GeneratedMediumShot = {
        ...stateRef.current.mediumShots[mediumId],
        mediumId,
        status: "completed",
        imageUrl: exactSizedDataUrl,
        promptUsed: data.promptUsed,
        updatedAt: `Updated · ${mediumDef.targetWidth}×${mediumDef.targetHeight}`,
        exactWidth: mediumDef.targetWidth,
        exactHeight: mediumDef.targetHeight,
      };

      const nextShots = {
        ...stateRef.current.mediumShots,
        [mediumId]: refinedShot,
      };
      setMediumShots(nextShots);
      await saveStateToDatabase({ mediumShots: nextShots });
    } catch (err: any) {
      setGlobalError(err?.message || "Could not update image.");
    } finally {
      setIsRefiningMedium(false);
    }
  };

  const handleDownloadAnchor = async () => {
    if (!anchorImageUrl) return;
    await downloadExactSizedImage(
      anchorImageUrl,
      brief.productName || brief.brandName,
      "master_image",
      1080,
      1080
    );
  };

  const handleCopyAssetText = async (
    text: string,
    field: "social" | "pinTitle" | "pinDesc"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setAssetCopiedField(field);
      setTimeout(() => setAssetCopiedField(null), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setAssetCopiedField(field);
      setTimeout(() => setAssetCopiedField(null), 2000);
    }
  };

  const activeScheduledPost = activeScheduledPostId
    ? scheduledPosts.find((p) => p.id === activeScheduledPostId) || null
    : null;

  const displayedMediums =
    workMode === "asset"
      ? (() => {
          const base = CAMPAIGN_MEDIUMS.filter(
            (m) =>
              WEEKLY_ASSET_MEDIUM_IDS.includes(m.id) ||
              m.id === activeScheduledPost?.mediumId
          );
          if (activeScheduledPost?.mediumId) {
            return [...base].sort((a, b) =>
              a.id === activeScheduledPost.mediumId
                ? -1
                : b.id === activeScheduledPost.mediumId
                ? 1
                : 0
            );
          }
          return base;
        })()
      : CAMPAIGN_MEDIUMS.filter((m) =>
          categoryFilter === "all" ? true : m.category === categoryFilter
        );

  const anyMediumGenerating =
    isGeneratingCampaign ||
    Object.values(mediumShots).some((s) => s?.status === "generating");

  const masterAnchorStatusSentence = isGeneratingAnchor
    ? "Master image: generating"
    : isAnchorApproved
    ? "Master image: approved."
    : "Master image: waiting for approval.";

  const dataStatusLine =
    dbConnected === false ? "Data: not connected" : "Data: shared and saved";

  // Enforce Single-Password Gate before unlocking any app feature
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#F3D36B] font-display text-sm">
        Checking studio session...
      </div>
    );
  }

  if (!isUnlocked) {
    return <PasswordGateScreen onUnlockSuccess={handleUnlockSuccess} />;
  }

  return (
    <div className="min-h-screen flex flex-col text-[#F6F1FA]">
      {/* Hidden File Input for "Restore backup" */}
      <input
        ref={restoreBackupInputRef}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        onChange={handleRestoreBackupFile}
        className="hidden"
      />

      {/* Top Bar + Plain Database Status Line in Header Area */}
      <header className="sticky top-0 z-30 bg-[#08050D]/95 backdrop-blur-md border-b border-[#D4AF37]/35 px-6 lg:px-12 py-3 space-y-2">
        <div className="flex items-center justify-between gap-6">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="font-display text-lg sm:text-xl font-bold tracking-wider text-[#F3D36B] whitespace-nowrap shrink-0"
          >
            Brand Builder
          </a>

          {/* Zone 2: Navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-purple-200/80">
            <a
              href="#mode-switch"
              className="hover:text-[#F3D36B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Work Mode
            </a>
            <a
              href="#brand-preset"
              className="hover:text-[#F3D36B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Brand Preset
            </a>
            <a
              href="#product-brief"
              className="hover:text-[#F3D36B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Step 1: Master Image
            </a>
            <a
              href="#make-sizes"
              className="hover:text-[#F3D36B] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Step 2: Make the sizes
            </a>
          </nav>

          {/* Zone 3: Backup Controls ("Download backup" & "Restore backup") + Primary Action */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isExportingZip}
              className="px-3 py-1.5 text-xs font-semibold border border-[#00E5CC]/60 hover:border-[#00E5CC] text-[#00E5CC] hover:bg-[#00E5CC]/10 rounded-lg disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              Download backup
            </button>

            <button
              type="button"
              onClick={() => restoreBackupInputRef.current?.click()}
              disabled={isRestoringZip}
              className="px-3 py-1.5 text-xs font-semibold border border-[#D4AF37]/60 hover:border-[#F3D36B] text-[#F3D36B] hover:bg-[#D4AF37]/10 rounded-lg disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restore backup
            </button>

            <button
              type="button"
              onClick={handleGenerateMasterAnchor}
              disabled={isGeneratingCampaign || isGeneratingAnchor}
              className="btn-gold-glow px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Create master image
            </button>
          </div>
        </div>

        {/* Plain Database Connection Status Line in Header Area */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 pt-1.5 border-t border-[#D4AF37]/20 text-xs"
          aria-live="polite"
        >
          <span
            className={`font-semibold ${
              dbConnected === false ? "text-[#EB238E]" : "text-[#00E5CC]"
            }`}
          >
            {dataStatusLine}
          </span>

          {backupToast && (
            <span className="text-[#F3D36B] font-medium">{backupToast}</span>
          )}
        </div>
      </header>

      <main id="top" className="flex-1 max-w-[1400px] w-full mx-auto px-6 lg:px-12 py-8 space-y-10">
        {/* Top Row: Work Mode Switch (Campaign | Asset | Calendar) + Updated Numbered Workflow Steps */}
        <div
          id="mode-switch"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-6 border-b border-[#D4AF37]/30"
        >
          {/* Mode Switch Tabs */}
          <div className="lg:col-span-5 space-y-2.5">
            <span className="block text-xs font-semibold text-[#F3D36B]">
              Work Mode
            </span>
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-[#11081C] border border-[#D4AF37]/50 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => handleSwitchWorkMode("campaign")}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  workMode === "campaign"
                    ? "btn-gold-glow"
                    : "text-purple-200/80 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Campaign
              </button>
              <button
                type="button"
                onClick={() => handleSwitchWorkMode("asset")}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  workMode === "asset"
                    ? "btn-gold-glow"
                    : "text-purple-200/80 hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Asset
              </button>
              <button
                type="button"
                onClick={() => handleSwitchWorkMode("calendar")}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  workMode === "calendar"
                    ? "btn-gold-glow"
                    : "text-purple-200/80 hover:text-white"
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Calendar
              </button>
            </div>
          </div>

          {/* Updated Numbered List of Workflow Steps on Screen */}
          <div className="lg:col-span-7 bg-[#11081C]/90 border border-[#D4AF37]/40 rounded-xl px-5 py-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#F3D36B]">
                Workflow Steps
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isExportingZip}
                  className="px-2.5 py-1 text-[11px] font-semibold border border-[#00E5CC]/50 text-[#00E5CC] hover:bg-[#00E5CC]/10 rounded-md flex items-center gap-1 cursor-pointer"
                >
                  <Archive className="w-3 h-3" />
                  Download backup
                </button>
                <button
                  type="button"
                  onClick={() => restoreBackupInputRef.current?.click()}
                  disabled={isRestoringZip}
                  className="px-2.5 py-1 text-[11px] font-semibold border border-[#D4AF37]/50 text-[#F3D36B] hover:bg-[#D4AF37]/10 rounded-md flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Restore backup
                </button>
              </div>
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-purple-100 list-decimal list-inside">
              <li className="leading-relaxed">
                <span className="font-medium text-white">Brand Preset:</span> Set colors, fonts, and brand name.
              </li>
              <li className="leading-relaxed">
                <span className="font-medium text-[#F3D36B]">Step 1: Create the master image</span> and approve it.
              </li>
              <li className="leading-relaxed">
                <span className="font-medium text-[#00E5CC]">Step 2: Make the sizes</span> and download `product_medium_size.png`.
              </li>
              <li className="leading-relaxed">
                <span className="font-medium text-[#F3D36B]">Calendar & Assistant:</span> Plan weekly posts and draft Tasha L. Driver voice copy.
              </li>
              <li className="leading-relaxed">
                <span className="font-medium text-[#00E5CC]">Click Scheduled Post:</span> Open Asset mode prefilled for that post.
              </li>
              <li className="leading-relaxed">
                <span className="font-medium text-white">Shared Firestore & Backup:</span> Saved automatically; use Download backup or Restore backup anytime.
              </li>
            </ol>
          </div>
        </div>

        {globalError && (
          <div className="p-4 rounded-xl bg-[#2A0E24] border border-[#EB238E] flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#EB238E] shrink-0 mt-0.5" />
              <div className="text-xs text-white space-y-1">
                <p className="font-semibold text-[#F3D36B]">Notice</p>
                <p className="text-purple-100 leading-relaxed">{globalError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="px-3 py-1.5 text-xs font-medium border border-purple-300/40 rounded-lg text-purple-100 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              Dismiss Notice
            </button>
          </div>
        )}

        {/* Active Scheduled Post Banner when opened from Calendar into Asset Mode */}
        {workMode === "asset" && activeScheduledPost && (
          <div className="p-4 rounded-2xl bg-[#150B24] border-2 border-[#00E5CC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#00E5CC]">
                  Scheduled Post Opened from Calendar:
                </span>
                <span className="font-mono-spec text-[#F3D36B]">
                  {activeScheduledPost.date}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-white">
                  {activeScheduledPost.platform}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#F3D36B]">
                  Status: {activeScheduledPost.status}
                </span>
              </div>
              <p className="text-purple-100">
                {activeScheduledPost.productName} — {activeScheduledPost.shortNote}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {(["drafted", "ready", "posted"] as ScheduledPostStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() =>
                    handleUpdateScheduledPost({
                      ...activeScheduledPost,
                      status: st,
                      copyDraft,
                    })
                  }
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
                    activeScheduledPost.status === st
                      ? "btn-gold-glow"
                      : "bg-[#09050F] border border-[#D4AF37]/40 text-purple-100 hover:text-white"
                  }`}
                >
                  Mark {st}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setWorkMode("calendar")}
                className="px-3 py-1.5 text-xs font-semibold border border-[#00E5CC] text-[#00E5CC] hover:bg-[#00E5CC]/15 rounded-lg cursor-pointer"
              >
                Back to Calendar
              </button>
            </div>
          </div>
        )}

        {workMode === "calendar" ? (
          /* Calendar Tab: Content Calendar (Month & Week Views) + Moved Assistant & Copy Panel */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8">
              <ContentCalendarPanel
                scheduledPosts={scheduledPosts}
                savedListings={savedListings}
                activeProductId={activeTemplateId}
                onAddScheduledPost={handleAddScheduledPost}
                onUpdateScheduledPost={handleUpdateScheduledPost}
                onDeleteScheduledPost={handleDeleteScheduledPost}
                onOpenPostInAssetMode={handleOpenScheduledPostInAssetMode}
                onProposeWeekOfPosts={handleProposeWeekOfPosts}
                isProposingWeek={isProposingWeek}
                proposalSummary={proposalSummary}
              />
            </div>

            <div className="lg:col-span-4">
              <AssetCopyPanel
                productName={brief.productName || brief.brandName}
                copyDraft={copyDraft}
                onChangeCopy={handleUpdateCopyDraft}
                onRedraftCopy={handleDraftCopy}
                onSendAssistantMessage={handleSendAssistantMessage}
                chatHistory={assistantChatHistory}
                isDraftingCopy={isDraftingCopy}
                isAssistantWorking={isAssistantWorking}
              />
            </div>
          </div>
        ) : (
          /* Campaign Mode & Asset Mode */
          <>
            {/* Saveable Brand Preset Panel — All Labels Stacked Above Fields */}
            <section
              id="brand-preset"
              className="relative tarot-card-frame rounded-2xl p-6 sm:p-8 space-y-6"
            >
              <TarotCircuitCorner position="top-left" />
              <TarotCircuitCorner position="top-right" />
              <TarotCircuitCorner position="bottom-left" />
              <TarotCircuitCorner position="bottom-right" />

              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-[#D4AF37]/25">
                <div>
                  <div className="flex items-center gap-2 text-xs text-purple-200/75 mb-1">
                    <span className="text-[#00E5CC] font-medium">Brand Settings</span>
                    <span aria-hidden="true">·</span>
                    <span>Colors, Fonts & Brand Name</span>
                    {presetSaveToast && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#00E5CC] font-semibold">{presetSaveToast}</span>
                      </>
                    )}
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#FAF6FF] tracking-wide">
                    Brand Preset
                  </h2>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label
                      htmlFor="brand-preset-select"
                      className="block text-xs font-medium text-purple-200/80 mb-1.5"
                    >
                      Saved Preset
                    </label>
                    <select
                      id="brand-preset-select"
                      value={activeBrandPreset.id}
                      onChange={(e) => handleSelectBrandPreset(e.target.value)}
                      className="bg-[#0B0613] border border-[#D4AF37]/50 rounded-lg px-3 py-2 text-xs text-[#F3D36B] focus:outline-none focus:border-[#00E5CC]"
                    >
                      {savedPresets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.presetName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateNewPreset}
                    className="px-3.5 py-2 text-xs font-medium border border-[#D4AF37]/45 hover:border-[#F3D36B] text-purple-100 hover:text-[#F3D36B] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Preset
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveBrandPreset}
                    className="px-4 py-2 text-xs font-semibold border border-[#00E5CC] text-[#00E5CC] hover:bg-[#00E5CC]/15 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    Save Preset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 items-end">
                <div className="lg:col-span-2">
                  <label
                    htmlFor="brand-name-input"
                    className="block text-xs font-medium text-purple-200/80 mb-1.5"
                  >
                    Brand Name
                  </label>
                  <input
                    id="brand-name-input"
                    type="text"
                    value={activeBrandPreset.brandName}
                    onChange={(e) => {
                      handleUpdateActivePresetField({
                        ...activeBrandPreset,
                        brandName: e.target.value,
                      });
                    }}
                    className="w-full bg-[#09050F] border border-[#D4AF37]/40 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#00E5CC]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="heading-font-select"
                    className="block text-xs font-medium text-purple-200/80 mb-1.5"
                  >
                    Heading Font
                  </label>
                  <select
                    id="heading-font-select"
                    value={activeBrandPreset.headingFont}
                    onChange={(e) =>
                      handleUpdateActivePresetField({
                        ...activeBrandPreset,
                        headingFont: e.target.value,
                      })
                    }
                    className="w-full bg-[#09050F] border border-[#D4AF37]/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
                  >
                    <option value="Cinzel">Cinzel</option>
                    <option value="Cormorant Garamond">Cormorant Garamond</option>
                    <option value="Fraunces">Fraunces</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="body-font-select"
                    className="block text-xs font-medium text-purple-200/80 mb-1.5"
                  >
                    Body Font
                  </label>
                  <select
                    id="body-font-select"
                    value={activeBrandPreset.bodyFont}
                    onChange={(e) =>
                      handleUpdateActivePresetField({
                        ...activeBrandPreset,
                        bodyFont: e.target.value,
                      })
                    }
                    className="w-full bg-[#09050F] border border-[#D4AF37]/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
                  >
                    <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                    <option value="JetBrains Mono">JetBrains Mono</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="plum-color-input"
                    className="block text-xs font-medium text-purple-200/80 mb-1.5"
                  >
                    Deep Plum
                  </label>
                  <div className="flex items-center gap-2 bg-[#09050F] border border-[#D4AF37]/40 rounded-lg px-2.5 py-1.5">
                    <input
                      id="plum-color-input"
                      type="color"
                      value={activeBrandPreset.primaryColor}
                      onChange={(e) =>
                        handleUpdateActivePresetField({
                          ...activeBrandPreset,
                          primaryColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono-spec text-xs text-purple-100">
                      {activeBrandPreset.primaryColor}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="teal-color-input"
                    className="block text-xs font-medium text-purple-200/80 mb-1.5"
                  >
                    Vibrant Teal
                  </label>
                  <div className="flex items-center gap-2 bg-[#09050F] border border-[#D4AF37]/40 rounded-lg px-2.5 py-1.5">
                    <input
                      id="teal-color-input"
                      type="color"
                      value={activeBrandPreset.secondaryColor}
                      onChange={(e) =>
                        handleUpdateActivePresetField({
                          ...activeBrandPreset,
                          secondaryColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono-spec text-xs text-[#00E5CC]">
                      {activeBrandPreset.secondaryColor}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="magenta-color-input"
                    className="block text-xs font-medium text-purple-200/80 mb-1.5"
                  >
                    Sassy Magenta
                  </label>
                  <div className="flex items-center gap-2 bg-[#09050F] border border-[#D4AF37]/40 rounded-lg px-2.5 py-1.5">
                    <input
                      id="magenta-color-input"
                      type="color"
                      value={activeBrandPreset.accentColor}
                      onChange={(e) =>
                        handleUpdateActivePresetField({
                          ...activeBrandPreset,
                          accentColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                    />
                    <span className="font-mono-spec text-xs text-[#EB238E]">
                      {activeBrandPreset.accentColor}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <TarotCircuitDivider label="Step 1: Create the master image" />

            {/* Step 1 Split: Left = Product Details | Right = Master Image & Approval */}
            <section
              id="product-brief"
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
            >
              {/* Left Column (7 cols): Product Details */}
              <div className="lg:col-span-7 relative tarot-card-frame rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <TarotCircuitCorner position="top-left" />
                <TarotCircuitCorner position="top-right" />
                <TarotCircuitCorner position="bottom-left" />
                <TarotCircuitCorner position="bottom-right" />

                <div className="space-y-6">
                  {/* Header + Presets */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D4AF37]/25">
                    <div>
                      <h2 className="font-display text-xl font-bold text-[#FAF6FF] tracking-wide">
                        Step 1: Create the master image
                      </h2>
                      <p className="text-xs text-purple-200/70 mt-0.5">
                        {workMode === "asset"
                          ? "Pick a saved listing and reuse its anchor or create a fresh master image"
                          : "Describe your product or choose a preset"}
                      </p>
                    </div>

                    <div>
                      <span className="block text-xs font-medium text-purple-200/80 mb-1">
                        Sample Presets
                      </span>
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#09050F] border border-[#D4AF37]/35 rounded-lg">
                        {PRODUCT_BRIEF_TEMPLATES.map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleSelectTemplate(tpl.id)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              activeTemplateId === tpl.id
                                ? "bg-[#2A1442] text-[#F3D36B] border border-[#D4AF37]/50"
                                : "text-purple-200/70 hover:text-white"
                            }`}
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Asset Mode: Saved Listing Picker & Anchor Source */}
                  {workMode === "asset" && (
                    <div className="p-4 rounded-xl bg-[#11081C] border border-[#D4AF37]/45 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                          <label
                            htmlFor="asset-listing-select"
                            className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
                          >
                            Existing Product Listing
                          </label>
                          <select
                            id="asset-listing-select"
                            value={activeTemplateId}
                            onChange={(e) => handleSelectTemplate(e.target.value)}
                            className="w-full bg-[#09050F] border border-[#D4AF37]/50 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
                          >
                            {savedListings.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <span className="block text-xs font-semibold text-[#F3D36B] mb-1.5">
                            Master Image Option
                          </span>
                          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#09050F] border border-[#D4AF37]/40 rounded-lg">
                            <button
                              type="button"
                              onClick={() => {
                                setAssetAnchorSource("saved");
                                const found = savedListings.find((l) => l.id === activeTemplateId);
                                if (found) {
                                  setAnchorImageUrl(found.savedAnchorUrl);
                                  setIsAnchorApproved(true);
                                  setApprovalSealKey((prev) => prev + 1);
                                  saveStateToDatabase({
                                    anchorImageUrl: found.savedAnchorUrl,
                                    isAnchorApproved: true,
                                  });
                                }
                              }}
                              className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                                assetAnchorSource === "saved"
                                  ? "bg-[#2A1442] text-[#00E5CC] border border-[#00E5CC]/50"
                                  : "text-purple-200/70 hover:text-white"
                              }`}
                            >
                              Reuse Saved Anchor
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAssetAnchorSource("fresh");
                                setIsAnchorApproved(false);
                                saveStateToDatabase({ isAnchorApproved: false });
                              }}
                              className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                                assetAnchorSource === "fresh"
                                  ? "bg-[#2A1442] text-[#F3D36B] border border-[#D4AF37]/50"
                                  : "text-purple-200/70 hover:text-white"
                              }`}
                            >
                              Create Fresh Anchor
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Product Name & Tagline — Labels Stacked Above Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="product-name-input"
                        className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
                      >
                        Product Name (Used for file names)
                      </label>
                      <input
                        id="product-name-input"
                        type="text"
                        value={brief.productName}
                        onChange={(e) => {
                          handleUpdateBriefAndSave({ ...brief, productName: e.target.value });
                        }}
                        placeholder="e.g., Hardcover Journal"
                        className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00E5CC]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="product-tagline-input"
                        className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
                      >
                        Headline or Tagline
                      </label>
                      <input
                        id="product-tagline-input"
                        type="text"
                        value={brief.tagline}
                        onChange={(e) => {
                          handleUpdateBriefAndSave({ ...brief, tagline: e.target.value });
                        }}
                        placeholder="e.g., STORY PLANNING AND DIGITAL TOOLS"
                        className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#00E5CC]"
                      />
                    </div>
                  </div>

                  {/* Product Description — Label Stacked Above Field */}
                  <div>
                    <label
                      htmlFor="product-description-input"
                      className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
                    >
                      Product Description (Shape, materials, colors, and label text)
                    </label>
                    <textarea
                      id="product-description-input"
                      rows={3}
                      value={brief.productDescription}
                      onChange={(e) => {
                        const shouldUnapprove =
                          workMode === "campaign" || assetAnchorSource === "fresh"
                            ? false
                            : isAnchorApproved;
                        handleUpdateBriefAndSave(
                          { ...brief, productDescription: e.target.value },
                          shouldUnapprove
                        );
                      }}
                      placeholder="Describe the product shape, materials, colors, and label details..."
                      className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3.5 py-2.5 text-sm text-white leading-relaxed focus:outline-none focus:border-[#00E5CC]"
                    />
                  </div>

                  {/* Per-Campaign Scene Setting */}
                  <div className="p-4 rounded-xl bg-[#11081C] border border-[#D4AF37]/40 space-y-3">
                    <span className="block text-xs font-semibold text-[#F3D36B]">
                      People in Scene
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {(
                        [
                          {
                            id: "product_only" as HumanPresenceMode,
                            title: "Product only",
                            subtitle: "No people or hands",
                            icon: Package,
                          },
                          {
                            id: "hands_only" as HumanPresenceMode,
                            title: "Hands only",
                            subtitle: "Hands holding product",
                            icon: Hand,
                          },
                          {
                            id: "character_in_scene" as HumanPresenceMode,
                            title: "Character in scene",
                            subtitle: "Uses reference image",
                            icon: UserCheck,
                          },
                        ] as const
                      ).map((option) => {
                        const Icon = option.icon;
                        const active = brief.humanPresenceMode === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() =>
                              handleUpdateBriefAndSave({
                                ...brief,
                                humanPresenceMode: option.id,
                              })
                            }
                            className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                              active
                                ? "bg-[#2A1442] border-[#00E5CC] text-white shadow-[0_0_15px_rgba(0,229,204,0.2)]"
                                : "bg-[#09050F] border-[#D4AF37]/30 text-purple-200/75 hover:border-[#D4AF37]/60"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                active ? "text-[#00E5CC]" : "text-[#F3D36B]"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white">{option.title}</p>
                              <p className="text-[11px] text-purple-200/65 mt-0.5">
                                {option.subtitle}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Character Reference Uploader */}
                    {brief.humanPresenceMode === "character_in_scene" && (
                      <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-[#D4AF37]/25">
                        <input
                          ref={characterFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCharacterReferenceUpload}
                          className="hidden"
                        />
                        <div className="flex items-center gap-3">
                          {brief.characterReferenceDataUrl ? (
                            <img
                              src={brief.characterReferenceDataUrl}
                              alt="Character Reference"
                              referrerPolicy="no-referrer"
                              className="w-11 h-11 rounded-lg object-cover border border-[#00E5CC]"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-[#09050F] border border-dashed border-[#D4AF37]/50 flex items-center justify-center text-[#F3D36B]">
                              <UserCheck className="w-4 h-4" />
                            </div>
                          )}
                          <div className="text-xs">
                            <p className="font-semibold text-white">
                              {brief.characterReferenceDataUrl
                                ? "Character Reference Image Ready"
                                : "Character Reference Image"}
                            </p>
                            <p className="text-purple-200/70">
                              Used alongside your approved master image
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => characterFileInputRef.current?.click()}
                            className="px-3.5 py-2 text-xs font-semibold border border-[#00E5CC] text-[#00E5CC] hover:bg-[#00E5CC]/15 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            {brief.characterReferenceDataUrl ? "Change Character" : "Upload Character"}
                          </button>
                          {brief.characterReferenceDataUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateBriefAndSave({
                                  ...brief,
                                  characterReferenceDataUrl: undefined,
                                })
                              }
                              className="px-3 py-2 text-xs font-medium border border-[#EB238E]/50 text-purple-200 hover:text-[#EB238E] rounded-lg flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove Character
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lighting + Image Quality + Optional Product Reference */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                    <div className="sm:col-span-5">
                      <label
                        htmlFor="lighting-style-input"
                        className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
                      >
                        Lighting & Background Style
                      </label>
                      <input
                        id="lighting-style-input"
                        type="text"
                        value={brief.aestheticStyle}
                        onChange={(e) =>
                          handleUpdateBriefAndSave({
                            ...brief,
                            aestheticStyle: e.target.value,
                          })
                        }
                        className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <span className="block text-xs font-semibold text-[#F3D36B] mb-1.5">
                        Image Quality
                      </span>
                      <div className="flex items-center gap-1 p-1 bg-[#09050F] border border-[#D4AF37]/40 rounded-lg">
                        {(["1K", "2K", "4K"] as ImageResolutionOption[]).map((res) => (
                          <button
                            key={res}
                            type="button"
                            onClick={() =>
                              handleUpdateBriefAndSave({ ...brief, imageSize: res })
                            }
                            className={`flex-1 py-1 text-xs font-mono-spec font-medium rounded-md transition-colors cursor-pointer ${
                              brief.imageSize === res
                                ? "bg-[#2A1442] text-[#F3D36B] border border-[#D4AF37]/50"
                                : "text-purple-200/70 hover:text-white"
                            }`}
                          >
                            {res}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <span className="block text-xs font-semibold text-[#F3D36B] mb-1.5">
                        Optional Product Reference
                      </span>
                      <input
                        ref={productFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleProductReferenceUpload}
                        className="hidden"
                      />
                      {brief.uploadedReferenceDataUrl ? (
                        <div className="flex items-center justify-between gap-2 bg-[#1D0E2E] border border-[#D4AF37]/50 rounded-lg px-3 py-1.5">
                          <span className="text-xs font-medium text-[#F3D36B] truncate">
                            Photo Added
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateBriefAndSave({
                                ...brief,
                                uploadedReferenceDataUrl: undefined,
                              })
                            }
                            className="px-2 py-0.5 text-xs font-medium text-purple-200 hover:text-[#EB238E] flex items-center gap-1 whitespace-nowrap cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove Photo
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => productFileInputRef.current?.click()}
                          className="w-full py-2 px-3 text-xs font-medium border border-dashed border-[#D4AF37]/50 hover:border-[#F3D36B] rounded-lg text-purple-200 hover:text-[#F3D36B] flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload Product Photo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Select Target Sizes Checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#F3D36B]">
                        Sizes to Make ({selectedMediumIds.length} selected)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedMediumIds(
                            selectedMediumIds.length === CAMPAIGN_MEDIUMS.length
                              ? ["etsy_listing", "instagram_portrait", "hero_shot"]
                              : CAMPAIGN_MEDIUMS.map((m) => m.id)
                          )
                        }
                        className="text-xs text-[#00E5CC] hover:underline underline-offset-2 cursor-pointer"
                      >
                        {selectedMediumIds.length === CAMPAIGN_MEDIUMS.length
                          ? "Select 3 Sizes"
                          : "Select All 6 Sizes"}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {CAMPAIGN_MEDIUMS.map((medium) => {
                        const isSelected = selectedMediumIds.includes(medium.id);
                        return (
                          <button
                            key={medium.id}
                            type="button"
                            onClick={() => toggleMediumSelection(medium.id)}
                            className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? "bg-[#241138] border-[#D4AF37] text-white"
                                : "bg-[#09050F] border-[#D4AF37]/25 text-purple-200/60 hover:border-[#D4AF37]/50"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">
                                {medium.title}
                              </p>
                              <p className="text-[11px] text-[#00E5CC] font-mono-spec mt-0.5">
                                {medium.dimensionsLabel}
                              </p>
                            </div>
                            <div
                              className={`w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                                isSelected
                                  ? "bg-[#D4AF37] text-[#09050F]"
                                  : "border border-[#D4AF37]/40"
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Step 1 Fixed Primary Button Bar */}
                <div className="pt-5 border-t border-[#D4AF37]/25 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleGenerateMasterAnchor}
                    disabled={isGeneratingAnchor || isGeneratingCampaign}
                    className="btn-gold-glow flex-1 px-6 py-3 text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGeneratingAnchor ? "animate-spin" : ""}`} />
                    Create master image
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveCurrentProductListing}
                    className="px-4 py-3 text-xs font-semibold border border-[#D4AF37]/50 hover:border-[#F3D36B] text-[#F3D36B] hover:bg-[#D4AF37]/10 rounded-lg transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    Save Anchor for Asset Mode
                  </button>
                </div>
              </div>

              {/* Right Column (5 cols): Master Image & Approval */}
              <div
                id="master-anchor"
                className="lg:col-span-5 relative tarot-card-frame rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-5"
              >
                <TarotCircuitCorner position="top-left" />
                <TarotCircuitCorner position="top-right" />
                <TarotCircuitCorner position="bottom-left" />
                <TarotCircuitCorner position="bottom-right" />

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#D4AF37]/25">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
                        <span
                          className={`font-semibold flex items-center gap-1 ${
                            isAnchorApproved ? "text-[#00E5CC]" : "text-[#EB238E]"
                          }`}
                          aria-live="polite"
                        >
                          {isAnchorApproved ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                          {masterAnchorStatusSentence}
                        </span>
                        <span aria-hidden="true" className="text-purple-300/50">·</span>
                        <span className="font-mono-spec text-[#F3D36B]">1080×1080 px</span>
                        {listingSaveToast && (
                          <>
                            <span aria-hidden="true" className="text-purple-300/50">·</span>
                            <span className="text-[#00E5CC]">{listingSaveToast}</span>
                          </>
                        )}
                      </div>
                      <h2 className="font-display text-xl font-bold text-[#FAF6FF] tracking-wide">
                        Master Image
                      </h2>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadAnchor}
                      className="px-3 py-1.5 text-xs font-medium border border-[#D4AF37]/40 hover:border-[#F3D36B] rounded-lg text-purple-100 hover:text-[#F3D36B] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Master
                    </button>
                  </div>

                  {/* Framed Gold Master Image + Gold Seal Lock-In Animation */}
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#09050F] result-image-frame flex items-center justify-center">
                    {isGeneratingAnchor ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center">
                        <RefreshCw className="w-8 h-8 text-[#F3D36B] animate-spin mb-3" />
                        <p className="font-display text-sm font-semibold text-[#F3D36B]">
                          Master image: generating
                        </p>
                        <p className="text-xs text-purple-200/70 mt-1 max-w-xs">
                          Matching product shape, materials, and brand colors
                        </p>
                      </div>
                    ) : (
                      <>
                        <motion.img
                          key={anchorImageUrl}
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.35 }}
                          src={anchorImageUrl}
                          alt={`${brief.productName} Master Image`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />

                        {/* Gold Seal Lock-In Animation when Approved */}
                        <AnimatePresence>
                          {isAnchorApproved && (
                            <motion.div
                              key={approvalSealKey}
                              initial={{ scale: 1.85, opacity: 0, rotate: -22 }}
                              animate={{ scale: 1, opacity: 1, rotate: 0 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                              transition={{
                                type: "spring",
                                stiffness: 320,
                                damping: 18,
                              }}
                              className="absolute bottom-3 right-3 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#F3D36B] via-[#D4AF37] to-[#B88E1E] text-[#09050F] border-2 border-[#FAF6FF] shadow-[0_0_24px_rgba(243,211,107,0.85)] flex items-center gap-1.5 select-none"
                            >
                              <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                              <span className="font-display text-[11px] font-bold tracking-wider uppercase">
                                Gold Seal Locked
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </div>

                  {/* Fixed Approval Controls Bar */}
                  <div className="p-4 rounded-xl bg-[#11081D] border border-[#D4AF37]/45 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#F3D36B]">
                        {masterAnchorStatusSentence}
                      </span>
                      <span className="text-purple-200/70">
                        {isAnchorApproved ? "Ready for Step 2" : "Approve to unlock Step 2"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleApproveMasterAnchor}
                        disabled={isGeneratingAnchor}
                        className={`flex-1 py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                          isAnchorApproved
                            ? "bg-[#193836] border border-[#00E5CC] text-[#00E5CC]"
                            : "btn-gold-glow"
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        {isAnchorApproved ? "Master Image Approved" : "Approve Master Image"}
                      </button>

                      <button
                        type="button"
                        onClick={handleUnlockMasterAnchor}
                        disabled={isGeneratingAnchor || !isAnchorApproved}
                        className="px-3.5 py-2.5 text-xs font-semibold border border-[#D4AF37]/50 hover:border-[#F3D36B] text-[#F3D36B] disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Unlock Image
                      </button>
                    </div>
                  </div>
                </div>

                {/* Product Details Summary */}
                <div className="bg-[#0B0613] border border-[#D4AF37]/35 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#F3D36B]">
                      Locked Product Details
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingSpec((prev) => !prev)}
                      className="px-2.5 py-1 text-xs font-medium border border-[#00E5CC]/40 rounded text-[#00E5CC] hover:bg-[#00E5CC]/10 flex items-center gap-1 cursor-pointer"
                    >
                      <Sliders className="w-3 h-3" />
                      {isEditingSpec ? "Save Details" : "Edit Details"}
                    </button>
                  </div>

                  {isEditingSpec ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <label
                          htmlFor="spec-shape-input"
                          className="block text-purple-200/70 mb-1"
                        >
                          Shape & Form
                        </label>
                        <input
                          id="spec-shape-input"
                          type="text"
                          value={canonicalSpec.silhouetteLock}
                          onChange={(e) =>
                            handleUpdateCanonicalSpecAndSave({
                              ...canonicalSpec,
                              silhouetteLock: e.target.value,
                            })
                          }
                          className="w-full bg-[#150A24] border border-[#D4AF37]/40 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="spec-materials-input"
                          className="block text-purple-200/70 mb-1"
                        >
                          Materials
                        </label>
                        <input
                          id="spec-materials-input"
                          type="text"
                          value={canonicalSpec.surfaceMaterials}
                          onChange={(e) =>
                            handleUpdateCanonicalSpecAndSave({
                              ...canonicalSpec,
                              surfaceMaterials: e.target.value,
                            })
                          }
                          className="w-full bg-[#150A24] border border-[#D4AF37]/40 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="spec-label-input"
                          className="block text-purple-200/70 mb-1"
                        >
                          Label Text
                        </label>
                        <input
                          id="spec-label-input"
                          type="text"
                          value={canonicalSpec.labelTypographySpec}
                          onChange={(e) =>
                            handleUpdateCanonicalSpecAndSave({
                              ...canonicalSpec,
                              labelTypographySpec: e.target.value,
                            })
                          }
                          className="w-full bg-[#150A24] border border-[#D4AF37]/40 rounded px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-xs text-purple-100/85">
                      <div>
                        <span className="text-purple-300/60">Shape: </span>
                        <span className="font-medium text-white">{canonicalSpec.silhouetteLock}</span>
                      </div>
                      <div>
                        <span className="text-purple-300/60">Materials: </span>
                        <span>{canonicalSpec.surfaceMaterials}</span>
                      </div>
                      <div>
                        <span className="text-purple-300/60">Label: </span>
                        <span>{canonicalSpec.labelTypographySpec}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <TarotCircuitDivider label="Step 2: Make the sizes" />

            {/* Step 2 Gallery */}
            <section id="make-sizes" className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#D4AF37]/30 pb-6">
                <div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-wide text-[#FAF6FF]">
                    Step 2: Make the sizes
                  </h2>
                  <p className="text-xs text-purple-200/75 mt-1">
                    File name format: `product_medium_size.png` · Scene:{" "}
                    {brief.humanPresenceMode === "product_only"
                      ? "Product only"
                      : brief.humanPresenceMode === "hands_only"
                      ? "Hands only"
                      : "Character in scene"}
                  </p>
                </div>

                {/* Step 2 Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {workMode === "campaign" && (
                    <div className="flex flex-wrap items-center gap-1 p-1 bg-[#11081C] border border-[#D4AF37]/40 rounded-lg">
                      {[
                        { id: "all", label: "All 6 Sizes" },
                        { id: "marketplace", label: "Etsy & Pinterest" },
                        { id: "social", label: "IG, Square & TikTok" },
                        { id: "hero", label: "Hero Shot" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setCategoryFilter(tab.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            categoryFilter === tab.id
                              ? "bg-[#2A1442] text-[#F3D36B] border border-[#D4AF37]/50"
                              : "text-purple-200/70 hover:text-white"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* One Clear Primary Button for Step 2 */}
                  <button
                    type="button"
                    onClick={handleDeriveSelectedMediums}
                    disabled={!isAnchorApproved || isGeneratingCampaign || isGeneratingAnchor}
                    className="btn-gold-glow px-5 py-2.5 text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Make the sizes
                  </button>
                </div>
              </div>

              {/* Plain-Text Status Sentences Bar */}
              <div
                className="bg-[#11081C]/90 border border-[#D4AF37]/35 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"
                aria-live="polite"
              >
                <span className="font-semibold text-[#F3D36B]">Size Status:</span>
                {displayedMediums.map((m) => {
                  const s = mediumShots[m.id]?.status || "idle";
                  const sentence =
                    s === "generating"
                      ? `${m.title}: generating`
                      : s === "completed"
                      ? `${m.title}: done.`
                      : s === "error"
                      ? `${m.title}: error.`
                      : `${m.title}: waiting.`;
                  return (
                    <span
                      key={m.id}
                      className={
                        s === "generating"
                          ? "text-[#F3D36B] font-semibold"
                          : s === "completed"
                          ? "text-[#00E5CC]"
                          : s === "error"
                          ? "text-[#EB238E]"
                          : "text-purple-200/65"
                      }
                    >
                      {sentence}
                    </span>
                  );
                })}
              </div>

              {/* Slow Fanning Deck of Approved Master Image While Sizes Generate */}
              <AnimatePresence>
                {anyMediumGenerating && (
                  <motion.div
                    key="fanning-deck"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="relative tarot-card-frame rounded-2xl p-6 flex flex-col items-center justify-center overflow-hidden"
                  >
                    <p className="font-display text-sm font-semibold text-[#F3D36B] mb-2">
                      Dealing Approved Master Image Across Selected Sizes...
                    </p>
                    <div className="relative h-44 w-full max-w-md flex items-center justify-center my-2">
                      {[-18, -9, 0, 9, 18].map((angle, idx) => (
                        <motion.div
                          key={angle}
                          initial={{ rotate: 0, x: 0, y: 0 }}
                          animate={{
                            rotate: [angle * 0.55, angle, angle * 0.55],
                            x: [angle * 1.1, angle * 2.1, angle * 1.1],
                            y: [Math.abs(idx - 2) * 3, Math.abs(idx - 2) * 6, Math.abs(idx - 2) * 3],
                          }}
                          transition={{
                            duration: 3.2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          style={{ transformOrigin: "bottom center" }}
                          className="absolute w-28 h-36 rounded-xl overflow-hidden border-2 border-[#D4AF37] shadow-[0_8px_24px_rgba(0,0,0,0.85)] bg-[#09050F]"
                        >
                          <img
                            src={anchorImageUrl}
                            alt="Fanning Master Image Card"
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {workMode === "asset" ? (
                /* Asset Mode: Weekly Size Set Images on Left + Prefilled Editable Caption & Pin Text Panel on Right */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {displayedMediums.map((medium) => (
                      <MediumCard
                        key={medium.id}
                        medium={medium}
                        shot={
                          mediumShots[medium.id] || {
                            mediumId: medium.id,
                            status: "idle",
                          }
                        }
                        productName={brief.productName || brief.brandName}
                        isAnchorApproved={isAnchorApproved}
                        onGenerate={(id, customNote) => generateSingleMedium(id, customNote)}
                        onInspect={(m) => setInspectedMedium(m)}
                        isGlobalGenerating={isGeneratingCampaign || isGeneratingAnchor}
                      />
                    ))}
                  </div>

                  {/* Asset Mode Text Panel (Prefilled from Scheduled Post & Assistant Draft, synced to Firestore) */}
                  <aside className="lg:col-span-4 relative tarot-card-frame rounded-2xl p-6 space-y-5 lg:sticky lg:top-24">
                    <TarotCircuitCorner position="top-left" />
                    <TarotCircuitCorner position="top-right" />
                    <TarotCircuitCorner position="bottom-left" />
                    <TarotCircuitCorner position="bottom-right" />

                    <div className="pb-3 border-b border-[#D4AF37]/25 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-[#00E5CC]">
                          Asset Listing Text
                        </p>
                        <h3 className="font-display text-lg font-bold text-[#FAF6FF]">
                          Caption & Pin Text
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWorkMode("calendar")}
                        className="px-3 py-1.5 text-xs font-semibold border border-[#D4AF37] text-[#F3D36B] hover:bg-[#D4AF37]/15 rounded-lg cursor-pointer"
                      >
                        Open Calendar & Assistant
                      </button>
                    </div>

                    {/* Social Caption Field — Label Stacked Above Field */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="asset-social-caption"
                          className="text-xs font-semibold text-[#F3D36B]"
                        >
                          Social Caption
                        </label>
                        <button
                          type="button"
                          onClick={() => handleCopyAssetText(copyDraft.socialCaption, "social")}
                          className="px-2.5 py-1 text-xs font-medium border border-[#00E5CC]/50 text-[#00E5CC] rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {assetCopiedField === "social" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <textarea
                        id="asset-social-caption"
                        rows={6}
                        value={copyDraft.socialCaption}
                        onChange={(e) =>
                          handleUpdateCopyDraft({
                            ...copyDraft,
                            socialCaption: e.target.value,
                          })
                        }
                        className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-xl px-3.5 py-2.5 text-xs text-white leading-relaxed focus:outline-none focus:border-[#00E5CC]"
                      />
                    </div>

                    {/* Researched Hashtags Summary */}
                    {copyDraft.hashtags && copyDraft.hashtags.length > 0 && (
                      <div className="p-3 rounded-xl bg-[#0B0613] border border-[#D4AF37]/35 space-y-1.5 text-xs">
                        <span className="block font-semibold text-[#F3D36B]">
                          Researched Hashtags (850k–1.5M Range)
                        </span>
                        {copyDraft.hashtags.map((h, i) => (
                          <div key={`${h.tag}-${i}`} className="flex items-center justify-between gap-2">
                            <span className="font-mono-spec text-[#00E5CC] font-semibold">
                              {h.tag}
                            </span>
                            <span className="text-purple-200/80 text-[11px]">
                              {h.countText}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pinterest Pin Title Field — Label Stacked Above Field */}
                    <div className="space-y-2 pt-2 border-t border-[#D4AF37]/20">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="asset-pin-title"
                          className="text-xs font-semibold text-[#F3D36B]"
                        >
                          Pinterest Pin Title
                        </label>
                        <button
                          type="button"
                          onClick={() => handleCopyAssetText(copyDraft.pinterestTitle, "pinTitle")}
                          className="px-2.5 py-1 text-xs font-medium border border-[#00E5CC]/50 text-[#00E5CC] rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {assetCopiedField === "pinTitle" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <input
                        id="asset-pin-title"
                        type="text"
                        value={copyDraft.pinterestTitle}
                        onChange={(e) =>
                          handleUpdateCopyDraft({
                            ...copyDraft,
                            pinterestTitle: e.target.value,
                          })
                        }
                        className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
                      />
                    </div>

                    {/* Pinterest Pin Description Field — Label Stacked Above Field */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="asset-pin-desc"
                          className="text-xs font-semibold text-[#F3D36B]"
                        >
                          Pinterest Pin Description
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyAssetText(copyDraft.pinterestDescription, "pinDesc")
                          }
                          className="px-2.5 py-1 text-xs font-medium border border-[#00E5CC]/50 text-[#00E5CC] rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {assetCopiedField === "pinDesc" ? "Copied" : "Copy"}
                        </button>
                      </div>
                      <textarea
                        id="asset-pin-desc"
                        rows={4}
                        value={copyDraft.pinterestDescription}
                        onChange={(e) =>
                          handleUpdateCopyDraft({
                            ...copyDraft,
                            pinterestDescription: e.target.value,
                          })
                        }
                        className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-xl px-3.5 py-2.5 text-xs text-white leading-relaxed focus:outline-none focus:border-[#00E5CC]"
                      />
                    </div>
                  </aside>
                </div>
              ) : (
                /* Campaign Mode: Full 2-Column Framed Gold Cards Grid */
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {displayedMediums.map((medium) => (
                    <MediumCard
                      key={medium.id}
                      medium={medium}
                      shot={
                        mediumShots[medium.id] || {
                          mediumId: medium.id,
                          status: "idle",
                        }
                      }
                      productName={brief.productName || brief.brandName}
                      isAnchorApproved={isAnchorApproved}
                      onGenerate={(id, customNote) => generateSingleMedium(id, customNote)}
                      onInspect={(m) => setInspectedMedium(m)}
                      isGlobalGenerating={isGeneratingCampaign || isGeneratingAnchor}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D4AF37]/30 mt-20 py-8 px-6 lg:px-12 text-xs text-purple-200/70 bg-[#07040B]">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-[#F3D36B]">
              Brand Builder
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeBrandPreset.brandName}</span>
            <span aria-hidden="true">·</span>
            <span
              className={
                dbConnected === false ? "text-[#EB238E]" : "text-[#00E5CC]"
              }
            >
              {dataStatusLine}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#00E5CC]">Nano-Banana 2.1 & Gemini Argon</span>
            <span aria-hidden="true">·</span>
            <span>Files exported as `product_medium_size.png`</span>
          </div>
        </div>
      </footer>

      {/* Preview & Comparison Modal */}
      <LightboxModal
        medium={inspectedMedium}
        shot={inspectedMedium ? mediumShots[inspectedMedium.id] : null}
        anchorImageUrl={anchorImageUrl}
        canonicalSpec={canonicalSpec}
        productName={brief.productName || brief.brandName}
        onClose={() => setInspectedMedium(null)}
        onRefine={handleRefineMedium}
        isRefining={isRefiningMedium}
      />
    </div>
  );
}
