import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Users, Calendar, ShieldCheck } from 'lucide-react';

interface MobileQuickActionsBarProps {
  onQuickAction: (action: string) => void;
}

const ACTIONS: { action: string; label: string; icon: React.ComponentType<{ size?: number }>; roles: string[] }[] = [
  { action: 'new_patient', label: 'Patient', icon: Users, roles: ['admin', 'doctor', 'secretary', 'pharmacist', 'lab_tech', 'manager'] },
  { action: 'new_appt', label: 'Rendez-vous', icon: Calendar, roles: ['admin', 'doctor', 'secretary', 'manager'] },
  { action: 'new_deposit', label: 'Dépôt', icon: ShieldCheck, roles: ['admin', 'secretary', 'manager'] }
];

// Mobile-only shortcut bar for the most common "create" actions. Hidden on
// desktop via CSS (index.css .mobile-quick-actions) — desktop already has
// the full sidebar + per-page "new" buttons, so this bar is redundant there.
export const MobileQuickActionsBar: React.FC<MobileQuickActionsBarProps> = ({ onQuickAction }) => {
  const { user, subscription, suspended } = useAuth();
  if (!user) return null;

  // Ces trois raccourcis ouvrent tous un formulaire de création dans un module
  // fermé par l'expiration : la barre disparaît plutôt que d'offrir des actions
  // qui se heurteraient à l'écran de paiement.
  if (subscription.locked || suspended) return null;

  const items = ACTIONS.filter(a => a.roles.includes(user.role));
  if (items.length === 0) return null;

  return (
    <nav className="mobile-quick-actions" aria-label="Actions rapides">
      {items.map(item => {
        const Icon = item.icon;
        return (
          <button
            key={item.action}
            type="button"
            onClick={() => onQuickAction(item.action)}
            className="mobile-quick-actions-btn"
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileQuickActionsBar;
