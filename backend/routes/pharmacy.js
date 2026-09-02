const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

// Une quantité doit être un entier strictement positif, et un vrai nombre.
// Le corps JSON peut porter n'importe quoi : avec une chaîne, `stock + qty`
// devenait une concaténation — un stock de 10 réapprovisionné de "50" donnait
// "1050", que Postgres rangeait tel quel. L'interface envoie déjà un
// `parseInt`, donc seul un appel direct à l'API déclenchait le défaut, mais
// n'importe quel compte authentifié pouvait corrompre l'inventaire.
function isPositiveInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

// Le stock est lu puis réécrit. Sans garde, deux opérations simultanées lisent
// la même valeur et la seconde écrase la première ; pire, la vérification
// « stock suffisant » et le décrément étaient deux requêtes distinctes, donc le
// stock pouvait passer sous zéro entre les deux.
//
// La mise à jour est conditionnée à la valeur lue (`.eq('stock_quantity', lu)`)
// et rejouée si quelqu'un est passé entre-temps : zéro ligne modifiée signifie
// « la valeur a bougé », jamais « échec silencieux ». Un `UPDATE ... SET
// stock_quantity = stock_quantity - n` serait plus direct, mais PostgREST ne
// sait pas exprimer une opération sur une colonne et aucune session n'a le
// droit de créer la fonction SQL correspondante (voir CLAUDE.md).
const STOCK_MAX_ATTEMPTS = 5;

async function applyStockDelta(medicationId, clinicId, delta) {
  for (let attempt = 0; attempt < STOCK_MAX_ATTEMPTS; attempt += 1) {
    const { data: med, error: readError } = await supabase
      .from('medications')
      .select('stock_quantity, name')
      .eq('id', medicationId)
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (readError) throw readError;
    if (!med) return { ok: false, reason: 'not_found' };

    const next = med.stock_quantity + delta;
    if (next < 0) return { ok: false, reason: 'insufficient', med };

    const { data: updated, error: updateError } = await supabase
      .from('medications')
      .update({ stock_quantity: next })
      .eq('id', medicationId)
      .eq('clinic_id', clinicId)
      .eq('stock_quantity', med.stock_quantity)
      .select('id');

    if (updateError) throw updateError;
    if (updated && updated.length > 0) return { ok: true, stock: next };
  }

  return { ok: false, reason: 'conflict' };
}

// GET /api/pharmacy/medications
// List medications / search catalog
router.get('/medications', auth, async (req, res) => {
  try {
    const { q, lowStock } = req.query;

    let queryBuilder = supabase
      .from('medications')
      .select('*')
      .eq('clinic_id', req.user.clinicId);

    if (q) {
      queryBuilder = queryBuilder.ilike('name', `%${q}%`);
    }

    const { data: medications, error } = await queryBuilder.order('name', { ascending: true });
    if (error) throw error;

    let result = medications || [];
    
    // In-memory column-to-column comparison for stock alerts
    if (lowStock === 'true') {
      result = result.filter(med => med.stock_quantity <= med.min_stock_threshold);
    }

    res.json(result);
  } catch (error) {
    console.error("Get Medications Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du catalogue de pharmacie." });
  }
});

