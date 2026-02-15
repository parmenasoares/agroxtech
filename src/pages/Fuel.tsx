import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BrandMark } from '@/components/BrandMark';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const Fuel = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [kmHours, setKmHours] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const newToken = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
      setToken(newToken);
      setMessage(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!token) {
      setMessage('Por favor gere o token primeiro.');
      return;
    }
    setIsSaving(true);
    try {
      let lat: number | null = null;
      let lon: number | null = null;
      if (!location) {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lon = pos.coords.longitude;
              setLocation({ lat: lat!, lon: lon! });
              resolve();
            },
            () => resolve(),
            { timeout: 5000 }
          );
        });
      } else {
        lat = location.lat;
        lon = location.lon;
      }
      let imageUrl: string | null = null;
      if (file) {
        const filePath = `${token}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('fuelings')
          .upload(filePath, file);
        if (uploadError) {
          console.error(uploadError);
          setMessage('Erro ao enviar a imagem.');
        } else {
          const { data: publicData } = supabase.storage
            .from('fuelings')
            .getPublicUrl(filePath);
          imageUrl = publicData.publicUrl;
        }
      }
      const { error } = await supabase.from('fuelings').insert({
        token,
        value,
        km_hours: kmHours,
        image_url: imageUrl,
        latitude: lat,
        longitude: lon,
      });
      if (error) {
        console.error(error);
        setMessage('Erro ao salvar abastecimento.');
      } else {
        setMessage('Abastecimento registrado com sucesso!');
        setToken(null);
        setValue('');
        setKmHours('');
        setFile(null);
      }
    } catch (err) {
      console.error(err);
      setMessage('Erro inesperado.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
 
