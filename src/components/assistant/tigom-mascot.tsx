import { forwardRef, type SVGProps } from "react";
import { cn } from "@/lib/utils";

export const TigomMascot = forwardRef<SVGSVGElement, { className?: string; title?: string } & SVGProps<SVGSVGElement>>(function TigomMascot({ className, title = "TIGOM companion", ...props }, ref) {
  return (
    <svg
      ref={ref}
      viewBox="17 9 94 110"
      role="img"
      aria-label={title}
      className={cn("h-full w-full", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>{title}</title>
      <ellipse cx="64" cy="116" rx="31" ry="5" fill="#064E3B" fillOpacity=".1" />
      <path d="M39 76c-8 4-13 11-16 20-1 4 1 7 5 7 3 0 5-2 6-5 2-5 5-8 9-11" fill="#34D399" stroke="#064E3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M88 76c8 4 13 11 16 20 1 4-1 7-5 7-3 0-5-2-6-5-2-5-5-8-9-11" fill="#34D399" stroke="#064E3B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 76c0-8 6-14 14-14h20c8 0 14 6 14 14v27c0 7-6 13-13 13H53c-7 0-13-6-13-13V76Z" fill="#047857" stroke="#064E3B" strokeWidth="3" />
      <path d="M49 93h30c4 0 7 3 7 7v8H42v-8c0-4 3-7 7-7Z" fill="#D1FAE5" />
      <path d="M57 101h14" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 40c0-17 11-29 25-29s25 12 25 29v13c0 17-11 29-25 29S39 70 39 53V40Z" fill="#10B981" stroke="#064E3B" strokeWidth="3" />
      <path d="M40 39c2-16 11-26 24-26 12 0 21 10 24 26-8-1-14-5-18-12-7 7-17 11-30 12Z" fill="#047857" />
      <g className="tigom-mascot-savings-wave" data-mascot-wave-arm>
        <path d="M39 43c-6 0-10 4-10 9s4 9 10 9h3V43h-3Z" fill="#A7F3D0" stroke="#064E3B" strokeWidth="2.5" />
        <circle className="tigom-mascot-coin" cx="28" cy="36" r="7" fill="#FBBF24" stroke="#064E3B" strokeWidth="2" />
        <path d="M28 32v8m-2-6h3.2a1.5 1.5 0 0 1 0 3H27" stroke="#064E3B" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <path d="M89 43c6 0 10 4 10 9s-4 9-10 9h-3V43h3Z" fill="#A7F3D0" stroke="#064E3B" strokeWidth="2.5" />
      <g className="tigom-mascot-eyes">
        <ellipse cx="56.5" cy="46" rx="8" ry="10" fill="#F8FAFC" />
        <ellipse cx="74.5" cy="46" rx="8" ry="10" fill="#F8FAFC" />
        <ellipse cx="58" cy="47" rx="3.3" ry="4.8" fill="#064E3B" />
        <ellipse cx="73" cy="47" rx="3.3" ry="4.8" fill="#064E3B" />
        <circle cx="59" cy="44.8" r="1.4" fill="white" />
        <circle cx="74" cy="44.8" r="1.4" fill="white" />
      </g>
      <ellipse cx="46" cy="59" rx="4" ry="2.5" fill="#FDA4AF" fillOpacity=".75" />
      <ellipse cx="82" cy="59" rx="4" ry="2.5" fill="#FDA4AF" fillOpacity=".75" />
      <path d="M58 59c2 4 5 6 8 6 4 0 7-2 9-6" stroke="#064E3B" strokeWidth="3" strokeLinecap="round" />
      <path d="M46 36c3-3 7-4 10-3m12 0c4-1 7 0 10 3" stroke="#064E3B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m84 20 2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="#FBBF24" stroke="#064E3B" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="m32 27 1.4 2.6L36 31l-2.6 1.4L32 35l-1.4-2.6L28 31l2.6-1.4L32 27Z" fill="#A7F3D0" />
    </svg>
  );
});
