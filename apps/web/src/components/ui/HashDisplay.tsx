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
        className={`text-text hover:underline cursor-pointer select-all ${truncate ? "" : "break-all"}`}
        title={hash}
      >
        {display}
      </span>
      {showCopy && (
        <button
          onClick={handleCopy}
          type="button"
          className="text-muted hover:text-accent transition-colors p-0.5 rounded focus:outline-none"
          title="Copy full hash"
        >
          {copied ? (
            <span className="text-[10px] text-good font-mono font-medium">COPIED</span>
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </button>
      )}
    </span>
  );
}

