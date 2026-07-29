function ShepherdStaffIcon({ className = 'w-7 h-7', color = '#E8821E' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 3.5c0 2.5-3 2.5-3 5s2 2.5 2 5" />
      <path d="M14 13v8" />
      <path d="M10.5 21h7" />
    </svg>
  )
}

export default ShepherdStaffIcon
