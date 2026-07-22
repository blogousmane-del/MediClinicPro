const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

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
    const { name, form, dosage, qty, pricePurchase, priceSale, expiryDate, batchNumber, supplier } = req.body;

    if (!name || !form || !dosage || !qty || !pricePurchase || !priceSale) {
      return res.status(400).json({ error: "Les informations de réapprovisionnement principales sont obligatoires." });
    }

    // Check if medication already exists in the catalog
    const { data: med, error: checkError } = await supabase
      .from('medications')
      .select('*')
      .eq('clinic_id', req.user.clinicId)
      .eq('name', name)
      .eq('form', form)
      .eq('dosage', dosage)
      .maybeSingle();

    if (checkError) throw checkError;

    let medId;
    if (med) {
      // Update existing record
      medId = med.id;
      const { error: updateError } = await supabase
        .from('medications')
        .update({
          stock_quantity: med.stock_quantity + qty,
          price_purchase: pricePurchase,
          price_sale: priceSale,
          expiry_date: expiryDate || med.expiry_date,
          batch_number: batchNumber || med.batch_number,
          supplier: supplier || med.supplier
        })
        .eq('id', medId)
        .eq('clinic_id', req.user.clinicId);

      if (updateError) throw updateError;
    } else {
      // Create new medication record
      const { data: newMed, error: insertError } = await supabase
        .from('medications')
        .insert({
          clinic_id: req.user.clinicId,
          name,
          form,
          dosage,
          stock_quantity: qty,
          min_stock_threshold: 10,
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

    // Process each item
    for (const disp of dispensations) {
      const { itemId, qty } = disp;

      // Load prescription item
      const { data: prItem, error: itemError } = await supabase
        .from('prescription_items')
        .select('*')
        .eq('id', itemId)
        .eq('prescription_id', prescriptionId)
        .maybeSingle();

      if (itemError) throw itemError;

      if (prItem && qty > 0) {
        // If linked to a catalog medication, decrement stock
        if (prItem.medication_id) {
          const { data: med, error: medError } = await supabase
            .from('medications')
            .select('stock_quantity, name')
            .eq('id', prItem.medication_id)
            .eq('clinic_id', req.user.clinicId)
            .maybeSingle();

          if (medError) throw medError;
          if (med) {
            if (med.stock_quantity < qty) {
              return res.status(400).json({ 
                error: `Stock insuffisant pour le médicament ${med.name}. Stock actuel: ${med.stock_quantity}, Demandé: ${qty}` 
              });
            }

            // Decrement Stock
            const { error: decStockError } = await supabase
              .from('medications')
              .update({ stock_quantity: med.stock_quantity - qty })
              .eq('id', prItem.medication_id)
              .eq('clinic_id', req.user.clinicId);

            if (decStockError) throw decStockError;
          }
        }

        // Update Prescription Item quantity dispensed
        const { error: updateItemDispError } = await supabase
          .from('prescription_items')
          .update({ quantity_dispensed: prItem.quantity_dispensed + qty })
          .eq('id', itemId);

        if (updateItemDispError) throw updateItemDispError;
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
