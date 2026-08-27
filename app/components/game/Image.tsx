import type { ImgHTMLAttributes } from "react";

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
  priority?: boolean;
  unoptimized?: boolean;
};

export function Image({ alt, priority, unoptimized, ...props }: ImageProps) {
  return (
    <img
      {...props}
      alt={alt}
      decoding={unoptimized ? "async" : props.decoding}
      loading={priority ? "eager" : props.loading}
    />
  );
}
