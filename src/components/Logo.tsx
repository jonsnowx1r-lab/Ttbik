/** Small brand mark — a custom-drawn icon instead of an emoji, so it renders
 * identically across every device instead of varying by OS emoji font. */
export default function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" className="fill-brand-600" />
      <path
        d="M8 15.5 14.8 8.7a1.6 1.6 0 0 1 2.3 2.3L10.3 17.8a1.9 1.9 0 0 1-1.3.55H7v-2a1.9 1.9 0 0 1 .55-1.33Z"
        stroke="white"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M13 10.5l2.3 2.3" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
