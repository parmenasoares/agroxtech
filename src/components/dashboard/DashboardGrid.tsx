import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type DashboardBtn = {
  icon: any;
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
              className="w-full h-28 sm:h-32 flex flex-col items-center justify-center gap-2 rounded-none text-base sm:text-lg font-semibold"
            >
              <Icon className="h-9 w-9" />
              <span className="text-center leading-tight px-2">{button.label}</span>
            </Button>
          </Card>
        );
      })}
    </div>
  );
};

export default DashboardGrid;
