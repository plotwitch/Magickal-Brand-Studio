import React, { useState } from "react";
import {
  Copy,
  Check,
  RefreshCw,
  FileText,
  MessageSquare,
  Search,
  Sparkles,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import {
  AssetCopyDraft,
  AssistantChatMessage,
} from "../types/brand";
import {
  OFFICIAL_PLOT_WITCH_VOICE_GUIDE_TEXT,
  VOICE_GUIDE_ASSET_URL,
} from "../data/campaignPresets";
import { TarotCircuitCorner } from "./TarotCircuitOrnament";

interface AssetCopyPanelProps {
  productName: string;
  copyDraft: AssetCopyDraft;
  onChangeCopy: (updated: AssetCopyDraft) => void;
  onRedraftCopy: (weeklyAngle: string, customVoiceNotes?: string) => Promise<void>;
  onSendAssistantMessage: (
    userMessage: string,
    weeklyAngle: string,
    customVoiceNotes?: string
  ) => Promise<void>;
  chatHistory: AssistantChatMessage[];
  isDraftingCopy: boolean;
  isAssistantWorking: boolean;
}

export const AssetCopyPanel: React.FC<AssetCopyPanelProps> = ({
  productName,
  copyDraft,
  onChangeCopy,
  onRedraftCopy,
  onSendAssistantMessage,
  chatHistory,
  isDraftingCopy,
  isAssistantWorking,
}) => {
  const [weeklyAngle, setWeeklyAngle] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [showVoiceGuide, setShowVoiceGuide] = useState(false);
  const [customVoiceNotes, setCustomVoiceNotes] = useState("");
  const [copiedField, setCopiedField] = useState<
    "social" | "pinTitle" | "pinDesc" | "pinBoth" | null
  >(null);

  const handleCopyText = async (
    text: string,
    field: "social" | "pinTitle" | "pinDesc" | "pinBoth"
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isAssistantWorking || isDraftingCopy) return;
    setChatInput("");
    await onSendAssistantMessage(trimmed, weeklyAngle, customVoiceNotes);
  };

  const handleQuickPrompt = async (promptText: string) => {
    if (isAssistantWorking || isDraftingCopy) return;
    await onSendAssistantMessage(promptText, weeklyAngle, customVoiceNotes);
  };

  const busy = isDraftingCopy || isAssistantWorking;

  return (
    <aside className="relative tarot-card-frame rounded-2xl p-6 sm:p-7 space-y-6">
      <TarotCircuitCorner position="top-left" />
      <TarotCircuitCorner position="top-right" />
      <TarotCircuitCorner position="bottom-left" />
      <TarotCircuitCorner position="bottom-right" />

      {/* Header */}
      <div className="pb-4 border-b border-[#D4AF37]/25 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-purple-200/80 mb-1">
              <FileText className="w-3.5 h-3.5 text-[#00E5CC]" />
              <span className="text-[#00E5CC] font-semibold">
                The Plot Witch Assistant
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[160px] text-[#F3D36B]">
                {productName}
              </span>
            </div>
            <h3 className="font-display text-lg font-bold text-[#FAF6FF] tracking-wide">
              Assistant & Copy Panel
            </h3>
            <p className="text-[11px] text-purple-200/70 mt-0.5">
              Voice: Tasha L. Driver Informative Voice Guide · Search Grounding Active
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRedraftCopy(weeklyAngle, customVoiceNotes)}
            disabled={busy}
            className="btn-gold-glow px-3.5 py-2 text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDraftingCopy ? "animate-spin" : ""}`} />
            {isDraftingCopy ? "Drafting..." : "Draft Copy"}
          </button>
        </div>

        {/* Status Sentence + Voice Guide Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <span
            className="text-[#00E5CC] font-medium"
            aria-live="polite"
          >
            {busy
              ? "Caption assistant: researching with Google Search and writing..."
              : `Caption assistant: ready (${copyDraft.modelUsed || "gemini-4-argon / 3.8-flash backup"}).`}
          </span>

          <button
            type="button"
            onClick={() => setShowVoiceGuide((prev) => !prev)}
            className="px-2.5 py-1 text-xs font-medium border border-[#D4AF37]/45 hover:border-[#F3D36B] text-[#F3D36B] rounded-md flex items-center gap-1.5 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {showVoiceGuide ? "Hide Voice Guide" : "Show Voice Guide"}
          </button>
        </div>

        {/* Collapsible Voice Guide Reference & Custom Voice Notes */}
        {showVoiceGuide && (
          <div className="p-3.5 rounded-xl bg-[#09050F] border border-[#D4AF37]/40 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-[#F3D36B]">
                Tasha L. Driver — Informative Voice Guide (8 Oct 2026)
              </p>
              <a
                href={VOICE_GUIDE_ASSET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#00E5CC] hover:underline flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3 h-3" />
                Open Full Guide File
              </a>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-[11px] text-purple-100/85 leading-relaxed">
              {OFFICIAL_PLOT_WITCH_VOICE_GUIDE_TEXT}
            </pre>
            <div>
              <label
                htmlFor="custom-voice-notes-input"
                className="block text-xs font-semibold text-[#00E5CC] mb-1"
              >
                Additional Voice or Craft Notes (Optional)
              </label>
              <input
                id="custom-voice-notes-input"
                type="text"
                value={customVoiceNotes}
                onChange={(e) => setCustomVoiceNotes(e.target.value)}
                placeholder="e.g., Focus on index card prep, practical chapter tabs..."
                className="w-full bg-[#12091E] border border-[#D4AF37]/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Optional Weekly Topic / Angle — Label Above Field */}
      <div>
        <label
          htmlFor="weekly-angle-input"
          className="block text-xs font-semibold text-purple-200/85 mb-1.5"
        >
          Weekly Focus or Scene Angle
        </label>
        <input
          id="weekly-angle-input"
          type="text"
          value={weeklyAngle}
          onChange={(e) => setWeeklyAngle(e.target.value)}
          placeholder="e.g., Midnight Act II outline, restock drop, chapter teardown..."
          className="w-full bg-[#09050F] border border-[#D4AF37]/40 rounded-lg px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-[#00E5CC]"
        />
      </div>

      {/* Interactive Chat with The Plot Witch Assistant (Updates Text in Place) */}
      <div className="p-4 rounded-xl bg-[#11081C] border border-[#D4AF37]/45 space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-[#00E5CC]" />
            <span className="text-xs font-semibold text-[#FAF6FF]">
              Chat with The Plot Witch Assistant
            </span>
          </div>
          <span className="text-[11px] text-[#F3D36B] flex items-center gap-1">
            <Search className="w-3 h-3 text-[#00E5CC]" />
            Google Search Grounded
          </span>
        </div>

        {/* Quick Revision Buttons — All with Visible Text Labels */}
        <div>
          <span className="block text-[11px] font-medium text-purple-200/75 mb-1.5">
            Quick In-Place Revisions
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                handleQuickPrompt(
                  "Shorten the social caption to 2-3 punchy sentences while keeping The Plot Witch voice, the hashtags, and the AI content note."
                )
              }
              className="px-2.5 py-1.5 text-xs font-medium bg-[#1C0D2E] border border-[#D4AF37]/40 hover:border-[#F3D36B] text-[#F3D36B] rounded-lg disabled:opacity-40 cursor-pointer"
            >
              Shorten Caption
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                handleQuickPrompt(
                  "Swap one hashtag for a different relevant hashtag researched via Google Search (target 850,000 to 1,500,000 posts, or state if the count cannot be verified in search results)."
                )
              }
              className="px-2.5 py-1.5 text-xs font-medium bg-[#1C0D2E] border border-[#D4AF37]/40 hover:border-[#F3D36B] text-[#F3D36B] rounded-lg disabled:opacity-40 cursor-pointer"
            >
              Swap a Tag
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                handleQuickPrompt(
                  "Revise the caption in Tasha L. Driver's Informative Voice with a recognizable writer problem, a concrete studio example, and a practical next step at the end."
                )
              }
              className="px-2.5 py-1.5 text-xs font-medium bg-[#1C0D2E] border border-[#D4AF37]/40 hover:border-[#F3D36B] text-[#F3D36B] rounded-lg disabled:opacity-40 cursor-pointer"
            >
              Add Concrete Example & Next Step
            </button>
          </div>
        </div>

        {/* Assistant Conversation History */}
        {chatHistory.length > 0 && (
          <div className="max-h-44 overflow-y-auto space-y-2 p-2.5 rounded-lg bg-[#09050F] border border-[#D4AF37]/30 text-xs">
            {chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={`p-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-[#241138] text-purple-100 border border-[#D4AF37]/30"
                    : "bg-[#122629] text-[#FAF6FF] border border-[#00E5CC]/40"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-semibold mb-0.5">
                  <span
                    className={
                      msg.role === "user" ? "text-[#F3D36B]" : "text-[#00E5CC]"
                    }
                  >
                    {msg.role === "user" ? "You" : "The Plot Witch Assistant"}
                  </span>
                  <span className="text-purple-300/60">{msg.timestamp}</span>
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chat Input Form — Label Stacked Above Input */}
        <form onSubmit={handleChatSubmit} className="space-y-2">
          <label
            htmlFor="assistant-chat-input"
            className="block text-xs font-semibold text-[#F3D36B]"
          >
            Ask the Assistant to Revise, Shorten, or Swap a Tag
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="assistant-chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="e.g., Make the opening darker, shorten by half, or swap #novelwriting..."
              className="flex-1 bg-[#09050F] border border-[#D4AF37]/45 rounded-lg px-3 py-2 text-xs text-white placeholder-purple-300/40 focus:outline-none focus:border-[#00E5CC]"
            />
            <button
              type="submit"
              disabled={busy || !chatInput.trim()}
              className="btn-gold-glow px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-40 flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAssistantWorking ? "Updating..." : "Update Text"}
            </button>
          </div>
        </form>
      </div>

      {/* Block 1: Social Caption for the Image Set — Label Stacked Above Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="social-caption-textarea"
            className="text-xs font-semibold text-[#F3D36B]"
          >
            Social Caption (Instagram, Square & TikTok)
          </label>
          <button
            type="button"
            onClick={() => handleCopyText(copyDraft.socialCaption, "social")}
            className="px-2.5 py-1 text-xs font-medium border border-[#00E5CC]/50 hover:border-[#00E5CC] text-[#00E5CC] hover:bg-[#00E5CC]/10 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedField === "social" ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
        <textarea
          id="social-caption-textarea"
          rows={6}
          value={copyDraft.socialCaption}
          onChange={(e) =>
            onChangeCopy({ ...copyDraft, socialCaption: e.target.value })
          }
          className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-xl px-3.5 py-2.5 text-xs text-white leading-relaxed focus:outline-none focus:border-[#00E5CC]"
        />
      </div>

      {/* Researched Hashtags (1-3 Tags with 850k-1.5M Post Count or Unverified Notice) */}
      <div className="p-3.5 rounded-xl bg-[#0D0716] border border-[#D4AF37]/35 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#F3D36B]">
            Researched Hashtags (1–3 Tags · Target 850,000–1,500,000 Posts)
          </span>
        </div>

        <div className="space-y-2">
          {(copyDraft.hashtags || []).map((item, idx) => (
            <div
              key={`${item.tag}-${idx}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-[#140B22] border border-[#D4AF37]/30 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-spec font-semibold text-[#00E5CC]">
                    {item.tag}
                  </span>
                  <span aria-hidden="true" className="text-purple-300/40">
                    —
                  </span>
                  <span
                    className={
                      item.verified
                        ? "text-[#F3D36B] font-medium"
                        : "text-purple-200/80 italic"
                    }
                  >
                    {item.countText}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  handleQuickPrompt(
                    `Swap the hashtag ${item.tag} for a different relevant hashtag researched via Google Search (target 850,000 to 1,500,000 posts; if the count cannot be verified in search results, state 'Count not verified in search results').`
                  )
                }
                className="px-2.5 py-1 text-[11px] font-medium border border-[#D4AF37]/40 hover:border-[#F3D36B] text-[#F3D36B] rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
              >
                Swap {item.tag}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* AI-Generated Content Note — Label Stacked Above Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="ai-disclosure-note-input"
          className="block text-xs font-semibold text-[#00E5CC]"
        >
          AI-Generated Content Note (Included on AI-Generated Images)
        </label>
        <input
          id="ai-disclosure-note-input"
          type="text"
          value={
            copyDraft.aiDisclosureNote ||
            "AI Content Note: Product scene visual generated with AI from our studio master image."
          }
          onChange={(e) => {
            const newNote = e.target.value;
            onChangeCopy({
              ...copyDraft,
              aiDisclosureNote: newNote,
            });
          }}
          className="w-full bg-[#09050F] border border-[#00E5CC]/40 rounded-lg px-3 py-2 text-xs text-purple-100 focus:outline-none focus:border-[#00E5CC]"
        />
      </div>

      {/* Block 2: Pinterest Pin Title — Label Stacked Above Field */}
      <div className="space-y-2 pt-3 border-t border-[#D4AF37]/20">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="pinterest-title-input"
            className="text-xs font-semibold text-[#F3D36B]"
          >
            Pinterest Pin Title
          </label>
          <button
            type="button"
            onClick={() => handleCopyText(copyDraft.pinterestTitle, "pinTitle")}
            className="px-2.5 py-1 text-xs font-medium border border-[#00E5CC]/50 hover:border-[#00E5CC] text-[#00E5CC] hover:bg-[#00E5CC]/10 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedField === "pinTitle" ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
        <input
          id="pinterest-title-input"
          type="text"
          value={copyDraft.pinterestTitle}
          onChange={(e) =>
            onChangeCopy({ ...copyDraft, pinterestTitle: e.target.value })
          }
          className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#00E5CC]"
        />
      </div>

      {/* Block 3: Pinterest Pin Description — Label Stacked Above Field */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="pinterest-desc-textarea"
            className="text-xs font-semibold text-[#F3D36B]"
          >
            Pinterest Pin Description
          </label>
          <button
            type="button"
            onClick={() => handleCopyText(copyDraft.pinterestDescription, "pinDesc")}
            className="px-2.5 py-1 text-xs font-medium border border-[#00E5CC]/50 hover:border-[#00E5CC] text-[#00E5CC] hover:bg-[#00E5CC]/10 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedField === "pinDesc" ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
        <textarea
          id="pinterest-desc-textarea"
          rows={4}
          value={copyDraft.pinterestDescription}
          onChange={(e) =>
            onChangeCopy({ ...copyDraft, pinterestDescription: e.target.value })
          }
          className="w-full bg-[#09050F] border border-[#D4AF37]/45 rounded-xl px-3.5 py-2.5 text-xs text-white leading-relaxed focus:outline-none focus:border-[#00E5CC]"
        />
      </div>

      {/* Copy Both Pin Title + Description */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() =>
            handleCopyText(
              `${copyDraft.pinterestTitle}\n\n${copyDraft.pinterestDescription}`,
              "pinBoth"
            )
          }
          className="w-full py-2 px-3 text-xs font-medium border border-[#D4AF37]/45 hover:border-[#F3D36B] text-[#F3D36B] hover:bg-[#D4AF37]/10 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {copiedField === "pinBoth" ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#00E5CC]" />
              Copied Full Pinterest Text
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy Pin Title + Description Together
            </>
          )}
        </button>
      </div>

      {/* Google Search Grounding Sources (When Returned by Live Search) */}
      {copyDraft.searchSources && copyDraft.searchSources.length > 0 && (
        <div className="pt-3 border-t border-[#D4AF37]/20 space-y-1.5 text-xs">
          <span className="block font-semibold text-[#00E5CC]">
            Google Search Grounding Sources
          </span>
          <ul className="space-y-1">
            {copyDraft.searchSources.slice(0, 4).map((src, i) => (
              <li key={`${src.uri}-${i}`}>
                <a
                  href={src.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-200/80 hover:text-[#F3D36B] underline underline-offset-2 flex items-center gap-1 truncate"
                >
                  <ExternalLink className="w-3 h-3 shrink-0 text-[#00E5CC]" />
                  <span className="truncate">{src.title || src.uri}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};
