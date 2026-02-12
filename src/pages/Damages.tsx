import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BrandMark } from '@/components/BrandMark';
import { ArrowLeft } from 'lucide-react';


const Damages = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <BrandMark />
          <h1 className="text-2xl font-bold">{t('damages')}</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Module coming soon...</p>
        </Card>
      </main>
    </div>
  );
};

export default Damages;
