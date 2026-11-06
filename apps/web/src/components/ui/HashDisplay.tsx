"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface HashDisplayProps {
  hash: string;
  truncate?: boolean;
  prefixLength?: number;
  suffixLength?: number;
  className?: string;
  showCopy?: boolean;
}

export function HashDisplay({
  hash,
  truncate = true,
  prefixLength = 6,
  suffixLength = 4,
  className = "",
  showCopy = true,
}: HashDisplayProps) {
  const [copied, setCopied] = useState(false);

  const display = truncate && hash.length > prefixLength + suffixLength
    ? `${hash.slice(0, prefixLength)}…${hash.slice(-suffixLength)}`
    : hash;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs max-w-full ${className}`}>
      <span
        className={`text-text select-all ${truncate ? "whitespace-nowrap" : "break-all"}`}
        title={hash}
      >
        {display}
      </span>
      {showCopy && (
        <button
          onClick={handleCopy}
          type="button"
          className="text-muted hover:text-text transition-colors p-1 -m-0.5 rounded-md shrink-0"
          title={copied ? "Copied" : "Copy full hash"}
          aria-label={copied ? "Copied to clipboard" : `Copy ${hash}`}
        >
          {copied ? (
            <span className="text-[11px] text-good font-medium">Copied</span>
          ) : (
            <Copy aria-hidden="true" className="w-3 h-3" />
          )}
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </span>
  );
}

