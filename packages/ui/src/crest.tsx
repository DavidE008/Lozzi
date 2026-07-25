import type { SVGProps } from "react";

export const LozziCrest = ({
  title = "Lozzi",
  ...props
}: SVGProps<SVGSVGElement> & { readonly title?: string }) => (
  <svg
    aria-labelledby="lozzi-crest-title"
    fill="none"
    viewBox="0 0 64 72"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <title id="lozzi-crest-title">{title}</title>
    <path
      d="M32 2 58 13v20c0 17-10.4 30.1-26 37C16.4 63.1 6 50 6 33V13L32 2Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="m32 8 20 8.5V33c0 13.3-7.5 23.8-20 30.2C19.5 56.8 12 46.3 12 33V16.5L32 8Z"
      stroke="white"
      strokeWidth="2"
    />
    <path
      d="m32 14 1.7 3.5 3.8.5-2.7 2.7.7 3.8-3.5-1.8-3.5 1.8.7-3.8-2.7-2.7 3.8-.5L32 14Z"
      fill="#D4A017"
    />
    <path
      d="M18 28c5-2.8 9.5-2.6 14 1.2 4.5-3.8 9-4 14-1.2v16c-5-2.6-9.5-2.3-14 1.3-4.5-3.6-9-3.9-14-1.3V28Z"
      fill="white"
    />
    <path
      d="M32 29.2v16.1M16 48h32M23 52v7m6-7v10m6-10v10m6-10v7"
      stroke="white"
      strokeWidth="2"
    />
  </svg>
);
