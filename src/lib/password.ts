export const MIN_PASSWORD_LENGTH = 10;

// Score from 0 to 4, rendered as four pips on the signup form. Length carries most of
// the weight; the character-class checks only nudge it up.
export function passwordStrength(pw: string) {
  let s = 0;
  if (pw.length >= MIN_PASSWORD_LENGTH) s++;
  if (pw.length >= 14) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
