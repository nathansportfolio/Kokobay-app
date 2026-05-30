export type AuthErrorFlow = 'login' | 'register' | 'forgot';

export type AuthErrorCard = {
  title: string;
  message: string;
};

const LOGIN_CREDENTIAL_CODES = new Set(['invalid_credentials', 'unauthorized']);

const TECHNICAL_PATTERNS = [
  /^4\d{2}\b/i,
  /^5\d{2}\b/i,
  /bad request/i,
  /authentication failed/i,
  /invalid credentials/i,
  /request failed/i,
  /unexpected response/i,
];

function isTechnicalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function resolveAuthErrorCard(
  error: string,
  flow: AuthErrorFlow,
  code?: string,
): AuthErrorCard {
  const normalizedCode = code?.trim().toLowerCase();

  if (normalizedCode && LOGIN_CREDENTIAL_CODES.has(normalizedCode)) {
    return {
      title: "We couldn't sign you in.",
      message: 'Please check your email and password and try again.',
    };
  }

  switch (normalizedCode) {
    case 'duplicate':
    case 'email_taken':
      return {
        title: 'This email is already registered.',
        message: 'Sign in instead, or use a different email address.',
      };
    case 'weak_password':
      return {
        title: "We couldn't create your account.",
        message: 'Please choose a stronger password and try again.',
      };
    case 'invalid_email':
      return {
        title: 'Please check your email.',
        message: 'Enter a valid email address and try again.',
      };
    case 'rate_limited':
      return {
        title: 'Too many attempts.',
        message: 'Please wait a moment and try again.',
      };
    default:
      break;
  }

  if (flow === 'login' && /invalid email or password/i.test(error)) {
    return {
      title: "We couldn't sign you in.",
      message: 'Please check your email and password and try again.',
    };
  }

  if (flow === 'register' && /already exists/i.test(error)) {
    return {
      title: 'This email is already registered.',
      message: 'Sign in instead, or use a different email address.',
    };
  }

  if (flow === 'forgot' && /valid email/i.test(error)) {
    return {
      title: 'Please check your email.',
      message: 'Enter a valid email address and try again.',
    };
  }

  if (isTechnicalMessage(error)) {
    if (flow === 'login') {
      return {
        title: "We couldn't sign you in.",
        message: 'Please check your details and try again.',
      };
    }
    if (flow === 'register') {
      return {
        title: "We couldn't create your account.",
        message: 'Something went wrong. Please try again.',
      };
    }
    return {
      title: 'Something went wrong.',
      message: 'Please try again in a moment.',
    };
  }

  return {
    title:
      flow === 'login' ? "We couldn't sign you in."
      : flow === 'register' ? "We couldn't create your account."
      : 'Something went wrong.',
    message: error.trim() || 'Something went wrong. Please try again.',
  };
}

export function mapFieldErrorMessage(
  field: 'email' | 'password' | 'confirmPassword' | 'firstName' | 'lastName',
  message?: string,
): string | undefined {
  if (!message) return undefined;

  if (field === 'email') {
    if (/valid email/i.test(message) || message === 'Enter a valid email') {
      return 'Please enter a valid email address';
    }
    if (/required/i.test(message)) {
      return 'Please enter your email address';
    }
  }

  if (field === 'password') {
    if (/incorrect|invalid.*password/i.test(message)) {
      return 'Incorrect password';
    }
    if (/required/i.test(message) || /enter your password/i.test(message)) {
      return 'Please enter your password';
    }
  }

  if (field === 'confirmPassword' && /match/i.test(message)) {
    return 'Passwords do not match';
  }

  return message;
}