// POST /api/pharmacy/replenish
// Record a stock entry (replenish medication)
router.post('/replenish', auth, checkRole(['admin', 'pharmacist', 'manager']), async (req, res) => {
  try {
    const { name, form, dosage, manufacturer, unit, minStockThreshold, qty, pricePurchase, priceSale, expiryDate, batchNumber, supplier } = req.body;

    if (!name || !form || !dosage || !pricePurchase || !priceSale) {
      return res.status(400).json({ error: "Les informations de réapprovisionnement principales sont obligatoires." });
    }

    if (!isPositiveInteger(qty)) {
      return res.status(400).json({ error: "La quantité doit être un nombre entier positif." });
    }

    // Check if medication already exists in the catalog. La lecture est dans la
    // boucle : si le stock a bougé entre-temps, on repart de la valeur fraîche
    // plutôt que d'écraser l'écriture de l'autre requête.
    let med = null;
    let applied = false;
    for (let attempt = 0; attempt < STOCK_MAX_ATTEMPTS && !applied; attempt += 1) {
      const { data: found, error: checkError } = await supabase
        .from('medications')
        .select('*')
        .eq('clinic_id', req.user.clinicId)
        .eq('name', name)
        .eq('form', form)
        .eq('dosage', dosage)
        .maybeSingle();

      if (checkError) throw checkError;
      med = found;
      if (!med) break;

      const { data: updated, error: updateError } = await supabase
        .from('medications')
        .update({
          stock_quantity: med.stock_quantity + qty,
          price_purchase: pricePurchase,
          price_sale: priceSale,
          manufacturer: manufacturer || med.manufacturer,
          unit: unit || med.unit,
          min_stock_threshold: minStockThreshold != null ? minStockThreshold : med.min_stock_threshold,
          expiry_date: expiryDate || med.expiry_date,
          batch_number: batchNumber || med.batch_number,
          supplier: supplier || med.supplier
        })
        .eq('id', med.id)
        .eq('clinic_id', req.user.clinicId)
        .eq('stock_quantity', med.stock_quantity)
        .select('id');

      if (updateError) throw updateError;
      applied = !!(updated && updated.length > 0);
    }

    let medId;
    if (med) {
      if (!applied) {
        return res.status(409).json({ error: "Le stock a été modifié en même temps. Merci de réessayer." });
      }
      medId = med.id;
    } else {
      // Create new medication record
      const { data: newMed, error: insertError } = await supabase
        .from('medications')
        .insert({
          clinic_id: req.user.clinicId,
          name,
          form,
          dosage,
          manufacturer: manufacturer || '',
          unit: unit || '',
          stock_quantity: qty,
          min_stock_threshold: minStockThreshold != null ? minStockThreshold : 10,
          price_purchase: pricePurchase,
          price_sale: priceSale,
          expiry_date: expiryDate || null,
          batch_number: batchNumber || null,
          supplier: supplier || null
        })
        .select()
        .single();

      if (insertError) throw insertError;
      medId = newMed.id;
    }

    // Record Stock Entry
    const { error: stockEntryError } = await supabase
      .from('stock_entries')
      .insert({
        clinic_id: req.user.clinicId,
        medication_id: medId,
        user_id: req.user.userId,
        quantity: qty,
        price_purchase: pricePurchase,
        expiry_date: expiryDate || null,
        batch_number: batchNumber || null,
        supplier: supplier || null
      });

    if (stockEntryError) throw stockEntryError;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'STOCK_REPLENISH',
      details: `Réapprovisionnement de ${qty} unités de ${name} ${dosage} (${form})`
    });

    res.status(201).json({
      success: true,
      medicationId: medId,
      message: "Réapprovisionnement enregistré et stock mis à jour."
    });
  } catch (error) {
    console.error("Replenish Stock Error:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du stock." });
  }
});

