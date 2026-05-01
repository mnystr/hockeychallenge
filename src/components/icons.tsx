type IconProps = React.SVGProps<SVGSVGElement>;

export function Trophy(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v4a5 5 0 1 1-10 0V4Z" fill="currentColor" fillOpacity="0.18" />
      <path d="M17 6h2.5a1.5 1.5 0 0 1 0 3H17" />
      <path d="M7 6H4.5a1.5 1.5 0 0 0 0 3H7" />
      <path d="M9 13h6" />
    </svg>
  );
}

export function Medal(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="15" r="5" fill="currentColor" fillOpacity="0.18" />
      <path d="M8 4l2 6" />
      <path d="M16 4l-2 6" />
      <path d="M7 4h10" />
    </svg>
  );
}

export function Star(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.4 5.9 21l1.5-6.8L2.2 9.5l6.9-.7L12 2.5Z" />
    </svg>
  );
}

export function Flame(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2.5c1.6 3 4.5 4.6 4.5 8.4 0 1.5-.5 2.7-1.5 3.6.7-1.7 0-3.5-1.7-4.4 0 2.7-1.6 3.7-1.6 5.5 0 1.2.7 2.1 1.7 2.4-2.6.4-5.1-1.5-5.1-4.4 0-2.5 1.7-3.7 1.7-6.6 0-1.6-.7-3-2-4.5 1.6 0 3.4-.5 4-1.4Z" />
    </svg>
  );
}

export function Bolt(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
    </svg>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function Plus(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Minus(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12h14" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function Bell(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5 1.5 7H4.5C4.5 13 6 12 6 8Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function Home(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  );
}

export function Shield(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
    </svg>
  );
}

export function ShieldStar(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z" />
      <path
        d="M12 8.5 12.8 10.9 15.3 10.9 13.3 12.4 14.1 14.8 12 13.4 9.9 14.8 10.7 12.4 8.7 10.9 11.2 10.9Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function Target(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function Users(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14a5 5 0 0 1 5 5" />
    </svg>
  );
}

export function User(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function Sparkles(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2.5 13.6 8 19 9.5 13.6 11 12 16.5 10.4 11 5 9.5 10.4 8 12 2.5Z" />
      <path d="M19 14.5 19.7 17 22 17.7 19.7 18.4 19 21l-.7-2.6L16 17.7l2.3-.7Z" opacity="0.7" />
      <path d="M5 14.5 5.7 17 8 17.7 5.7 18.4 5 21l-.7-2.6L2 17.7l2.3-.7Z" opacity="0.7" />
    </svg>
  );
}
