import React from 'react';

interface AstorIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

export function AstorIcon({ size = 20, className = '', ...props }: AstorIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Elegant geometric monochrome 8-point faceted star mark */}
      <path
        d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <path
        d="M12 5.5L13.2 9.8L17.5 11L13.2 12.2L12 16.5L10.8 12.2L6.5 11L10.8 9.8L12 5.5Z"
        opacity="0.8"
        fill="currentColor"
      />
      <circle cx="17.5" cy="5.5" r="1.2" fill="currentColor" opacity="0.6" />
      <circle cx="6.5" cy="17.5" r="1" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
