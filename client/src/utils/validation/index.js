export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordStrength(password) {
  let strength = 0;
  const feedback = [];

  if (!password) return { score: 0, strength: 'very-weak', feedback };

  if (password.length >= 8) strength++;
  else feedback.push('At least 8 characters');

  if (password.length >= 12) strength++;

  if (/[a-z]/.test(password)) strength++;
  else feedback.push('At least one lowercase letter');

  if (/[A-Z]/.test(password)) strength++;
  else feedback.push('At least one uppercase letter');

  if (/[0-9]/.test(password)) strength++;
  else feedback.push('At least one number');

  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  else feedback.push('At least one special character');

  const strengthMap = {
    0: 'very-weak',
    1: 'weak',
    2: 'fair',
    3: 'good',
    4: 'strong',
    5: 'very-strong',
  };

  return {
    score: strength,
    strength: strengthMap[strength] || 'very-weak',
    feedback,
  };
}
