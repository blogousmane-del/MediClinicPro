import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface NotificationsSectionProps {
  clinics: { id: number; name: string }[];
  onSend: (payload: { title: string; body: string; targetAll: boolean; clinicIds?: number[] }) => Promise<void>;
}

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({ clinics, onSend }) => {
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [targetAll, setTargetAll] = useState<boolean>(true);
  const [selectedClinicIds, setSelectedClinicIds] = useState<number[]>([]);
  const [sending, setSending] = useState<boolean>(false);

  const toggleClinic = (id: number) => {
    setSelectedClinicIds(prev => (prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    if (!targetAll && selectedClinicIds.length === 0) return;

    const confirmMessage = targetAll
      ? `Envoyer cette notification à TOUTES les cliniques ?`
      : `Envoyer cette notification à ${selectedClinicIds.length} clinique(s) sélectionnée(s) ?`;
    if (!window.confirm(confirmMessage)) return;

    setSending(true);
    try {
      await onSend({ title, body, targetAll, clinicIds: targetAll ? undefined : selectedClinicIds });
      setTitle('');
      setBody('');
      setSelectedClinicIds([]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: '560px', padding: '1.5rem' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Titre
          <input
            type="text"
            className="input-control"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex : Maintenance prévue ce soir"
            required
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Message
          <textarea
            className="input-control"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Détails du message envoyé aux cliniques..."
            required
          />
        </label>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="radio" checked={targetAll} onChange={() => setTargetAll(true)} />
            Toutes les cliniques
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input type="radio" checked={!targetAll} onChange={() => setTargetAll(false)} />
            Cliniques spécifiques
          </label>
        </div>

        {!targetAll && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
            {clinics.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Aucune clinique disponible.</span>}
            {clinics.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedClinicIds.includes(c.id)}
                  onChange={() => toggleClinic(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={sending} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Send size={15} /> {sending ? 'Envoi...' : 'Envoyer la notification'}
        </button>
      </form>
    </div>
  );
};