// GET /api/pharmacy/prescriptions
// List prescriptions in the clinic
router.get('/prescriptions', auth, async (req, res) => {
  try {
    const { status } = req.query; // pending or dispensed or partial

    let queryBuilder = supabase
      .from('prescriptions')
      .select('*, patient:patients(first_name, last_name, folder_number, birth_date), doctor:users(name), consultation:consultations(diagnosis, notes), items:prescription_items(*)')
      .eq('clinic_id', req.user.clinicId);

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: prescriptions, error } = await queryBuilder.order('date_time', { ascending: false });
    if (error) throw error;

    const formatted = (prescriptions || []).map(pr => ({
      ...pr,
      patient_first_name: pr.patient ? pr.patient.first_name : 'Inconnu',
      patient_last_name: pr.patient ? pr.patient.last_name : 'Inconnu',
      folder_number: pr.patient ? pr.patient.folder_number : '',
      // L'âge était inventé côté client (« 45 ans » pour toute ordonnance) ;
      // il se calcule à partir de la vraie date de naissance.
      patient_birth_date: pr.patient ? pr.patient.birth_date : null,
      // `prescriptions` n'a ni diagnostic ni notes : ils appartiennent a la
      // consultation dont l'ordonnance decoule. Le client les inventait
      // (« Consultation generale » sur toutes les lignes) faute de les
      // recevoir.
      diagnosis: pr.consultation ? pr.consultation.diagnosis || '' : '',
      notes: pr.consultation ? pr.consultation.notes || '' : '',
      doctor_name: pr.doctor ? pr.doctor.name : 'Inconnu',
      items: pr.items || []
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Get Prescriptions Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des ordonnances." });
  }
});

// GET /api/pharmacy/prescriptions/:id
// Get a single prescription details for dispensing
router.get('/prescriptions/:id', auth, async (req, res) => {
  try {
    const prescriptionId = req.params.id;

    const { data: prescription, error: prescError } = await supabase
      .from('prescriptions')
      .select('*, patient:patients(*), doctor:users(name)')
      .eq('id', prescriptionId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (prescError) throw prescError;
    if (!prescription) {
      return res.status(404).json({ error: "Ordonnance non trouvée." });
    }

    const { data: items, error: itemsError } = await supabase
      .from('prescription_items')
      .select('*')
      .eq('prescription_id', prescriptionId);

    if (itemsError) throw itemsError;

    res.json({
      ...prescription,
      patient_first_name: prescription.patient ? prescription.patient.first_name : '',
      patient_last_name: prescription.patient ? prescription.patient.last_name : '',
      folder_number: prescription.patient ? prescription.patient.folder_number : '',
      doctor_name: prescription.doctor ? prescription.doctor.name : '',
      items: items || []
    });
  } catch (error) {
    console.error("Get Prescription Details Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération de l'ordonnance." });
  }
});

// Une ordonnance ne tient pas debout seule : `prescriptions.consultation_id`
// est NOT NULL UNIQUE, une ordonnance appartient donc à une consultation et à
// une seule. Le diagnostic et les notes vivent sur cette consultation — c'est
// la raison pour laquelle la page Ordonnances les fabriquait côté client, elle
// n'avait aucun endroit où les envoyer.
//
// Deux entrées possibles : `consultationId` quand l'ordonnance prolonge une
// consultation déjà saisie, sinon on crée la consultation qui la porte. Rien
// n'est inventé au passage : le motif est celui que le prescripteur écrit.
async function resolvePrescriptionActors(req, { patientId, doctorId }) {
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('clinic_id', req.user.clinicId)
    .maybeSingle();

  if (patientError) throw patientError;
  if (!patient) return { error: { status: 404, message: "Patient non trouvé dans cette clinique." } };

  // Le prescripteur est choisi dans le formulaire : il doit appartenir à la
  // clinique, être actif, et pouvoir prescrire. Sans cette vérification, un
  // identifiant arbitraire signait l'ordonnance de n'importe quel compte.
  const prescriberId = doctorId || req.user.userId;
  const { data: doctor, error: doctorError } = await supabase
    .from('users')
    .select('id, role, active')
    .eq('id', prescriberId)
    .eq('clinic_id', req.user.clinicId)
    .maybeSingle();

  if (doctorError) throw doctorError;
  if (!doctor || doctor.active !== 1) {
    return { error: { status: 400, message: "Le médecin prescripteur n'existe pas ou n'est plus actif." } };
  }
  if (!['doctor', 'admin'].includes(doctor.role)) {
    return { error: { status: 400, message: "Le prescripteur doit être un médecin." } };
  }

  return { patientId, prescriberId };
}

// Les lignes sont validées entièrement AVANT la première écriture : PostgREST
// n'offre pas de transaction, donc un refus en cours de boucle laisserait une
// ordonnance à moitié écrite.
async function validatePrescriptionItems(req, items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: { status: 400, message: "Une ordonnance doit comporter au moins un médicament." } };
  }

  const validated = [];
  for (const item of items) {
    const name = (item.medicationName || '').trim();
    if (!name) {
      return { error: { status: 400, message: "Chaque ligne doit porter un nom de médicament." } };
    }
    if (!isPositiveInteger(item.quantityPrescribed)) {
      return { error: { status: 400, message: `Quantité invalide pour « ${name} » : un entier strictement positif est attendu.` } };
    }

    if (item.medicationId) {
      const { data: med, error: medError } = await supabase
        .from('medications')
        .select('id')
        .eq('id', item.medicationId)
        .eq('clinic_id', req.user.clinicId)
        .maybeSingle();

      if (medError) throw medError;
      if (!med) {
        return { error: { status: 400, message: `Le médicament ID ${item.medicationId} n'existe pas dans le catalogue de votre clinique.` } };
      }
    }

    validated.push({
      medication_id: item.medicationId || null,
      medication_name: name,
      dosage: (item.dosage || '').trim(),
      frequency: (item.frequency || '').trim(),
      duration: (item.duration || '').trim(),
      quantity_prescribed: item.quantityPrescribed,
      quantity_dispensed: 0
    });
  }

  return { items: validated };
}

