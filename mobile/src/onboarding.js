/**
 * Show onboarding until the server marks the profile complete and a home address is saved.
 */
export function shouldShowOnboarding(profile) {
  if (!profile || typeof profile !== 'object') {
    return true;
  }
  const home = String(profile.home_address ?? '').trim();
  const oc = profile.onboarding_completed;
  const markedDone =
    oc === true ||
    oc === 1 ||
    oc === 'true' ||
    oc === '1';
  if (!markedDone) {
    return true;
  }
  if (!home) {
    return true;
  }
  return false;
}
