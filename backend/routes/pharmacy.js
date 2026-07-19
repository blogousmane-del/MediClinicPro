const express = require('express');
const router = express.Router();
const { runAsync, getAsync, allAsync } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

// GET /api/pharmacy/medications
// Fetch catalog of medications
router.get('/medications', auth, async (req, res) => {
  try {
    const medications = await allAsync(
      "SELECT * FROM medications WHERE clinic_id = ? ORDER BY name ASC",
      [req.user.clinicId]
    );

    // Enrich with alert flags
    const today = new Date();
    const limit30Days = new Date();
    limit30Days.setDate(limit30Days.getDate() + 30);

    const enriched = medications.map(med => {
      const isLowStock = med.stock_quantity <= med.min_stock_threshold;
      
      let isNearExpiry = false;
      let isExpired = false;
      if (med.expiry_date) {
        const expiry = new Date(med.expiry_date);
        isExpired = expiry < today;
        isNearExpiry = !isExpired && expiry <= limit30Days;
      }

      return {
        ...med,
        isLowStock,
        isNearExpiry,
        isExpired
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error("Get Medications Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des médicaments." });
  }
});

// POST /api/pharmacy/replenish
// Record a stock entry (replenishment)
router.post('/replenish', auth, checkRole(['admin', 'pharmacist', 'manager']), async (req, res) => {
  try {
    const { name, form, dosage, quantity, pricePurchase, priceSale, expiryDate, batchNumber, supplier } = req.body;

    if (!name || !form || !dosage || !quantity || !pricePurchase || !priceSale) {
      return res.status(400).json({ error: "Les informations de base du produit et la quantité sont requises." });
    }

    const qty = parseInt(quantity);
    if (qty <= 0) {
      return res.status(400).json({ error: "La quantité doit être supérieure à zéro." });
    }

    // Check if medication type already exists in catalog (same name, form, dosage)
    let med = await getAsync(
      "SELECT * FROM medications WHERE clinic_id = ? AND name = ? AND form = ? AND dosage = ?",
      [req.user.clinicId, name, form, dosage]
    );

    let medId;
    if (med) {
      // Update existing record
      medId = med.id;
      await runAsync(
        `UPDATE medications SET 
          stock_quantity = stock_quantity + ?,
          price_purchase = ?,
          price_sale = ?,
          expiry_date = ?,
          batch_number = ?,
          supplier = ?
         WHERE id = ? AND clinic_id = ?`,
        [qty, pricePurchase, priceSale, expiryDate || med.expiry_date, batchNumber || med.batch_number, supplier || med.supplier, medId, req.user.clinicId]
      );
    } else {
      // Create new medication record
      const result = await runAsync(
        `INSERT INTO medications (clinic_id, name, form, dosage, stock_quantity, min_stock_threshold, price_purchase, price_sale, expiry_date, batch_number, supplier) 
         VALUES (?, ?, ?, ?, ?, 10, ?, ?, ?, ?, ?)`,
        [req.user.clinicId, name, form, dosage, qty, pricePurchase, priceSale, expiryDate || '', batchNumber || '', supplier || '']
      );
      medId = result.lastID;
    }

    // Record Stock Entry
    await runAsync(
      `INSERT INTO stock_entries (clinic_id, medication_id, user_id, quantity, price_purchase, expiry_date, batch_number, supplier) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.clinicId, medId, req.user.userId, qty, pricePurchase, expiryDate || '', batchNumber || '', supplier || '']
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'PHARMACY_REPLENISH', ?)",
      [req.user.clinicId, req.user.userId, `Approvisionnement de ${qty} unités de ${name} ${dosage}`]
    );

    res.json({ success: true, message: "Approvisionnement enregistré et stock mis à jour." });
  } catch (error) {
    console.error("Replenish Stock Error:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'approvisionnement." });
  }
});

// GET /api/pharmacy/prescriptions
// List prescriptions for pharmacist check
router.get('/prescriptions', auth, async (req, res) => {
  try {
    const { status } = req.query; // pending or dispensed
    let query = `
      SELECT pr.*, p.first_name as patient_first_name, p.last_name as patient_last_name, p.folder_number, u.name as doctor_name
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.id
      JOIN users u ON pr.doctor_id = u.id
      WHERE pr.clinic_id = ?
    `;
    const params = [req.user.clinicId];

    if (status) {
      query += " AND pr.status = ?";
      params.push(status);
    }

    query += " ORDER BY pr.date_time DESC";
    const prescriptions = await allAsync(query, params);

    // Hydrate prescription items
    for (const pr of prescriptions) {
      pr.items = await allAsync(
        "SELECT * FROM prescription_items WHERE prescription_id = ?",
        [pr.id]
      );
    }

    res.json(prescriptions);
  } catch (error) {
    console.error("Get Pharmacy Prescriptions Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des ordonnances." });
  }
});

// POST /api/pharmacy/dispense/:id
// Confirm dispensation of medicines
router.post('/dispense/:id', auth, checkRole(['admin', 'pharmacist']), async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const { items } = req.body; // Expecting [ { itemId: 1, quantityDispensed: 3 } ]

    const prescription = await getAsync(
      "SELECT * FROM prescriptions WHERE id = ? AND clinic_id = ?",
      [prescriptionId, req.user.clinicId]
    );

    if (!prescription) {
      return res.status(404).json({ error: "Ordonnance non trouvée." });
    }

    if (prescription.status === 'dispensed') {
      return res.status(400).json({ error: "Cette ordonnance a déjà été entièrement délivrée." });
    }

    let allFullyDispensed = true;

    for (const item of items) {
      const { itemId, quantityDispensed } = item;
      const qty = parseInt(quantityDispensed);

      const prItem = await getAsync(
        "SELECT * FROM prescription_items WHERE id = ? AND prescription_id = ?",
        [itemId, prescriptionId]
      );

      if (prItem && qty > 0) {
        // If linked to a catalog medication, decrement stock
        if (prItem.medication_id) {
          const med = await getAsync("SELECT stock_quantity, name FROM medications WHERE id = ? AND clinic_id = ?", [prItem.medication_id, req.user.clinicId]);
          if (med) {
            if (med.stock_quantity < qty) {
              return res.status(400).json({ 
                error: `Stock insuffisant pour le médicament ${med.name}. Stock actuel: ${med.stock_quantity}, Demandé: ${qty}` 
              });
            }

            // Decrement Stock
            await runAsync(
              "UPDATE medications SET stock_quantity = stock_quantity - ? WHERE id = ? AND clinic_id = ?",
              [qty, prItem.medication_id, req.user.clinicId]
            );
          }
        }

        // Update Prescription Item quantity dispensed
        await runAsync(
          "UPDATE prescription_items SET quantity_dispensed = quantity_dispensed + ? WHERE id = ?",
          [qty, itemId]
        );

        // Check if item is now fully satisfied
        const updatedItem = await getAsync("SELECT quantity_prescribed, quantity_dispensed FROM prescription_items WHERE id = ?", [itemId]);
        if (updatedItem.quantity_dispensed < updatedItem.quantity_prescribed) {
          allFullyDispensed = false;
        }
      }
    }

    // Update prescription overall status
    const status = allFullyDispensed ? 'dispensed' : 'partial';
    await runAsync(
      "UPDATE prescriptions SET status = ? WHERE id = ?",
      [status, prescriptionId]
    );

    // Log Activity
    const patient = await getAsync("SELECT first_name, last_name FROM patients WHERE id = ?", [prescription.patient_id]);
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'PHARMACY_DISPENSE', ?)",
      [req.user.clinicId, req.user.userId, `Dispensation de l'ordonnance ID ${prescriptionId} pour ${patient.first_name} ${patient.last_name} (${status})`]
    );

    res.json({ success: true, message: `Ordonnance traitée avec succès (${status}).` });
  } catch (error) {
    console.error("Dispense Medication Error:", error);
    res.status(500).json({ error: "Erreur lors de la dispensation." });
  }
});

module.exports = router;