// POST /api/pharmacy/prescriptions
// Créer une ordonnance (et, si besoin, la consultation qui la porte)
router.post('/prescriptions', auth, checkRole(['admin', 'doctor']), async (req, res) => {
  try {
    const { patientId, doctorId, consultationId, motif, diagnosis, notes, items } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: "Le patient est requis." });
    }

    const actors = await resolvePrescriptionActors(req, { patientId, doctorId });
    if (actors.error) return res.status(actors.error.status).json({ error: actors.error.message });

    const validation = await validatePrescriptionItems(req, items);
    if (validation.error) return res.status(validation.error.status).json({ error: validation.error.message });

    let targetConsultationId = consultationId || null;

    if (targetConsultationId) {
      const { data: consultation, error: consultError } = await supabase
        .from('consultations')
        .select('id, patient_id')
        .eq('id', targetConsultationId)
        .eq('clinic_id', req.user.clinicId)
        .maybeSingle();

      if (consultError) throw consultError;
      if (!consultation) {
        return res.status(404).json({ error: "Consultation non trouvée dans cette clinique." });
      }
      if (consultation.patient_id !== patientId) {
        return res.status(400).json({ error: "Cette consultation concerne un autre patient." });
      }

      // `consultation_id` est UNIQUE : une consultation ne porte qu'une
      // ordonnance. Sans ce contrôle, l'insertion remonterait un 23505 opaque.
      const { data: existing, error: existingError } = await supabase
        .from('prescriptions')
        .select('id')
        .eq('consultation_id', targetConsultationId)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing) {
        return res.status(409).json({ error: "Cette consultation porte déjà une ordonnance." });
      }
    } else {
      const { data: consultData, error: consultError } = await supabase
        .from('consultations')
        .insert({
          clinic_id: req.user.clinicId,
          patient_id: patientId,
          doctor_id: actors.prescriberId,
          motif: (motif || '').trim() || 'Ordonnance',
          symptoms: '',
          constants: {},
          diagnosis: (diagnosis || '').trim(),
          notes: (notes || '').trim()
        })
        .select()
        .single();

      if (consultError) throw consultError;
      targetConsultationId = consultData.id;
    }

    const { data: prescData, error: prescError } = await supabase
      .from('prescriptions')
      .insert({
        clinic_id: req.user.clinicId,
        consultation_id: targetConsultationId,
        patient_id: patientId,
        doctor_id: actors.prescriberId,
        status: 'pending'
      })
      .select()
      .single();

    if (prescError) throw prescError;

    const { error: itemsError } = await supabase
      .from('prescription_items')
      .insert(validation.items.map(it => ({ ...it, prescription_id: prescData.id })));

    if (itemsError) throw itemsError;

    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'PRESCRIPTION_CREATE',
      details: `Ordonnance ${prescData.id} créée pour le patient ID ${patientId} (${validation.items.length} médicament(s))`
    });

    res.status(201).json({
      success: true,
      prescriptionId: prescData.id,
      consultationId: targetConsultationId,
      message: "Ordonnance enregistrée."
    });
  } catch (error) {
    console.error("Create Prescription Error:", error);
    res.status(500).json({ error: "Erreur lors de la création de l'ordonnance." });
  }
});

