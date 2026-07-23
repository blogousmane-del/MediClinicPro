import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search,
  Plus,
  Bell,
  AlertTriangle,
  CheckCircle2,
  MoreHorizontal,
  Edit3,
  Trash2
} from 'lucide-react';

const PHARMACY_MED_CATALOG = [
  'Amoxicilline 500mg',
  'Amoxicilline 1g',
  'Amoxicilline + Acide Clavulanique (Augmentin) 1g',
  'Paracétamol 500mg',
  'Paracétamol (Doliprane) 1000mg',
  'Paracétamol Sirop 125ml',
  'Ibuprofène 400mg',
  'Ibuprofène Sirop 100ml',
  'Artéméther + Luméfantrine (Coartem) 20/120mg',
  'Métformine 850mg',
  'Métformine 500mg',
  'Lisinopril 10mg',
  'Amlodipine 5mg',
  'Oméprazole 20mg',
  'Dompéridone 10mg',
  'Spasfon (Phloroglucinol) 80mg',
  'Smecta (Diosmectite) Sachet',
  'Sels de réhydratation orale (SRO)',
  'Ciprofloxacine 500mg',
  'Azithromycine 500mg',
  'Flagyl (Métronidazole) 500mg',
  'Fer + Acide Folique (Fumafer)',
  'Vitamine C 1000mg Effervescent',
  'Diclofénac 50mg',
  'Tramadol 50mg',
  'Autre (Saisir manuellement)'
];

const PHARMACY_FORMS = [
  'Comprimé',
  'Gélule',
  'Sirop / Liquide',
  'Injectable',
  'Sachet',
  'Pommade / Gel',
  'Gouttes',
  'Suppositoire',
  'Autre'
];

interface Medication {
  id: number;
  name: string;
  form: string;
  dosage: string;
  stock_quantity: number;
  min_stock_threshold: number;
  price_purchase: number;
  price_sale: number;
  expiry_date: string;
  batch_number: string;
  supplier: string;
}

