import { useLanguage } from '@/hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import logoAgroX from '@/assets/agro-x-logo.png';

const LanguageSelect = () => {
  const {
    setLanguage
  } = useLanguage();
  const navigate = useNavigate();
  const handleLanguageSelect = (lang: 'pt' | 'en') => {
    setLanguage(lang);
    navigate('/login');
  };
  return <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-4">
          <img
            src={logoAgroX}
            alt="AGRO-X CONTROL"
            className="mx-auto h-12 w-auto"
            loading="eager"
            decoding="async"
          />
          <h1 className="text-3xl font-bold tracking-tight">AGRO-X CONTROL</h1>
          <p className="text-muted-foreground">Select your language / Selecione o idioma</p>
        </div>

        <Card className="border-primary/30 bg-primary/5 p-4 text-left">
          <p className="text-sm font-semibold text-primary">
            O problema não é ter dinheiro. O problema é quando o dinheiro passa a ter você.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sabedoria financeira começa no coração. Quem gasta sem consciência vive refém da ansiedade.
          </p>
          <p className="mt-2 text-xs font-medium text-primary">
            Soluções personalizadas para RYROX RENTAL. Cada linha de código é feita especial para os únicos.
          </p>
        </Card>

        <div className="space-y-3">
          <Button variant="outline" size="lg" className="w-full h-16 text-lg font-semibold" onClick={() => handleLanguageSelect('pt')}>
            🇵🇹 Português (Portugal)
          </Button>
          <Button variant="outline" size="lg" className="w-full h-16 text-lg font-semibold" onClick={() => handleLanguageSelect('en')}>
            🇺🇸 English
          </Button>
        </div>
      </Card>
    </div>;
};
export default LanguageSelect;