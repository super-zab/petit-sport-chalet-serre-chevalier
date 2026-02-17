/**
 * Récupération des credentials Google (Service Account) pour le déploiement sécurisé.
 * Priorité : GOOGLE_SERVICE_KEY (JSON string) puis GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.
 */

export interface GoogleCredentials {
  client_email: string;
  private_key: string;
}

/**
 * Retourne les credentials Google à partir de la variable d'environnement GOOGLE_SERVICE_KEY
 * (contenu du fichier JSON du Service Account en string) ou des variables GOOGLE_CLIENT_EMAIL
 * et GOOGLE_PRIVATE_KEY (rétrocompatibilité).
 * @throws Error si aucune configuration valide n'est trouvée
 */
export function getGoogleCredentials(): GoogleCredentials {
  const raw = process.env.GOOGLE_SERVICE_KEY?.trim();

  if (raw) {
    try {
      const credentials = JSON.parse(raw) as Record<string, unknown>;
      const client_email = credentials.client_email;
      const private_key = credentials.private_key;

      if (typeof client_email !== "string" || typeof private_key !== "string") {
        throw new Error(
          "GOOGLE_SERVICE_KEY invalide : le JSON doit contenir client_email et private_key (strings)."
        );
      }

      if (!client_email || !private_key) {
        throw new Error(
          "GOOGLE_SERVICE_KEY invalide : client_email et private_key ne doivent pas être vides."
        );
      }

      return {
        client_email,
        private_key: private_key.replace(/\\n/g, "\n"),
      };
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(
          "GOOGLE_SERVICE_KEY invalide : la valeur doit être un JSON valide (chaîne parsable)."
        );
      }
      throw err;
    }
  }

  // Rétrocompatibilité : variables distinctes
  const client_email = process.env.GOOGLE_CLIENT_EMAIL;
  const private_key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!client_email || !private_key) {
    throw new Error(
      "Credentials Google non configurés. Définissez GOOGLE_SERVICE_KEY (JSON complet en string) ou GOOGLE_CLIENT_EMAIL et GOOGLE_PRIVATE_KEY."
    );
  }

  return { client_email, private_key };
}