export const PharmacyPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [search, setSearch] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'critical' | 'expiring'>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Modal State for adding/replenishing medication
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMedId, setEditingMedId] = useState<number | null>(null);
  const [nameSelect, setNameSelect] = useState<string>('Amoxicilline 500mg');
  const [customName, setCustomName] = useState<string>('');
  const [form, setForm] = useState<string>('Comprimé');
  const [quantity, setQuantity] = useState<string>('50');
  const [pricePurchase, setPricePurchase] = useState<string>('850');
  const [priceSale, setPriceSale] = useState<string>('1200');
  const [expiryDate, setExpiryDate] = useState<string>('2026-12-31');
  const [batchNumber, setBatchNumber] = useState<string>('U3KFJT');
  const [supplier, setSupplier] = useState<string>('Pharmaliv');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchMedications = async () => {
    try {
      setLoading(true);
      const data = await api.get('/pharmacy/medications');
      setMedications(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, []);

  const handleOpenAddModal = (medItem?: any) => {
    if (medItem) {
      setEditingMedId(medItem.id);
      setNameSelect(PHARMACY_MED_CATALOG.includes(medItem.name) ? medItem.name : 'Autre (Saisir manuellement)');
      setCustomName(PHARMACY_MED_CATALOG.includes(medItem.name) ? '' : medItem.name);
      setForm(medItem.form || 'Comprimé');
      setQuantity(medItem.stock_quantity ? medItem.stock_quantity.toString() : '50');
      setPricePurchase(medItem.price_purchase ? medItem.price_purchase.toString() : '850');
      setPriceSale(medItem.price_sale ? medItem.price_sale.toString() : '1200');
      setExpiryDate(medItem.expiry || '2026-12-31');
      setBatchNumber(medItem.ref ? medItem.ref.replace('#', '') : 'U3KFJT');
      setSupplier(medItem.supplier || 'Pharmaliv');
    } else {
      setEditingMedId(null);
      setNameSelect('Amoxicilline 500mg');
      setCustomName('');
      setForm('Comprimé');
      setQuantity('50');
      setPricePurchase('850');
      setPriceSale('1200');
      setExpiryDate('2026-12-31');
      setBatchNumber('U3KFJT');
      setSupplier('Pharmaliv');
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMedId(null);
    setNameSelect('Amoxicilline 500mg');
    setCustomName('');
  };

  const handleReplenishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalMedName = nameSelect === 'Autre (Saisir manuellement)' ? (customName || 'Médicament Spécial') : nameSelect;

    if (!finalMedName || !quantity || !pricePurchase || !priceSale) {
      showToast('error', 'Champs obligatoires', 'Veuillez remplir le nom, la quantité et les prix.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: finalMedName,
        form,
        dosage: '500mg',
        qty: parseInt(quantity),
        pricePurchase: parseFloat(pricePurchase),
        priceSale: parseFloat(priceSale),
        expiryDate: expiryDate || '2026-12-31',
        batchNumber: batchNumber || 'U3KFJT',
        supplier: supplier || 'Pharmaliv'
      };

      await api.post('/pharmacy/replenish', payload);
      showToast(
        'success',
        editingMedId ? 'Stock mis à jour' : 'Médicament ajouté',
        `Le médicament ${finalMedName} (${form}) a été ${editingMedId ? 'mis à jour' : 'enregistré'}.`
      );

      handleCloseModal();
      fetchMedications();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec d\'enregistrement', err.error || 'Erreur lors de la mise à jour du stock.');
    } finally {
      setIsSaving(false);
    }
  };

  const itemsToRender = (medications || []).map(m => {
    const marginPct = m.price_purchase ? Math.round(((m.price_sale - m.price_purchase) / m.price_sale) * 100) : 0;
    const status = m.stock_quantity <= Math.floor(m.min_stock_threshold / 2) ? 'Critique' : m.stock_quantity <= m.min_stock_threshold ? 'Faible' : 'OK';
    const expiryDate = m.expiry_date ? new Date(m.expiry_date) : null;
    const daysToExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const nearExpiry = daysToExpiry !== null && daysToExpiry <= 30;

    return {
      id: m.id,
      name: `${m.name} ${m.dosage || ''}`.trim(),
      form: m.form || 'Comprimé',
      ref: m.batch_number ? `#${m.batch_number}` : 'N/A',
      supplier: m.supplier || 'Non renseigné',
      packaging: 'Boîte standard',
      stock_min: m.min_stock_threshold,
      price_purchase: m.price_purchase,
      price_sale: m.price_sale,
      margin: `${marginPct}%`,
      expiry: m.expiry_date ? m.expiry_date.split('T')[0] : null,
      replenish_time: 'Récemment',
      stock_quantity: m.stock_quantity,
      status,
      near_expiry: nearExpiry
    };
  });

  // Filter items based on tab & search
  const filteredItems = itemsToRender.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.supplier.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterTab === 'critical') return item.status === 'Critique' || item.status === 'Faible';
    if (filterTab === 'expiring') return item.near_expiry;
    return true;
  });

  const totalStockValue = itemsToRender.reduce((acc, curr) => acc + (curr.stock_quantity * curr.price_sale), 0);
  const criticalCount = itemsToRender.filter(i => i.status === 'Critique').length;
  const expiringCount = itemsToRender.filter(i => i.near_expiry).length;
  const avgMarginPct = itemsToRender.length > 0
    ? Math.round(itemsToRender.reduce((acc, curr) => acc + parseInt(curr.margin), 0) / itemsToRender.length)
    : 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '1.5rem 2rem',
      backgroundColor: 'var(--bg-primary)',
      minHeight: 'calc(100vh - var(--header-height))',
      boxSizing: 'border-box'
    }}>
      
      {/* 1. Header Breadcrumb matching Image 2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, fontFamily: 'var(--font-secondary)', color: 'var(--text-primary)', margin: 0 }}>
            Gestion de la pharmacie
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px', margin: 0 }}>
            Lundi 14 juillet 2025
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Rechercher un patient..."
              className="input-control"
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-secondary)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          <div style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)'
            }}>
              <Bell size={18} />
            </div>
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 700,
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-primary)'
            }}>3</span>
          </div>
        </div>
      </div>

      {/* 2. Main Title & Action Button matching Image 2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-secondary)' }}>
            Inventaire pharmacie
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2px', margin: 0 }}>
            {itemsToRender.length} articles · Valeur stock : {totalStockValue.toLocaleString()} FCFA
          </p>
        </div>

        {['admin', 'pharmacist', 'manager'].includes(user?.role || '') && (
          <button
            onClick={() => handleOpenAddModal()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              backgroundColor: '#1e4d40',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(30, 77, 64, 0.25)',
              transition: 'var(--transition)'
            }}
          >
            <Plus size={18} />
            <span>Ajouter un médicament</span>
          </button>
        )}
      </div>

      {/* 3. Filter Tabs & Search Bar Row matching Image 2 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setFilterTab('all')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: filterTab === 'all' ? '#1e4d40' : 'var(--bg-secondary)',
              color: filterTab === 'all' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Tous ({itemsToRender.length})
          </button>

          <button
            onClick={() => setFilterTab('critical')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: filterTab === 'critical' ? '#1e4d40' : 'var(--bg-secondary)',
              color: filterTab === 'critical' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Stock critique ({criticalCount})
          </button>

          <button
            onClick={() => setFilterTab('expiring')}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: filterTab === 'expiring' ? '#1e4d40' : 'var(--bg-secondary)',
              color: filterTab === 'expiring' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Expire bientôt ({expiringCount})
          </button>
        </div>

        <div style={{ position: 'relative', width: '240px' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Chercher médicament..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-secondary)',
              fontSize: '0.825rem',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* 4. Metrics Summary Cards Grid matching Image 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #1e4d40',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {totalStockValue.toLocaleString()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
            Valeur totale FCFA
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #ef4444',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444' }}>
            {criticalCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
            Stock critique
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #ea580c',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ea580c' }}>
            {expiringCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
            Expire bientôt
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderTop: '4px solid #10b981',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>
            {avgMarginPct}%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>
            Marge moyenne
          </div>
        </div>
      </div>

      {/* 5. Medication Cards List matching Image 2 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Aucun médicament trouvé.
          </div>
        )}
        {filteredItems.map((med) => {
          let statusBadge = null;
          if (med.status === 'Critique') {
            statusBadge = (
              <span style={{
                backgroundColor: '#ef4444',
                color: '#ffffff',
                padding: '4px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <AlertTriangle size={13} />
                Critique
              </span>
            );
          } else if (med.status === 'Faible') {
            statusBadge = (
              <span style={{
                backgroundColor: '#ea580c',
                color: '#ffffff',
                padding: '4px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <AlertTriangle size={13} />
                Faible
              </span>
            );
          } else {
            statusBadge = (
              <span style={{
                backgroundColor: '#10b981',
                color: '#ffffff',
                padding: '4px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <CheckCircle2 size={13} />
                OK
              </span>
            );
          }

          return (
            <div
              key={med.id}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                transition: 'var(--transition)'
              }}
            >
              {/* Top Row: Name, Tags, Subtitle & Stock Count */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {med.name}
                    </h3>

                    {/* Form Tag */}
                    <span style={{
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.725rem',
                      fontWeight: 600
                    }}>
                      {med.form}
                    </span>

                    {/* Expire bientôt Tag */}
                    {med.near_expiry && (
                      <span style={{
                        backgroundColor: '#fff7ed',
                        color: '#ea580c',
                        border: '1px solid #ffedd5',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.725rem',
                        fontWeight: 600
                      }}>
                        Expire bientôt
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    {med.supplier} · {med.packaging} · Réf. {med.ref}
                  </p>
                </div>

                {/* Big Stock Quantity on right */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    color: med.status === 'Critique' ? '#ef4444' : med.status === 'Faible' ? '#ea580c' : '#10b981'
                  }}>
                    {med.stock_quantity}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    En stock
                  </span>
                </div>
              </div>

              {/* Bottom Details Grid & Action Buttons matching Image 2 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.85rem'
              }}>
                {/* Stats Grid */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.75rem',
                  flexWrap: 'wrap',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)'
                }}>
                  <div>
                    <span>Stock min.</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{med.stock_min}</div>
                  </div>

                  <div>
                    <span>P.U. achat</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{med.price_purchase.toLocaleString()} FCFA</div>
                  </div>

                  <div>
                    <span>P.U. vente</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{med.price_sale.toLocaleString()} FCFA</div>
                  </div>

                  <div>
                    <span>Marge</span>
                    <div style={{ fontWeight: 700, color: '#10b981', marginTop: '2px' }}>{med.margin}</div>
                  </div>

                  <div>
                    <span>Expiration</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{med.expiry}</div>
                  </div>

                  <div>
                    <span>Réappro.</span>
                    <div style={{ fontWeight: 700, color: 'var(--text-muted)', marginTop: '2px' }}>{med.replenish_time}</div>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {statusBadge}

                  <button
                    onClick={() => handleOpenAddModal(med)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    Ajout
                  </button>

                  <button
                    onClick={() => handleOpenAddModal(med)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      width: '30px',
                      height: '30px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                    title="Modifier"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* REPLENISHMENT / ADD MEDICATION MODAL WITH DROPDOWN & AUTRE */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {editingMedId ? 'Modifier / Réapprovisionner le produit' : 'Ajouter / Approvisionner un médicament'}
              </h3>
              <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleReplenishSubmit}>
              <div className="modal-body modal-grid">
                
                {/* NOM DU MÉDICAMENT DÉROULANT OU AUTRE */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Nom du médicament *
                  </label>
                  <select
                    value={nameSelect}
                    onChange={e => setNameSelect(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', marginTop: '4px' }}
                    required
                  >
                    {PHARMACY_MED_CATALOG.map((m, idx) => (
                      <option key={idx} value={m}>{m}</option>
                    ))}
                  </select>

                  {/* IF "AUTRE" SELECTED: SHOW MANUAL CUSTOM TEXT INPUT */}
                  {nameSelect === 'Autre (Saisir manuellement)' && (
                    <div style={{ marginTop: '8px' }}>
                      <input
                        type="text"
                        placeholder="Saisir le nom spécifique du médicament (ex: Doliprane 1000mg, Spasfon 80mg)..."
                        value={customName}
                        onChange={e => setCustomName(e.target.value)}
                        className="input-control"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: '#e6f4ea', border: '1px solid #1e4d40' }}
                        required
                      />
                    </div>
                  )}
                </div>

                {/* FORME GALÉNIQUE DÉROULANTE */}
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Forme galénique *
                  </label>
                  <select
                    value={form}
                    onChange={e => setForm(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', marginTop: '4px' }}
                  >
                    {PHARMACY_FORMS.map((f, idx) => (
                      <option key={idx} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* QUANTITÉ REÇUE */}
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Quantité reçue *
                  </label>
                  <input
                    type="number"
                    placeholder="Ex: 50"
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', marginTop: '4px' }}
                    required
                  />
                </div>

                {/* PRIX ACHAT */}
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Prix d'achat unitaire (FCFA) *
                  </label>
                  <input
                    type="number"
                    placeholder="Ex: 850"
                    value={pricePurchase}
                    onChange={e => setPricePurchase(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', marginTop: '4px' }}
                    required
                  />
                </div>

                {/* PRIX VENTE */}
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Prix de vente unitaire (FCFA) *
                  </label>
                  <input
                    type="number"
                    placeholder="Ex: 1200"
                    value={priceSale}
                    onChange={e => setPriceSale(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', marginTop: '4px' }}
                    required
                  />
                </div>

                {/* N° LOT */}
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Numéro de lot / Réf.
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: U3KFJT"
                    value={batchNumber}
                    onChange={e => setBatchNumber(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', marginTop: '4px' }}
                  />
                </div>

                {/* EXPIRATION */}
                <div className="form-group">
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Date d'expiration
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', marginTop: '4px' }}
                  />
                </div>

                {/* FOURNISSEUR */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Fournisseur
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Pharmaliv"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                    className="input-control"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', marginTop: '4px' }}
                  />
                </div>

              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={handleCloseModal} className="btn btn-secondary">Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ backgroundColor: '#1e4d40' }}>
                  {isSaving ? 'Enregistrement...' : '✓ Enregistrer le produit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