// PUT /api/pharmacy/prescriptions/:id
// Modifier une ordonnance tant qu'aucun médicament n'a été délivré
router.put('/prescriptions/:id', auth, checkRole(['admin', 'doctor']), async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const { doctorId, diagnosis, notes, items } = req.body;

    const { data: prescription, error: prescError } = await supabase
      .from('prescriptions')
      .select('id, patient_id, consultation_id, status')
      .eq('id', prescriptionId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (prescError) throw prescError;
    if (!prescription) {
      return res.status(404).json({ error: "Ordonnance non trouvée." });
    }

    // Réécrire les lignes d'une ordonnance déjà servie ferait mentir le stock
    // déjà décrémenté et les quantités déjà délivrées.
    const { data: dispensedItems, error: dispensedError } = await supabase
      .from('prescription_items')
      .select('id, quantity_dispensed')
      .eq('prescription_id', prescriptionId);

    if (dispensedError) throw dispensedError;
    const alreadyDispensed = (dispensedItems || []).some(it => (it.quantity_dispensed || 0) > 0);
    if (prescription.status !== 'pending' || alreadyDispensed) {
      return res.status(409).json({ error: "Cette ordonnance a déjà été délivrée, elle n'est plus modifiable." });
    }

    const actors = await resolvePrescriptionActors(req, { patientId: prescription.patient_id, doctorId });
    if (actors.error) return res.status(actors.error.status).json({ error: actors.error.message });

    const validation = await validatePrescriptionItems(req, items);
    if (validation.error) return res.status(validation.error.status).json({ error: validation.error.message });

    const { error: consultUpdateError } = await supabase
      .from('consultations')
      .update({ diagnosis: (diagnosis || '').trim(), notes: (notes || '').trim() })
      .eq('id', prescription.consultation_id)
      .eq('clinic_id', req.user.clinicId);

    if (consultUpdateError) throw consultUpdateError;

    const { error: deleteError } = await supabase
      .from('prescription_items')
      .delete()
      .eq('prescription_id', prescriptionId);

    if (deleteError) throw deleteError;

    const { error: itemsError } = await supabase
      .from('prescription_items')
      .insert(validation.items.map(it => ({ ...it, prescription_id: Number(prescriptionId) })));

    if (itemsError) throw itemsError;

    const { error: updateError } = await supabase
      .from('prescriptions')
      .update({ doctor_id: actors.prescriberId })
      .eq('id', prescriptionId)
      .eq('clinic_id', req.user.clinicId);

    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'PRESCRIPTION_UPDATE',
      details: `Ordonnance ${prescriptionId} modifiée (${validation.items.length} médicament(s))`
    });

    res.json({ success: true, message: "Ordonnance mise à jour." });
  } catch (error) {
    console.error("Update Prescription Error:", error);
    res.status(500).json({ error: "Erreur lors de la modification de l'ordonnance." });
  }
});

