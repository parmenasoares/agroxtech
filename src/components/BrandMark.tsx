import logoAgroX from "@/assets/agro-x-logo.png";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function BrandMark({ className }: Props) {
  return (
    <img
      src={logoAgroX}
      alt="AGRO-X CONTROL"
      className={cn("h-6 w-auto", className)}
      loading="eager"
      decoding="async"
    />
  );
}
