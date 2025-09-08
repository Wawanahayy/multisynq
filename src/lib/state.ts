let currentTokenIdentifier: string | null = null;

export function setCurrentToken(id: string) {
  currentTokenIdentifier = id;
}

export function getCurrentToken(): string | null {
  return currentTokenIdentifier;
}
