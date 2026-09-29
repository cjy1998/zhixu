export function BrandMark({ className }: { className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="34" height="34" rx="10" fill="#276b56" />
        <path
          d="M12 26V15a4 4 0 0 1 4-4h11M12 22h10a5 5 0 0 0 0-10"
          stroke="#f0f5e8"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <circle cx="26" cy="27" r="3" fill="#b8cd98" />
      </svg>
    </div>
  );
}

export function HeroPlant({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 280 160" fill="none" aria-hidden="true">
      <ellipse cx="151" cy="143" rx="107" ry="9" fill="#dfe8d5" />
      <path d="M66 138v-27h47V84h48V58h49v80H66Z" fill="#d3dfc6" />
      <path d="M66 111h47V84h48V58h49" stroke="#b6caa2" strokeWidth="1.2" />
      <path d="M94 98V47" stroke="#8eac77" strokeWidth="2" />
      <path d="M94 74c-27-1-35-18-30-27 22 0 33 12 30 27Z" fill="#a4bd8c" />
      <path d="M94 61c-4-20 11-33 23-31 4 17-7 29-23 31Z" fill="#8ba875" />
      <path d="M201 58V25" stroke="#799663" strokeWidth="1.5" />
      <path d="M201 24h23l-6 8 6 8h-23V24Z" fill="#7e9d67" />
      <path d="M132 109v-18" stroke="#91ac7c" strokeWidth="1.7" />
      <path d="M132 103c-13-1-18-9-15-16 11 0 17 7 15 16Z" fill="#b0c69a" />
      <path d="M132 98c-1-11 6-17 14-16 1 9-5 16-14 16Z" fill="#9db987" />
      <rect x="116" y="111" width="33" height="26" rx="4" fill="#c1d1ae" />
      <circle cx="177" cy="25" r="5" fill="#cedaa4" />
      <path d="M154 48h8m-4-4v8M238 79h7m-3.5-3.5v7" stroke="#b0c29a" strokeWidth="1.5" />
      <path d="m66 139 15-15m11-8 13-9m16-10 10-6m43-25 9-7" stroke="#a7bd91" strokeWidth="1.4" strokeDasharray="3 4" />
    </svg>
  );
}

export function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 250 175" fill="none" aria-hidden="true">
      <ellipse cx="126" cy="155" rx="96" ry="9" fill="#e9eedf" />
      <rect
        x="54"
        y="31"
        width="138"
        height="114"
        rx="10"
        fill="#eff4e7"
        stroke="#dce7d0"
        transform="rotate(-6 54 31)"
      />
      <rect x="62" y="25" width="136" height="118" rx="10" fill="white" stroke="#dce7d0" />
      <path d="M78 44h59m-59 9h83" stroke="#dce8d0" strokeWidth="4" strokeLinecap="round" />
      <path d="M88 74v37a10 10 0 0 0 10 10h67" stroke="#cfddbf" strokeWidth="1.5" strokeDasharray="4 4" />
      <circle cx="88" cy="75" r="8" fill="#e6f0d8" />
      <path d="m84 75 3 3 5-6" stroke="#89a56e" strokeWidth="1.5" />
      <rect x="105" y="68" width="74" height="15" rx="4" fill="#f2f6eb" />
      <circle cx="123" cy="120" r="8" fill="#edf3e3" stroke="#d8e4c9" />
      <circle cx="167" cy="120" r="8" fill="#edf3e3" stroke="#d8e4c9" />
      <path d="M123 116v8m-4-4h8" stroke="#a4bc8c" />
      <path
        d="M34 134V87m0 23c-15-1-19-10-17-17 13 0 20 8 17 17Zm0-10c-2-13 7-22 17-21 2 13-5 21-17 21Z"
        fill="#c7d7b5"
        stroke="#b5cda0"
      />
      <path d="M216 53v-9m-4 4.5h8m-1 55h6m-3-3v6" stroke="#c5d6af" strokeWidth="2" />
    </svg>
  );
}