// POST /api/pharmacy/dispense/:id
// Dispense medications for a prescription
router.post('/dispense/:id', auth, checkRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const { dispensations } = req.body; // Array of { itemId, qty }

    if (!dispensations || !Array.isArray(dispensations) || dispensations.length === 0) {
      return res.status(400).json({ error: "Détails de la dispensation manquants." });
    }

    // Verify prescription belongs to the clinic (prevent IDOR)
    const { data: prescription, error: prescError } = await supabase
      .from('prescriptions')
      .select('id, patient_id')
      .eq('id', prescriptionId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (prescError) throw prescError;
    if (!prescription) {
      return res.status(404).json({ error: "Ordonnance non trouvée dans cette clinique." });
    }

    // Deux passes. PostgREST n'offre pas de transaction : un refus survenant au
    // milieu de la boucle laisserait les articles déjà traités modifiés. Tout
    // ce qui peut être vérifié l'est donc avant la première écriture.
    const planned = [];
    for (const disp of dispensations) {
      const { itemId, qty } = disp || {};

      if (!isPositiveInteger(qty)) {
        return res.status(400).json({ error: "La quantité à délivrer doit être un nombre entier positif." });
      }

      const { data: prItem, error: itemError } = await supabase
        .from('prescription_items')
        .select('*')
        .eq('id', itemId)
        .eq('prescription_id', prescriptionId)
        .maybeSingle();

      if (itemError) throw itemError;
      if (!prItem) {
        return res.status(400).json({ error: "Un des articles ne fait pas partie de cette ordonnance." });
      }

      // Rien n'empêchait de délivrer 100 boîtes sur une ordonnance qui en
      // prescrivait 2 : seul le stock était comparé, jamais le reste à
      // délivrer. L'interface calculait bien la différence, mais elle seule.
      const remaining = Math.max(0, prItem.quantity_prescribed - prItem.quantity_dispensed);
      if (qty > remaining) {
        return res.status(400).json({
          error: `Quantité supérieure au reste à délivrer pour ${prItem.medication_name || 'cet article'} (reste ${remaining}).`
        });
      }

      planned.push({ prItem, qty });
    }

    for (const { prItem, qty } of planned) {
      // If linked to a catalog medication, decrement stock
      if (prItem.medication_id) {
        const movement = await applyStockDelta(prItem.medication_id, req.user.clinicId, -qty);

        if (!movement.ok && movement.reason === 'insufficient') {
          return res.status(400).json({
            error: `Stock insuffisant pour le médicament ${movement.med.name}. Stock actuel: ${movement.med.stock_quantity}, Demandé: ${qty}`
          });
        }
        if (!movement.ok && movement.reason === 'conflict') {
          return res.status(409).json({ error: "Le stock a été modifié en même temps. Merci de réessayer." });
        }
        // `not_found` : l'article porte un médicament absent du catalogue de la
        // clinique. On délivre sans mouvement de stock, comme avant.
      }

      const { data: updatedItem, error: updateItemDispError } = await supabase
        .from('prescription_items')
        .update({ quantity_dispensed: prItem.quantity_dispensed + qty })
        .eq('id', prItem.id)
        .eq('prescription_id', prescriptionId)
        .eq('quantity_dispensed', prItem.quantity_dispensed)
        .select('id');

      if (updateItemDispError) throw updateItemDispError;

      // Même garde que sur le stock. Si une autre dispensation est passée
      // entre-temps, on rend les unités retirées : mieux vaut demander de
      // réessayer qu'un stock décrémenté deux fois pour une seule sortie.
      if (!updatedItem || updatedItem.length === 0) {
        if (prItem.medication_id) {
          await applyStockDelta(prItem.medication_id, req.user.clinicId, qty);
        }
        return res.status(409).json({ error: "Cette ordonnance a été modifiée en même temps. Merci de réessayer." });
      }
    }

    // Check if the prescription is now fully satisfied (quantity_dispensed >= quantity_prescribed for all items)
    const { data: updatedItems, error: loadUpdatedItemsError } = await supabase
      .from('prescription_items')
      .select('*')
      .eq('prescription_id', prescriptionId);

    if (loadUpdatedItemsError) throw loadUpdatedItemsError;

    let allSatisfied = true;
    let anySatisfied = false;

    for (const item of updatedItems) {
      if (item.quantity_dispensed >= item.quantity_prescribed) {
        anySatisfied = true;
      } else {
        allSatisfied = false;
        if (item.quantity_dispensed > 0) {
          anySatisfied = true;
        }
      }
    }

    let finalStatus = 'pending';
    if (allSatisfied) {
      finalStatus = 'dispensed';
    } else if (anySatisfied) {
      finalStatus = 'partial';
    }

    // Update prescription status
    const { error: updatePrescStatusError } = await supabase
      .from('prescriptions')
      .update({ status: finalStatus })
      .eq('id', prescriptionId)
      .eq('clinic_id', req.user.clinicId);

    if (updatePrescStatusError) throw updatePrescStatusError;

    // Log Activity
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('first_name, last_name')
      .eq('id', prescription.patient_id)
      .single();

    if (!patientError && patient) {
      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'PHARMACY_DISPENSE',
        details: `Dispensation de médicaments pour ${patient.first_name} ${patient.last_name} (Ordonnance ID: ${prescriptionId})`
      });
    }

    res.json({ success: true, status: finalStatus, message: "Dispensation enregistrée." });
  } catch (error) {
    console.error("Dispense Medications Error:", error);
    res.status(500).json({ error: "Erreur lors de la dispensation des médicaments." });
  }
});

module.exports = router;
