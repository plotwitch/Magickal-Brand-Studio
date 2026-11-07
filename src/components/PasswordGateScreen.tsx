import React, { useState } from "react";
import { Lock } from "lucide-react";
import { TarotCircuitCorner } from "./TarotCircuitOrnament";

interface PasswordGateScreenProps {
  onUnlockSuccess: (token: string) => void;
}

export const PasswordGateScreen: React.FC<PasswordGateScreenProps> = ({
  onUnlockSuccess,
}) => {
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.unlocked && data.token) {
        onUnlockSuccess(data.token);
      } else {
        setErrorMessage("That password does not match.");
      }
    } catch {
      setErrorMessage("That password does not match.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12 text-[#F6F1FA]">
      <div className="relative w-full max-w-md tarot-card-frame rounded-2xl p-8 space-y-6">
        <TarotCircuitCorner position="top-left" />
        <TarotCircuitCorner position="top-right" />
        <TarotCircuitCorner position="bottom-left" />
        <TarotCircuitCorner position="bottom-right" />

        <div className="space-y-1.5 text-center pb-4 border-b border-[#D4AF37]/30">
          <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-[#00E5CC] mb-1">
            <Lock className="w-4 h-4 text-[#F3D36B]" />
            <span>The Plot Witch Studio</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-[#F3D36B]">
            Brand Builder
          </h1>
          <p className="text-xs text-purple-200/80">
            Enter the studio password to unlock the workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="studio-password-input"
              className="block text-xs font-semibold text-[#F3D36B] mb-2"
            >
              Password
            </label>
            <input
              id="studio-password-input"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              autoComplete="current-password"
              placeholder="Enter password"
              className="w-full bg-[#09050F] border border-[#D4AF37]/50 rounded-xl px-4 py-3 text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-[#00E5CC]"
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              aria-live="polite"
              className="text-xs font-semibold text-[#EB238E] bg-[#240B1E] border border-[#EB238E]/60 rounded-lg px-3.5 py-2.5"
            >
              That password does not match.
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-gold-glow w-full py-3 px-6 text-xs font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
};
