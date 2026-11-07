import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  Plus,
  Sparkles,
  Check,
  Trash2,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Edit3,
} from "lucide-react";
import {
  CalendarViewMode,
  SavedProductListing,
  ScheduledPost,
  ScheduledPostStatus,
} from "../types/brand";
import { CAMPAIGN_MEDIUMS, INITIAL_COPY_DRAFT } from "../data/campaignPresets";
import { TarotCircuitCorner } from "./TarotCircuitOrnament";

interface ContentCalendarPanelProps {
  scheduledPosts: ScheduledPost[];
  savedListings: SavedProductListing[];
  activeProductId: string;
  onAddScheduledPost: (post: ScheduledPost) => void;
  onUpdateScheduledPost: (post: ScheduledPost) => void;
  onDeleteScheduledPost: (postId: string) => void;
  onOpenPostInAssetMode: (post: ScheduledPost) => void;
  onProposeWeekOfPosts: (params: {
    productId: string;
    startDate: string;
    weeklyFocus: string;
  }) => Promise<ScheduledPost[]>;
  isProposingWeek: boolean;
  proposalSummary: string | null;
}

const STATUS_STYLES: Record<
  ScheduledPostStatus,
  {
    borderClass: string;
    bgClass: string;
    badgeTextClass: string;
    plainLabel: string;
  }
