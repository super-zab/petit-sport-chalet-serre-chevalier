import crypto from "crypto";

export interface TokenData {
  eventId: string;
  calendarId: string;
  bookingData: {
    apartmentName: string;
    startDate: string;
    endDate: string;
    name: string;
    email: string;
    phone: string;
    guests: string;
  };
}

// En production, utilisez une base de données pour stocker les tokens
// Pour cette implémentation, nous utilisons un Map en mémoire
// Note: Les tokens seront perdus au redémarrage du serveur
const tokenStore = new Map<string, TokenData>();

export function generateToken(data: TokenData): string {
  const token = crypto.randomBytes(32).toString("hex");
  tokenStore.set(token, data);
  
  // Expire après 7 jours
  setTimeout(() => {
    tokenStore.delete(token);
  }, 7 * 24 * 60 * 60 * 1000);
  
  return token;
}

export function getTokenData(token: string): TokenData | null {
  return tokenStore.get(token) || null;
}

export function deleteToken(token: string): void {
  tokenStore.delete(token);
}
