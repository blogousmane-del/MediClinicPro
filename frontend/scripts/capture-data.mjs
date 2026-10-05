// Données d'exemple des captures de la vitrine (capture-screens.mjs) : une
// clinique fictive, son équipe, ses patients, son stock et sa caisse du jour.
// Tout est inventé, et la vitrine le dit sous les captures (« données
// d'exemple »). Les dates partent d'aujourd'hui : le tableau de bord montre
// toujours la journée en cours.
const now = new Date();
const year = now.getFullYear();
const at = (hour, minute, dayOffset = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};
const isoDay = (dayOffset) => at(12, 0, dayOffset).slice(0, 10);

const CLINIC = {
  id: 7,
  name: 'Cabinet Médical Les Palmiers',
  address: 'Cocody Riviera 3, Abidjan',
  phone: '+2250701020304',
  logo: '',
  plan: 'hopital',
  subscription_status: 'active',
  subscription_expires_at: at(9, 0, 120),
  // Clinique exonérée de TVA : les reçus montrent le total encaissé, sans ligne de TVA.
  settings: { vat_enabled: false },
};

const ME = {
  user: { id: 1, name: 'Mariam Koné', email: 'direction@palmiers.example', role: 'admin', passwordSet: true, availabilityStatus: 'available' },
  clinic: CLINIC,
  suspended: false,
};

const STAFF = [
  { id: 1, name: 'Mariam Koné', role: 'admin', specialty: null },
  { id: 2, name: 'Dr Serge Konan', role: 'doctor', specialty: 'Médecine générale' },
  { id: 3, name: 'Dr Awa Traoré', role: 'doctor', specialty: 'Pédiatrie' },
  { id: 4, name: 'Grâce Aka', role: 'secretary', specialty: null },
  { id: 5, name: 'Yves Ehui', role: 'pharmacist', specialty: null },
  { id: 6, name: 'Fatou Diabaté', role: 'lab_tech', specialty: null },
  { id: 7, name: 'Christelle Gnahoré', role: 'nurse', specialty: null },
].map((member) => ({
  ...member,
  clinic_id: CLINIC.id,
  active: 1,
  email: `equipe${member.id}@palmiers.example`,
  availability_status: 'available',
  work_schedule: null,
}));

const PATIENTS = [
  ['Aya', "N'Guessan", 'F', '1991-04-12', '+2250707112233', 'Pénicilline'],
  ['Mamadou', 'Coulibaly', 'M', '1978-09-03', '+2250505443322', ''],
  ['Adjoua', 'Kouassi', 'F', '2016-02-21', '+2250102334455', ''],
  ['Koffi', 'Yao', 'M', '1965-11-30', '+2250708991122', 'Aspirine'],
  ['Fatoumata', 'Bamba', 'F', '1988-07-17', '+2250545667788', ''],
  ['Jean-Baptiste', 'Kouamé', 'M', '1983-01-09', '+2250777889900', ''],
  ['Marie-Laure', 'Assi', 'F', '1995-05-25', '+2250103445566', 'Sulfamides'],
  ['Ibrahim', 'Touré', 'M', '2001-12-02', '+2250506778899', ''],
  ['Rose', 'Dosso', 'F', '1972-03-14', '+2250709223344', ''],
].map(([first_name, last_name, gender, birth_date, phone, allergies], index) => ({
  id: index + 1,
  clinic_id: CLINIC.id,
  folder_number: `MED-${year}-${String(412 - index * 37).padStart(4, '0')}`,
  first_name,
  last_name,
  gender,
  birth_date,
  phone,
  allergies,
  antecedents: '',
  email: '',
  address: 'Abidjan',
  archived: 0,
  created_at: at(8, 30, -index * 9),
}));

const byName = (a, b) => a.last_name.localeCompare(b.last_name, 'fr') || a.first_name.localeCompare(b.first_name, 'fr');
const staffName = (id) => STAFF.find((member) => member.id === id).name;

const APPOINTMENTS = [
  [8, 30, 0, 2, 'Consultation de suivi', 'completed'],
  [9, 15, 2, 3, 'Fièvre et toux', 'completed'],
  [10, 0, 3, 2, 'Contrôle de tension', 'scheduled'],
  [10, 45, 4, 3, 'Vaccination', 'scheduled'],
  [11, 30, 5, 2, 'Douleurs abdominales', 'scheduled'],
  [14, 0, 6, 2, "Résultats d'analyses", 'scheduled'],
].map(([hour, minute, patientIndex, practitionerId, motif, status], index) => {
  const patient = PATIENTS[patientIndex];
  return {
    id: index + 1,
    clinic_id: CLINIC.id,
    patient_id: patient.id,
    practitioner_id: practitionerId,
    date_time: at(hour, minute),
    duration: 30,
    motif,
    status,
    priority: 'normal',
    room: null,
    notes: '',
    patient_first_name: patient.first_name,
    patient_last_name: patient.last_name,
    patient_phone: patient.phone,
    patient_birth_date: patient.birth_date,
    practitioner_name: staffName(practitionerId),
  };
});

