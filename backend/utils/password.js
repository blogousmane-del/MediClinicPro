const bcrypt = require('bcryptjs');

// Règle unique de robustesse des mots de passe, appliquée à TOUS les points de
// création ou de changement : inscription clinique, création de collaborateur,
// ajout groupé de l'onboarding, changement de mot de passe.
//
// Elle n'existait auparavant qu'à un seul endroit — PUT /auth/password, qui
// exigeait 6 caractères — c'est-à-dire au seul endroit où l'appelant est déjà
// authentifié. Les comptes se créaient donc sans aucune contrainte : un mot de
// passe d'un caractère passait à l'inscription d'une clinique.
const MIN_PASSWORD_LENGTH = 8;

// Coût bcrypt de tout nouveau hachage. Il valait 10, écrit en dur à chaque
// appel. Les hachages existants restent valides : bcrypt lit le coût dans le
// hachage lui-même, la connexion d'un ancien compte ne change donc pas.
const BCRYPT_COST = 12;

const PASSWORD_ERROR = `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;

// Renvoie null si le mot de passe convient, sinon le message d'erreur français
// à retourner tel quel au client.
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return PASSWORD_ERROR;
  }
  return null;
}

// Seul point du backend qui hache un mot de passe (un test le vérifie).
function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

module.exports = { MIN_PASSWORD_LENGTH, PASSWORD_ERROR, validatePassword, hashPassword };
