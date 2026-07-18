# MediClinicPro — Logiciel de Gestion Clinique Moderne

**MediClinic** est une solution complète, moderne et responsive conçue pour les petites et moyennes cliniques en Côte d'Ivoire. L'application permet d'abandonner la gestion papier et Excel au profit d'un système structuré pour seulement **15 000 FCFA / mois**.

---

## 🛠️ Stack Technique

### Backend (API REST)
- **Runtime** : Node.js (Express)
- **Base de données** : SQLite (via `sqlite3`, base relationnelle embarquée en fichier local)
- **Sécurité** : JWT (JsonWebToken) + bcryptjs (hachage des mots de passe) + Contrôle d'accès basé sur les rôles (RBAC)

### Frontend (Client SPA)
- **Framework** : React 19 (TypeScript + Vite)
- **Design System** : Vanilla CSS (Thème premium clinique, variables HSL, animations, support mode sombre/clair natif)
- **Icônes** : Lucide React

---

## 📂 Structure du Projet

```text
├── backend/
│   ├── database.js          # Schémas SQLite, tables et données initiales (seeds)
│   ├── server.js            # Point d'entrée de l'API REST Express
│   ├── middleware/
│   │   └── auth.js          # Middleware JWT + vérification des rôles (RBAC)
│   ├── routes/
│   │   ├── auth.js          # Inscription, connexion, onboarding
│   │   ├── patients.js      # Dossiers patients, historique timeline
│   │   ├── appointments.js  # Agenda, conflits, rappels SMS
│   │   ├── consultations.js # Diagnostic, constantes, ordonnances
│   │   ├── pharmacy.js      # Inventaire, approvisionnement, dispensation
│   │   ├── laboratory.js    # File d'attente d'analyses, compte-rendu
│   │   ├── financials.js    # Paiements de caisse, stats, sandbox Mobile Money
│   │   └── settings.js      # Utilisateurs du personnel, tarifs clinique
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Gestionnaire d'onglets et de flux d'écrans
│   │   ├── main.tsx         # Point de montage DOM
│   │   ├── index.css        # Variables CSS, thème, design tokens
│   │   ├── components/      # Sidebar, Header, Modals, Tables réutilisables
│   │   ├── contexts/        # AuthContext, NotificationContext, OfflineContext
│   │   ├── pages/           # Landing, Login, Onboarding, Dashboard et onglets métiers
│   │   └── utils/
│   │       └── api.ts       # Client API fetch typé avec headers JWT
│   └── package.json
│
├── package.json             # Scripts de démarrage globaux
└── README.md                # Guide opérationnel
```

---

## 🚀 Guide de Démarrage Rapide

### 1. Prérequis
Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé sur votre machine.

### 2. Démarrage de l'API Backend
Dans un terminal, allez dans le dossier `backend` et lancez le serveur :
```bash
cd backend
npm start
```
*Le serveur se lancera sur le port **5000** et initialisera/seedera automatiquement le fichier de base de données `mediclinic.db`.*

### 3. Démarrage du Client Frontend
Dans un second terminal, allez dans le dossier `frontend` et lancez le serveur de développement Vite :
```bash
cd frontend
npm run dev
```
*L'application s'ouvrira sur le port standard de Vite (généralement `http://localhost:5173`).*

---

## 🔑 Comptes de Test (Pré-configurés)

Vous pouvez vous connecter instantanément en utilisant les comptes d'exemple suivants :

| Rôle | Adresse Email | Mot de passe |
|---|---|---|
| **Administrateur** | `admin@mediclinic.com` | `adminpassword` |
| **Médecin** | `aminata@mediclinic.com` | `doctorpassword` |
| **Secrétaire** | `bernard@mediclinic.com` | `secretarypassword` |
| **Pharmacien** | `moussa@mediclinic.com` | `pharmacistpassword` |
| **Laborantin** | `fatou@mediclinic.com` | `labpassword` |

---

## 🌟 Fonctionnalités du MVP V1 Développées

1. **Dashboard Interactif** :
   - Graphiques de répartition des recettes et statistiques clés du jour.
   - Journal d'audit d'activité clinique en temps réel.
   - Raccourcis d'actions rapides (Nouveau patient, Prendre RDV).
2. **Dossier Patient & Consultation** :
   - Fiche d'identification complète avec historique timeline unifié (visites, ordonnances, labo, factures).
   - Constantes cliniques (Tension, Température, Poids, Pulsations), diagnostics et notes médicales.
   - Générateur d'ordonnance et prescripteur d'analyses.
3. **Agenda & Rendez-vous** :
   - Planification avec détection automatique de collision d'horaire par praticien.
   - Émetteur de rappels SMS (simulés en popup d'alerte et journal de console).
4. **Pharmacie & Dispensaire** :
   - Catalogue avec indicateur de stock bas et date de péremption à 30 jours (alertes couleur).
   - Traitement des ordonnances avec décrémentation automatique des stocks.
5. **Laboratoire d'analyses** :
   - File d'attente des examens prescrits.
   - Formulaire de saisie des résultats et compte-rendu consultable dans le dossier patient.
6. **Caisse & Règlements** :
   - Encaissement multi-actes (espèces, Wave, Orange Money, MTN MoMo).
   - Émission et impression de reçus de caisse au format ticket.
7. **Simulation Mobile Money (Sandbox)** :
   - Interface de simulation de paiement de l'abonnement de 15 000 FCFA/mois.
   - Le système d'autorisation JWT vérifie la validité de l'abonnement et verrouille le mode écriture si expiré.
8. **Mode Hors-ligne Basique** :
   - Détecteur de statut réseau.
   - Mise en file d'attente locale (`localStorage`) des actions créées hors connexion avec synchronisation automatique lors du retour au réseau.
