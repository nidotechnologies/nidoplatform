// Frontend-only password reset simulation.
//
// TODO: Connect requestResetEmail() to the authentication provider when a
// real password-reset email service is available.
// TODO: Connect completePasswordReset() to the authentication provider when
// password updates are supported by the backend.

const SIMULATION_DELAY_MS = 650;

function simulateDelay(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, SIMULATION_DELAY_MS));
}

/**
 * Simulates requesting a reset link without checking whether the account
 * exists. This intentionally keeps the response privacy-preserving.
 */
export async function requestResetEmail(_email: string): Promise<void> {
  await simulateDelay();
}

/**
 * Simulates a successful password reset. The password is never stored,
 * logged, placed in a URL, or sent to a backend.
 */
export async function completePasswordReset(_password: string): Promise<void> {
  await simulateDelay();
}