export function ChanakyaLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Rounded green background */}
      <rect width="40" height="40" rx="10" fill="#16a34a" />

      {/* Chess king crown — 3 spikes + base */}
      {/* Center spike with cross */}
      <rect x="18.5" y="7" width="3" height="6" fill="white" />
      <rect x="15.5" y="9.5" width="9" height="3" fill="white" />

      {/* Left and right spheres (knight-style tips) */}
      <circle cx="10" cy="14" r="3" fill="white" />
      <circle cx="30" cy="14" r="3" fill="white" />

      {/* Crown body — connects left ball, right ball and center spike */}
      <path
        d="M7 28 V22 L10 16 L15 23 L20 11 L25 23 L30 16 L33 22 V28 H7 Z"
        fill="white"
      />

      {/* Crown base band */}
      <rect x="6" y="27" width="28" height="5" rx="2.5" fill="white" />
    </svg>
  );
}