> = {
  drafted: {
    borderClass: "border-2 border-[#D4AF37]",
    bgClass: "bg-[#1A0D2A]/95",
    badgeTextClass: "text-[#F3D36B]",
    plainLabel: "Status: drafted",
  },
  ready: {
    borderClass: "border-2 border-[#00E5CC]",
    bgClass: "bg-[#0F2429]/95",
    badgeTextClass: "text-[#00E5CC]",
    plainLabel: "Status: ready",
  },
  posted: {
    borderClass: "border-2 border-[#EB238E]",
    bgClass: "bg-[#260D22]/95",
    badgeTextClass: "text-[#EB238E]",
    plainLabel: "Status: posted",
  },
};

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const ContentCalendarPanel: React.FC<ContentCalendarPanelProps> = ({
  scheduledPosts,
  savedListings,
  activeProductId,
  onAddScheduledPost,
  onUpdateScheduledPost,
  onDeleteScheduledPost,
  onOpenPostInAssetMode,
  onProposeWeekOfPosts,
  isProposingWeek,
  proposalSummary,
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [cursorDate, setCursorDate] = useState<Date>(() => new Date(2026, 10, 7)); // Nov 7, 2026

  // Manual Add Scheduled Post Form State
  const [formDate, setFormDate] = useState<string>("2026-11-08");
  const [formMediumId, setFormMediumId] = useState<string>("instagram_portrait");
  const [formProductId, setFormProductId] = useState<string>(
    activeProductId || savedListings[0]?.id || "plot-witch-default"
  );
  const [formStatus, setFormStatus] = useState<ScheduledPostStatus>("drafted");
  const [formShortNote, setFormShortNote] = useState<string>("");

  // Assistant Weekly Proposal State
  const [proposeProductId, setProposeProductId] = useState<string>(
    activeProductId || savedListings[0]?.id || "plot-witch-default"
  );
  const [proposeStartDate, setProposeStartDate] = useState<string>("2026-11-08");
  const [proposeWeeklyFocus, setProposeWeeklyFocus] = useState<string>("");
  const [proposedPosts, setProposedPosts] = useState<ScheduledPost[]>([]);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);

  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const medium =
      CAMPAIGN_MEDIUMS.find((m) => m.id === formMediumId) || CAMPAIGN_MEDIUMS[1];
    const listing =
      savedListings.find((l) => l.id === formProductId) || savedListings[0];
    const productName = listing?.brief.productName || "Hardcover Journal";
    const baseCopy = listing?.defaultCopy || INITIAL_COPY_DRAFT;

    const noteText =
      formShortNote.trim() || `${productName} feature for ${medium.title}`;

    const newPost: ScheduledPost = {
      id: `sched-${Date.now()}`,
      date: formDate,
      platform: medium.title,
      mediumId: medium.id,
      productId: listing?.id || "plot-witch-default",
      productName,
      shortNote: noteText,
      status: formStatus,
      copyDraft: {
        ...baseCopy,
        socialCaption: formShortNote.trim()
          ? `${formShortNote.trim()}\n\n${baseCopy.socialCaption}`
          : baseCopy.socialCaption,
      },
    };

    onAddScheduledPost(newPost);
    setFormShortNote("");
  };

  const handleRequestProposals = async () => {
    const proposals = await onProposeWeekOfPosts({
      productId: proposeProductId,
      startDate: proposeStartDate,
      weeklyFocus: proposeWeeklyFocus,
    });
    if (proposals.length > 0) {
      setProposedPosts(proposals);
    }
  };

  const handleApproveSingleProposal = (proposal: ScheduledPost) => {
    onAddScheduledPost({
      ...proposal,
      id: `sched-approved-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    });
    setProposedPosts((prev) => prev.filter((p) => p.id !== proposal.id));
  };

  const handleApproveAllProposals = () => {
    for (const proposal of proposedPosts) {
      onAddScheduledPost({
        ...proposal,
        id: `sched-approved-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
    }
    setProposedPosts([]);
  };

  const handleDismissProposal = (proposalId: string) => {
    setProposedPosts((prev) => prev.filter((p) => p.id !== proposalId));
  };

  const handleUpdateProposalField = (
    proposalId: string,
    updater: (prev: ScheduledPost) => ScheduledPost
  ) => {
    setProposedPosts((prev) =>
      prev.map((item) => (item.id === proposalId ? updater(item) : item))
    );
  };

  // Calendar Grid Computation
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const monthLabel = cursorDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Month View cells
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthDays: Array<{ dateStr: string; dayNumber: number; isCurrentMonth: boolean }> = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    const d = new Date(year, month, 1 - (startDayOfWeek - i));
    monthDays.push({
      dateStr: formatYMD(d),
      dayNumber: d.getDate(),
      isCurrentMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    monthDays.push({
      dateStr: formatYMD(d),
      dayNumber: day,
      isCurrentMonth: true,
    });
  }
  while (monthDays.length % 7 !== 0) {
    const nextIdx = monthDays.length - (startDayOfWeek + daysInMonth) + 1;
    const d = new Date(year, month + 1, nextIdx);
    monthDays.push({
      dateStr: formatYMD(d),
      dayNumber: d.getDate(),
      isCurrentMonth: false,
    });
  }

  // Week View cells (7 days starting Sunday of cursorDate's week)
  const weekStart = new Date(cursorDate);
  weekStart.setDate(cursorDate.getDate() - cursorDate.getDay());
  const weekDays: Array<{ dateStr: string; label: string; dayNumber: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDays.push({
      dateStr: formatYMD(d),
      label: d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      dayNumber: d.getDate(),
    });
  }

  const handleNavigatePrev = () => {
    const next = new Date(cursorDate);
    if (viewMode === "month") {
      next.setMonth(next.getMonth() - 1);
    } else {
      next.setDate(next.getDate() - 7);
    }
    setCursorDate(next);
  };

  const handleNavigateNext = () => {
    const next = new Date(cursorDate);
    if (viewMode === "month") {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setDate(next.getDate() + 7);
    }
    setCursorDate(next);
  };

  const handleNavigateToday = () => {
    setCursorDate(new Date(2026, 10, 7));
  };

  return (
    <div className="space-y-8">
      {/* Assistant Week Proposal Card */}
      <section className="relative tarot-card-frame rounded-2xl p-6 sm:p-7 space-y-5">
        <TarotCircuitCorner position="top-left" />
        <TarotCircuitCorner position="top-right" />
        <TarotCircuitCorner position="bottom-left" />
        <TarotCircuitCorner position="bottom-right" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D4AF37]/25">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#00E5CC] font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#F3D36B]" />
              <span>The Plot Witch Assistant · Weekly Schedule Planner</span>
            </div>
            <h3 className="font-display text-lg font-bold text-[#FAF6FF] tracking-wide">
              Propose a Week of Scheduled Posts
            </h3>
            <p className="text-xs text-purple-200/75 mt-0.5">
              The assistant drafts a 5-post weekly schedule in Tasha L. Driver&apos;s Informative Voice. You approve or edit each post before it lands on the calendar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-4">
            <label
              htmlFor="propose-product-select"
              className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
            >
              Product for Weekly Proposal
            </label>
            <select
              id="propose-product-select"
              value={proposeProductId}
              onChange={(e) => setProposeProductId(e.target.value)}
              className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
            >
              {savedListings.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <label
              htmlFor="propose-start-date-input"
              className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
            >
              Week Start Date
            </label>
            <input
              id="propose-start-date-input"
              type="date"
              value={proposeStartDate}
              onChange={(e) => setProposeStartDate(e.target.value)}
              className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
            />
          </div>

          <div className="sm:col-span-5">
            <label
              htmlFor="propose-focus-input"
              className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
            >
              Optional Weekly Focus or Teaching Topic
            </label>
            <input
              id="propose-focus-input"
              type="text"
              value={proposeWeeklyFocus}
              onChange={(e) => setProposeWeeklyFocus(e.target.value)}
              placeholder="e.g., Act II scene troubleshooting, POV consistency..."
              className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-[#00E5CC]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-xs text-purple-200/80" aria-live="polite">
            {isProposingWeek
              ? "Assistant: researching hashtags and proposing a week of scheduled posts..."
              : proposedPosts.length > 0
              ? `Assistant: ${proposedPosts.length} proposed posts waiting for your review.`
              : "Assistant: ready to propose a week of scheduled posts."}
          </span>

          <button
            type="button"
            onClick={handleRequestProposals}
            disabled={isProposingWeek}
            className="btn-gold-glow px-5 py-2.5 text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            {isProposingWeek ? "Proposing Week..." : "Propose Week of Posts"}
          </button>
        </div>

        {/* Staging Area for Proposed Posts — Approve or Edit Before Landing on Calendar */}
        {proposedPosts.length > 0 && (
          <div className="pt-4 border-t border-[#D4AF37]/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-sm font-bold text-[#F3D36B]">
                  Proposed Weekly Posts (Approve or Edit Before Adding to Calendar)
                </h4>
                {proposalSummary && (
                  <p className="text-xs text-purple-100/85 mt-1">{proposalSummary}</p>
                )}
              </div>

              <button
                type="button"
                onClick={handleApproveAllProposals}
                className="px-4 py-2 text-xs font-semibold bg-[#133235] border border-[#00E5CC] text-[#00E5CC] hover:bg-[#00E5CC]/20 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Approve All Proposed Posts ({proposedPosts.length})
              </button>
            </div>

            <div className="space-y-3">
              {proposedPosts.map((proposal) => {
                const isEditing = editingProposalId === proposal.id;
                return (
                  <div
                    key={proposal.id}
                    className="p-4 rounded-xl bg-[#0B0613] border border-[#D4AF37]/50 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono-spec font-semibold text-[#F3D36B]">
                            {proposal.date}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#00E5CC]">
                            {proposal.platform}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-white font-medium">
                            {proposal.productName}
                          </span>
                        </div>
                        <p className="text-xs text-purple-100 font-medium">
                          {proposal.shortNote}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingProposalId(isEditing ? null : proposal.id)
                          }
                          className="px-3 py-1.5 text-xs font-medium border border-[#D4AF37]/50 text-[#F3D36B] hover:border-[#F3D36B] rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          {isEditing ? "Done Editing" : "Edit Proposal"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveSingleProposal(proposal)}
                          className="btn-gold-glow px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve & Add to Calendar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissProposal(proposal.id)}
                          className="px-3 py-1.5 text-xs font-medium border border-[#EB238E]/50 text-purple-200 hover:text-[#EB238E] rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Dismiss
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#D4AF37]/25 text-xs">
                        <div>
                          <label className="block font-semibold text-[#F3D36B] mb-1">
                            Scheduled Date
                          </label>
                          <input
                            type="date"
                            value={proposal.date}
                            onChange={(e) =>
                              handleUpdateProposalField(proposal.id, (p) => ({
                                ...p,
                                date: e.target.value,
                              }))
                            }
                            className="w-full bg-[#140A22] border border-[#D4AF37]/40 rounded px-2.5 py-1.5 text-white"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[#F3D36B] mb-1">
                            Platform
                          </label>
                          <select
                            value={proposal.mediumId}
                            onChange={(e) => {
                              const m = CAMPAIGN_MEDIUMS.find(
                                (item) => item.id === e.target.value
                              );
                              if (!m) return;
                              handleUpdateProposalField(proposal.id, (p) => ({
                                ...p,
                                mediumId: m.id,
                                platform: m.title,
                              }));
                            }}
                            className="w-full bg-[#140A22] border border-[#D4AF37]/40 rounded px-2.5 py-1.5 text-white"
                          >
                            {CAMPAIGN_MEDIUMS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-[#F3D36B] mb-1">
                            Short Note
                          </label>
                          <input
                            type="text"
                            value={proposal.shortNote}
                            onChange={(e) =>
                              handleUpdateProposalField(proposal.id, (p) => ({
                                ...p,
                                shortNote: e.target.value,
                              }))
                            }
                            className="w-full bg-[#140A22] border border-[#D4AF37]/40 rounded px-2.5 py-1.5 text-white"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block font-semibold text-[#F3D36B] mb-1">
                            Social Caption Draft
                          </label>
                          <textarea
                            rows={3}
                            value={proposal.copyDraft.socialCaption}
                            onChange={(e) =>
                              handleUpdateProposalField(proposal.id, (p) => ({
                                ...p,
                                copyDraft: {
                                  ...p.copyDraft,
                                  socialCaption: e.target.value,
                                },
                              }))
                            }
                            className="w-full bg-[#140A22] border border-[#D4AF37]/40 rounded px-2.5 py-1.5 text-white leading-relaxed"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-purple-200/80 line-clamp-2 leading-relaxed">
                        {proposal.copyDraft.socialCaption}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Manual Add Scheduled Post Form — All Labels Stacked Above Fields */}
      <section className="relative tarot-card-frame rounded-2xl p-6 sm:p-7 space-y-5">
        <TarotCircuitCorner position="top-left" />
        <TarotCircuitCorner position="top-right" />
        <TarotCircuitCorner position="bottom-left" />
        <TarotCircuitCorner position="bottom-right" />

        <div className="pb-3 border-b border-[#D4AF37]/25">
          <h3 className="font-display text-lg font-bold text-[#FAF6FF] tracking-wide">
            Add a Scheduled Post
          </h3>
          <p className="text-xs text-purple-200/75 mt-0.5">
            Schedule a post with a date, platform, product, status, and short note. Click any scheduled post on the calendar to open it in Asset mode.
          </p>
        </div>

        <form onSubmit={handleManualAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="sched-date-input"
                className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
              >
                Date
              </label>
              <input
                id="sched-date-input"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
              />
            </div>

            <div>
              <label
                htmlFor="sched-platform-select"
                className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
              >
                Platform
              </label>
              <select
                id="sched-platform-select"
                value={formMediumId}
                onChange={(e) => setFormMediumId(e.target.value)}
                className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
              >
                {CAMPAIGN_MEDIUMS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.dimensionsLabel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sched-product-select"
                className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
              >
                Product
              </label>
              <select
                id="sched-product-select"
                value={formProductId}
                onChange={(e) => setFormProductId(e.target.value)}
                className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
              >
                {savedListings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sched-status-select"
                className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
              >
                Post Status
              </label>
              <select
                id="sched-status-select"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as ScheduledPostStatus)}
                className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
              >
                <option value="drafted">drafted (Gold Border)</option>
                <option value="ready">ready (Teal Border)</option>
                <option value="posted">posted (Magenta Border)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-9">
              <label
                htmlFor="sched-short-note-input"
                className="block text-xs font-semibold text-[#F3D36B] mb-1.5"
              >
                Short Note
              </label>
              <input
                id="sched-short-note-input"
                type="text"
                value={formShortNote}
                onChange={(e) => setFormShortNote(e.target.value)}
                placeholder="e.g., Chapter tab setup & index card demo for Act II..."
                className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-[#00E5CC]"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="submit"
                className="btn-gold-glow w-full py-2.5 px-4 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Scheduled Post
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* Main Content Calendar: Month View & Week View */}
      <section className="relative tarot-card-frame rounded-2xl p-6 sm:p-7 space-y-6">
        <TarotCircuitCorner position="top-left" />
        <TarotCircuitCorner position="top-right" />
        <TarotCircuitCorner position="bottom-left" />
        <TarotCircuitCorner position="bottom-right" />

        {/* Calendar Controls Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#D4AF37]/25">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#00E5CC] font-semibold mb-1">
              <CalendarIcon className="w-3.5 h-3.5 text-[#F3D36B]" />
              <span>Content Calendar ({scheduledPosts.length} Scheduled Posts)</span>
            </div>
            <h3 className="font-display text-xl font-bold text-[#FAF6FF] tracking-wide">
              {monthLabel}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Month View / Week View Switch */}
            <div className="flex items-center gap-1 p-1 bg-[#09050F] border border-[#D4AF37]/45 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === "month"
                    ? "btn-gold-glow"
                    : "text-purple-200/80 hover:text-white"
                }`}
              >
                Month View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  viewMode === "week"
                    ? "btn-gold-glow"
                    : "text-purple-200/80 hover:text-white"
                }`}
              >
                Week View
              </button>
            </div>

            {/* Date Navigation Buttons — All with Visible Text Labels */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleNavigatePrev}
                className="px-3 py-1.5 text-xs font-medium border border-[#D4AF37]/45 hover:border-[#F3D36B] text-[#F3D36B] rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                type="button"
                onClick={handleNavigateToday}
                className="px-3 py-1.5 text-xs font-medium border border-[#00E5CC]/50 hover:border-[#00E5CC] text-[#00E5CC] rounded-lg cursor-pointer"
              >
                Current Week
              </button>
              <button
                type="button"
                onClick={handleNavigateNext}
                className="px-3 py-1.5 text-xs font-medium border border-[#D4AF37]/45 hover:border-[#F3D36B] text-[#F3D36B] rounded-lg flex items-center gap-1 cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#09050F] border border-[#D4AF37]/30 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold text-[#F3D36B]">Calendar Status Legend:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border-2 border-[#D4AF37] text-[#F3D36B]">
              Status: drafted
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border-2 border-[#00E5CC] text-[#00E5CC]">
              Status: ready
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border-2 border-[#EB238E] text-[#EB238E]">
              Status: posted
            </span>
          </div>
          <span className="text-purple-200/75">
            Click any scheduled post to open Asset Work Mode for that post.
          </span>
        </div>

        {/* Calendar Grid: Month View or Week View */}
        {viewMode === "month" ? (
          <div className="space-y-2">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#F3D36B] pb-1">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {monthDays.map((cell) => {
                const dayPosts = scheduledPosts.filter((p) => p.date === cell.dateStr);
                return (
                  <div
                    key={cell.dateStr}
                    className={`min-h-[135px] p-2.5 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
                      cell.isCurrentMonth
                        ? "bg-[#0B0613] border-[#D4AF37]/30"
                        : "bg-[#07040C]/60 border-[#D4AF37]/15 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-mono-spec font-semibold ${
                          cell.isCurrentMonth ? "text-[#FAF6FF]" : "text-purple-300/50"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-[10px] text-[#00E5CC] font-medium">
                          {dayPosts.length} {dayPosts.length === 1 ? "post" : "posts"}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 flex-1">
                      {dayPosts.map((post) => {
                        const st = STATUS_STYLES[post.status] || STATUS_STYLES.drafted;
                        return (
                          <div
                            key={post.id}
                            className={`p-2 rounded-lg ${st.bgClass} ${st.borderClass} space-y-1.5 transition-transform hover:scale-[1.01]`}
                          >
                            <button
                              type="button"
                              onClick={() => onOpenPostInAssetMode(post)}
                              className="w-full text-left space-y-1 cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[11px] font-bold text-white truncate">
                                  {post.productName}
                                </span>
                                <ArrowUpRight className="w-3 h-3 text-[#F3D36B] shrink-0" />
                              </div>
                              <p className="text-[10px] font-semibold text-[#00E5CC] truncate">
                                {post.platform}
                              </p>
                              <p className="text-[10px] text-purple-100/85 line-clamp-2 leading-snug">
                                {post.shortNote}
                              </p>
                              <p className={`text-[10px] font-semibold ${st.badgeTextClass}`}>
                                {st.plainLabel}
                              </p>
                            </button>

                            {/* Quick Status Switcher */}
                            <div className="pt-1 border-t border-white/10 flex flex-wrap items-center gap-1">
                              {(["drafted", "ready", "posted"] as ScheduledPostStatus[]).map(
                                (statusOption) => (
                                  <button
                                    key={statusOption}
                                    type="button"
                                    onClick={() =>
                                      onUpdateScheduledPost({
                                        ...post,
                                        status: statusOption,
                                      })
                                    }
                                    className={`px-1.5 py-0.5 text-[9px] font-semibold rounded cursor-pointer ${
                                      post.status === statusOption
                                        ? "bg-[#D4AF37] text-[#09050F]"
                                        : "bg-[#09050F] text-purple-200/75 hover:text-white"
                                    }`}
                                  >
                                    {statusOption}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Week View */
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayPosts = scheduledPosts.filter((p) => p.date === day.dateStr);
              return (
                <div
                  key={day.dateStr}
                  className="min-h-[240px] p-3 rounded-xl bg-[#0B0613] border border-[#D4AF37]/35 flex flex-col gap-3"
                >
                  <div className="pb-2 border-b border-[#D4AF37]/20">
                    <p className="text-xs font-bold text-[#F3D36B]">{day.label}</p>
                    <p className="text-[11px] font-mono-spec text-purple-200/65">
                      {day.dateStr}
                    </p>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {dayPosts.length === 0 ? (
                      <p className="text-[11px] text-purple-300/40 italic pt-2">
                        No posts scheduled
                      </p>
                    ) : (
                      dayPosts.map((post) => {
                        const st = STATUS_STYLES[post.status] || STATUS_STYLES.drafted;
                        return (
                          <div
                            key={post.id}
                            className={`p-2.5 rounded-xl ${st.bgClass} ${st.borderClass} space-y-2`}
                          >
                            <button
                              type="button"
                              onClick={() => onOpenPostInAssetMode(post)}
                              className="w-full text-left space-y-1 cursor-pointer"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-white">
                                  {post.productName}
                                </span>
                                <ArrowUpRight className="w-3.5 h-3.5 text-[#F3D36B] shrink-0" />
                              </div>
                              <p className="text-[11px] font-semibold text-[#00E5CC]">
                                {post.platform}
                              </p>
                              <p className="text-[11px] text-purple-100 leading-relaxed">
                                {post.shortNote}
                              </p>
                              <p className={`text-[11px] font-semibold ${st.badgeTextClass}`}>
                                {st.plainLabel}
                              </p>
                            </button>

                            <div className="pt-1.5 border-t border-white/10 space-y-1.5">
                              <div className="flex flex-wrap gap-1">
                                {(["drafted", "ready", "posted"] as ScheduledPostStatus[]).map(
                                  (statusOption) => (
                                    <button
                                      key={statusOption}
                                      type="button"
                                      onClick={() =>
                                        onUpdateScheduledPost({
                                          ...post,
                                          status: statusOption,
                                        })
                                      }
                                      className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer ${
                                        post.status === statusOption
                                          ? "bg-[#D4AF37] text-[#09050F]"
                                          : "bg-[#09050F] text-purple-200/75 hover:text-white"
                                      }`}
                                    >
                                      {statusOption}
                                    </button>
                                  )
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => onOpenPostInAssetMode(post)}
                                  className="px-2 py-1 text-[10px] font-semibold text-[#00E5CC] border border-[#00E5CC]/40 rounded hover:bg-[#00E5CC]/10 cursor-pointer"
                                >
                                  Open in Asset Mode
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteScheduledPost(post.id)}
                                  className="px-2 py-1 text-[10px] font-medium text-purple-200 hover:text-[#EB238E] cursor-pointer"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Complete Scheduled Posts List Below Grid for Quick Inspection & Click-to-Open */}
        <div className="pt-4 border-t border-[#D4AF37]/25 space-y-3">
          <h4 className="font-display text-sm font-bold text-[#F3D36B]">
            All Scheduled Posts (Click any post to open in Asset Mode)
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {scheduledPosts.map((post) => {
              const st = STATUS_STYLES[post.status] || STATUS_STYLES.drafted;
              return (
                <div
                  key={post.id}
                  className={`p-3.5 rounded-xl ${st.bgClass} ${st.borderClass} flex flex-col justify-between gap-3`}
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-mono-spec font-semibold text-[#F3D36B]">
                        {post.date} · {post.platform}
                      </span>
                      <span className={`font-semibold ${st.badgeTextClass}`}>
                        {st.plainLabel}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white">
                      {post.productName} — {post.shortNote}
                    </p>
                    <p className="text-[11px] text-purple-200/80 line-clamp-2">
                      {post.copyDraft.socialCaption}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-1">
                      {(["drafted", "ready", "posted"] as ScheduledPostStatus[]).map(
                        (statusOption) => (
                          <button
                            key={statusOption}
                            type="button"
                            onClick={() =>
                              onUpdateScheduledPost({
                                ...post,
                                status: statusOption,
                              })
                            }
                            className={`px-2 py-1 text-[10px] font-semibold rounded cursor-pointer ${
                              post.status === statusOption
                                ? "bg-[#D4AF37] text-[#09050F]"
                                : "bg-[#09050F] text-purple-200/80 hover:text-white border border-[#D4AF37]/30"
                            }`}
                          >
                            Mark {statusOption}
                          </button>
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenPostInAssetMode(post)}
                        className="btn-gold-glow px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Open in Asset Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteScheduledPost(post.id)}
                        className="px-2.5 py-1.5 text-xs font-medium border border-[#EB238E]/50 text-purple-200 hover:text-[#EB238E] rounded-lg cursor-pointer"
                      >
                        Delete Post
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
