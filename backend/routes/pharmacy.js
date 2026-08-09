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
          expiry_date: expiryDate || '',
          batch_number: batchNumber || '',
          supplier: supplier || ''
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
        expiry_date: expiryDate || '',
        batch_number: batchNumber || '',
        supplier: supplier || ''
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
      .select('*, patient:patients(first_name, last_name, folder_number), doctor:users(name), items:prescription_items(*)')
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
