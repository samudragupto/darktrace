interface AddressAvatarProps {
  address: string;
  size?: number;
  className?: string;
}

/**
 * Deterministic two-tone avatar for an address (wallet-style identity mark).
 * Pure presentation: the hues are derived from the address characters.
 */
export function AddressAvatar({ address, size = 32, className = "" }: AddressAvatarProps) {
  const hex = address.replace(/^0x/i, "").padEnd(12, "0");
  const h1 = parseInt(hex.slice(0, 4), 16) % 360;
  const h2 = (h1 + 40 + (parseInt(hex.slice(4, 6), 16) % 140)) % 360;
  const x = 20 + (parseInt(hex.slice(6, 8), 16) % 60);
  const y = 20 + (parseInt(hex.slice(8, 10), 16) % 60);
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 ${className}`}
      style={{ width: size, height: size, backgroundColor: `hsl(${h1} 62% 58%)` }}
    >
      <span
        className="absolute rounded-full"
        style={{
          width: size * 0.9,
          height: size * 0.9,
          left: `${x - 45}%`,
          top: `${y - 45}%`,
          backgroundColor: `hsl(${h2} 58% 42%)`,
        }}
      />
    </span>
  );
}
