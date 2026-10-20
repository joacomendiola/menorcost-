interface LogoProps {
  size?: number;
}

export function Logo({ size = 26 }: LogoProps) {
  const alto = Math.round((size * 22) / 26);

  return (
    <span className="logo" aria-label="MENORCOST">
      <svg
        width={size}
        height={alto}
        viewBox="0 0 26 22"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 1.5h12.9c.7 0 1.3.3 1.7.9l6.2 8c.5.7.5 1.6 0 2.3l-6.2 8c-.4.6-1 .9-1.7.9H3c-1.1 0-2-.9-2-2V3.5c0-1.1.9-2 2-2Z"
          fill="#4A7BF0"
        />
        <circle cx="6.6" cy="11" r="2.2" fill="#FFFFFF" />
      </svg>
      <span>
        <span className="logo__menor">MENOR</span>
        <span className="logo__cost">COST</span>
      </span>
    </span>
  );
}