const LAB_EXAMS = [
  [0, 'Numération formule sanguine (NFS)', 2, 8, 50],
  [3, 'Glycémie à jeun', 2, 9, 5],
  [2, 'Goutte épaisse (paludisme)', 3, 9, 35],
  [5, 'Créatininémie', 2, 10, 10],
  [8, 'Bilan lipidique', 2, 10, 20],
].map(([patientIndex, test_name, doctorId, hour, minute], index) => {
  const patient = PATIENTS[patientIndex];
  return {
    id: index + 1,
    clinic_id: CLINIC.id,
    patient_id: patient.id,
    consultation_id: 30 + index,
    doctor_id: doctorId,
    technician_id: null,
    test_name,
    status: 'pending',
    results_json: null,
    results_text: null,
    created_at: at(hour, minute),
    patient_first_name: patient.first_name,
    patient_last_name: patient.last_name,
    folder_number: patient.folder_number,
    birth_date: patient.birth_date,
    gender: patient.gender,
    doctor_name: staffName(doctorId),
  };
});

// Fabricants et grossistes fictifs : aucun nom réel de la profession.
const MEDICATIONS = [
  ['Paracétamol', '500 mg', 'Comprimé', 'boîte', 'Labo Lagune', 420, 50, 450, 800, 'Grossiste Plateau', 300],
  ['Amoxicilline', '1 g', 'Comprimé', 'boîte', 'Labo Savane', 64, 30, 1850, 2600, 'Grossiste Yopougon', 210],
  ['Artéméther-Luméfantrine', '80/480 mg', 'Comprimé', 'boîte', 'Labo Atlantique', 12, 25, 2400, 3500, 'Grossiste Plateau', 160],
  ['Métronidazole', '250 mg', 'Comprimé', 'boîte', 'Labo Lagune', 88, 30, 900, 1400, 'Grossiste Yopougon', 25],
  ['Sérum salé isotonique', '500 ml', 'Flacon', 'flacon', 'Labo Savane', 140, 40, 650, 1000, 'Grossiste Plateau', 400],
  ['Ibuprofène', '400 mg', 'Comprimé', 'boîte', 'Labo Atlantique', 18, 30, 700, 1100, 'Grossiste Plateau', 240],
  ['Oméprazole', '20 mg', 'Gélule', 'boîte', 'Labo Lagune', 52, 20, 1200, 1900, 'Grossiste Yopougon', 330],
  ['Vitamine C', '500 mg', 'Comprimé', 'boîte', 'Labo Savane', 75, 20, 800, 1300, 'Grossiste Plateau', 40],
  ['Cotrimoxazole', '480 mg', 'Comprimé', 'boîte', 'Labo Atlantique', 9, 20, 950, 1500, 'Grossiste Yopougon', 280],
].map(([name, dosage, form, unit, manufacturer, stock_quantity, min_stock_threshold, price_purchase, price_sale, supplier, expiresInDays], index) => ({
  id: index + 1,
  clinic_id: CLINIC.id,
  name,
  dosage,
  form,
  unit,
  manufacturer,
  batch_number: `LOT-${year}-${1040 + index * 7}`,
  expiry_date: isoDay(expiresInDays),
  stock_quantity,
  min_stock_threshold,
  price_purchase,
  price_sale,
  supplier,
}));

// Caisse du jour, la plus récente en premier : son reçu est celui de la capture.
const PAYMENTS = [
  [0, 11, 10, 'Grâce Aka', [['Consultation', 'Consultation de suivi', 15000], ['Laboratoire', 'Numération formule sanguine (NFS)', 6500], ['Pharmacie', 'Fer + acide folique, 30 jours', 6900]]],
  [1, 10, 58, 'Yves Ehui', [['Pharmacie', 'Amoxicilline 1 g, 2 boîtes', 5200], ['Pharmacie', 'Paracétamol 500 mg, 4 boîtes', 3200]]],
  [3, 10, 25, 'Grâce Aka', [['Consultation', 'Contrôle de tension', 10000]]],
  [2, 9, 44, 'Grâce Aka', [['Laboratoire', 'Goutte épaisse (paludisme)', 5000]]],
  [2, 9, 40, 'Grâce Aka', [['Consultation', 'Consultation pédiatrique', 12000]]],
  [4, 8, 52, 'Grâce Aka', [['Soins', 'Vaccination', 7500]]],
].map(([patientIndex, hour, minute, cashier, lines], index) => {
  const patient = PATIENTS[patientIndex];
  const id = 42 - index;
  const items = lines.map(([type, name, cost]) => ({ type, name, cost }));
  return {
    id,
    clinic_id: CLINIC.id,
    patient_id: patient.id,
    user_id: STAFF.find((member) => member.name === cashier).id,
    amount_total: items.reduce((sum, item) => sum + item.cost, 0),
    payment_method: 'cash',
    reference_number: `FAC-${year}-${String(id).padStart(5, '0')}`,
    status: 'paid',
    provider: 'manual',
    items,
    created_at: at(hour, minute),
    patient_first_name: patient.first_name,
    patient_last_name: patient.last_name,
    folder_number: patient.folder_number,
    cashier_name: cashier,
  };
});

