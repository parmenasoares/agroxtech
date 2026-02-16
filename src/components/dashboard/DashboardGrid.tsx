import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

export type DashboardBtn = {
  icon: LucideIcon;
  label: string;
  path: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";
};

type Props = {
  items: DashboardBtn[];
  onNavigate: (path: string) => void;
};

const DashboardGrid = ({ items, onNavigate }: Props) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 max-w-5xl mx-auto">
      {items.map((button) => {
        const Icon = button.icon;
        return (
          <Card
            key={button.path}
            className="p-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onNavigate(button.path)}
          >
            <Button
              variant={button.variant}
              className="w-full h-40 sm:h-48 flex flex-col items-center justify-center gap-4 rounded-none text-lg sm:text-xl font-bold"
            >
              <Icon className="h-16 w-16 sm:h-20 sm:w-20" />
              <span className="text-center leading-tight px-2">{button.label}</span>
            </Button>
          </Card>
        );
      })}
    </div>
  );
};

export default DashboardGrid;
