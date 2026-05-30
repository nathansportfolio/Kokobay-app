import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Please enter your email address')
    .email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export type PasswordRequirement = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

const REGISTER_PASSWORD_MIN_LENGTH = 10;

export const REGISTER_PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: 'length',
    label: '10+ characters',
    test: (password) => password.length >= REGISTER_PASSWORD_MIN_LENGTH,
  },
  {
    id: 'upper',
    label: 'Uppercase letter',
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lower',
    label: 'Lowercase letter',
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'Number',
    test: (password) => /[0-9]/.test(password),
  },
];

export const registerSchema = z
  .object({
    firstName: z.string().min(1, 'Please enter your first name').max(80),
    lastName: z.string().min(1, 'Please enter your last name').max(80),
    email: z
      .string()
      .min(1, 'Please enter your email address')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(REGISTER_PASSWORD_MIN_LENGTH, 'Use at least 10 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[a-z]/, 'Include at least one lowercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Please enter your email address')
    .email('Please enter a valid email address'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