const todayRevenue = PAYMENTS.reduce((sum, payment) => sum + payment.amount_total, 0);
// Les alertes du tableau de bord se déduisent du stock, comme celles de la page
// Pharmacie : sinon les deux captures se contrediraient.
const in30Days = isoDay(30);
const STATS = {
  patientsTotal: 248,
  todayRevenue,
  totalRevenue: 1846500,
  lowStockCount: MEDICATIONS.filter((m) => m.stock_quantity < m.min_stock_threshold).length,
  nearExpiryCount: MEDICATIONS.filter((m) => m.expiry_date <= in30Days).length,
  distribution: [{ method: 'cash', total: todayRevenue }],
  logs: [],
};

// Dossier d'Aya N'Guessan : deux consultations, une ordonnance, une analyse
// et un encaissement, dans la forme que renvoie GET /patients/:id.
const recordOf = (patient) => {
  const doctor = staffName(2);
  const consultations = [
    { id: 31, patient_id: patient.id, doctor_id: 2, date_time: at(8, 40), motif: 'Consultation de suivi', symptoms: 'Fatigue, vertiges en fin de journée', diagnosis: 'Anémie légère', notes: 'Contrôle de la NFS dans un mois.', constants: { tension: '11/7', temp: '36.8', weight: '61', heartRate: '78' }, doctor_name: doctor },
    { id: 22, patient_id: patient.id, doctor_id: 2, date_time: at(10, 15, -21), motif: 'Fièvre depuis deux jours', symptoms: 'Fièvre, courbatures', diagnosis: 'Accès palustre simple', notes: 'Traitement de trois jours, revoir si la fièvre persiste.', constants: { tension: '12/7', temp: '38.9', weight: '62', heartRate: '96' }, doctor_name: doctor },
  ];
  const prescriptions = [
    { id: 18, patient_id: patient.id, consultation_id: 31, doctor_id: 2, date_time: at(8, 55), status: 'pending', doctor_name: doctor, items: [{ id: 1, prescription_id: 18, medication_name: 'Fer + acide folique', dosage: '1 comprimé', frequency: '1 fois par jour', duration: '30 jours', quantity_prescribed: 1, quantity_dispensed: 0 }] },
  ];
  const labExams = [
    { id: 9, patient_id: patient.id, consultation_id: 31, test_name: 'Numération formule sanguine (NFS)', status: 'completed', results_text: 'Hémoglobine 10,8 g/dl, globules blancs normaux.', results_json: null, created_at: at(9, 5), doctor_name: doctor, technician_name: staffName(6) },
  ];
  const payments = PAYMENTS.filter((payment) => payment.patient_id === patient.id);
  const timeline = [
    ...consultations.map((c) => ({ id: `c-${c.id}`, type: 'consultation', date: c.date_time, title: `Consultation : ${c.motif}`, subtitle: `Par ${c.doctor_name}`, details: c })),
    ...prescriptions.map((p) => ({ id: `p-${p.id}`, type: 'prescription', date: p.date_time, title: 'Ordonnance', subtitle: `Par ${p.doctor_name} (En attente)`, details: p })),
    ...labExams.map((e) => ({ id: `le-${e.id}`, type: 'lab', date: e.created_at, title: `Examen de Laboratoire : ${e.test_name}`, subtitle: 'Statut : Résultats saisis', details: e })),
    ...payments.map((p) => ({ id: `pay-${p.id}`, type: 'payment', date: p.created_at, title: 'Facture & Paiement', subtitle: `Montant : ${p.amount_total} FCFA (Espèces)`, details: p })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  return { patient, hiddenSections: [], timeline, consultations, prescriptions, labExams, payments };
};

// Réponse locale à un GET /api/* : le chemin suffit, la méthode est filtrée en amont.
export const respond = (pathname, params) => {
  if (pathname.endsWith('/auth/me')) return ME;
  if (pathname.endsWith('/notifications')) return { notifications: [], unreadCount: 0 };
  if (pathname.endsWith('/financials/stats')) return STATS;
  if (pathname.endsWith('/financials/payments')) return PAYMENTS;
  if (pathname.endsWith('/appointments')) return APPOINTMENTS;
  if (pathname.endsWith('/settings/users')) return STAFF;
  if (pathname.endsWith('/settings/clinic')) return CLINIC;
  const record = pathname.match(/\/patients\/(\d+)$/);
  // Quel que soit le dossier ouvert, la capture montre celui d'Aya N'Guessan, le plus complet.
  if (record) return recordOf(PATIENTS[0]);
  if (pathname.endsWith('/patients')) return [...PATIENTS].sort(byName);
  if (pathname.endsWith('/laboratory/exams')) return params.get('status') === 'completed' ? [] : LAB_EXAMS;
  if (pathname.endsWith('/pharmacy/medications')) return MEDICATIONS;
  if (/\/(pharmacy\/prescriptions|deposits)$/.test(pathname)) return [];
  return {};
};
