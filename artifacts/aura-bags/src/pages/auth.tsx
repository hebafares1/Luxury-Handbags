import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'wouter';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { isSupabaseConfigured, supabaseClient } from '@/lib/supabase';

type AuthMode = 'login' | 'signup';
type AuthMessage = { kind: 'success' | 'error'; text: string };

function createAuthSchema(mode: AuthMode) {
  return z.object({
    email: z.string().trim().email('Enter a valid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.'),
    confirmPassword: z.string().optional(),
  }).superRefine((values, context) => {
    if (mode !== 'signup') return;
    if (!values.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Confirm your password.',
      });
    } else if (values.password !== values.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Passwords do not match.',
      });
    }
  });
}

type AuthValues = z.infer<ReturnType<typeof createAuthSchema>>;

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'We couldn’t complete that request. Please try again.';
}

function AuthPage({ mode }: { mode: AuthMode }) {
  const isSignup = mode === 'signup';
  const schema = useMemo(() => createAuthSchema(mode), [mode]);
  const form = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });
  const [message, setMessage] = useState<AuthMessage | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const submit = async (values: AuthValues) => {
    setMessage(null);
    if (!supabaseClient) {
      setMessage({
        kind: 'error',
        text: 'Authentication is not configured. Please contact the store owner.',
      });
      return;
    }

    try {
      if (isSignup) {
        const { data, error } = await supabaseClient.auth.signUp({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;

        form.reset({ email: values.email, password: '', confirmPassword: '' });
        if (data.session) {
          toast({ title: 'Account created', description: 'Welcome to ROSE.' });
          setLocation('/');
        } else {
          setMessage({
            kind: 'success',
            text: 'Check your email for a confirmation link to finish creating your account.',
          });
        }
        return;
      }

      const { error } = await supabaseClient.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;

      form.reset({ email: values.email, password: '', confirmPassword: '' });
      toast({ title: 'Welcome back', description: 'You are signed in to ROSE.' });
      setLocation('/');
    } catch (error) {
      setMessage({ kind: 'error', text: getErrorMessage(error) });
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-header">
        <Link href="/" className="brand-mark" aria-label="ROSE home" data-testid="link-auth-home">ROSE</Link>
        <Link href="/" className="auth-back-link" data-testid="link-back-to-store">Back to store</Link>
      </header>

      <div className="auth-main">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-kicker">ROSE account</div>
          <h1 id="auth-title" className="auth-title">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="auth-description">
            {isSignup
              ? 'Create an account to stay close to the pieces you love.'
              : 'Sign in to continue to ROSE.'}
          </p>

          {!isSupabaseConfigured && (
            <div className="auth-message is-error" role="alert" data-testid="status-auth-config">
              Authentication is not configured. Please contact the store owner.
            </div>
          )}
          {message && (
            <div
              className={`auth-message ${message.kind === 'success' ? 'is-success' : 'is-error'}`}
              role={message.kind === 'success' ? 'status' : 'alert'}
              data-testid={`status-auth-${message.kind}`}
            >
              {message.text}
            </div>
          )}

          <Form {...form}>
            <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="auth-field">
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="auth-input"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        placeholder="you@example.com"
                        data-testid="input-auth-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="auth-field">
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="auth-input"
                        type="password"
                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                        placeholder="Enter your password"
                        data-testid="input-auth-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isSignup && (
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="auth-field">
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="auth-input"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Enter your password again"
                          data-testid="input-auth-confirm-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <button
                className="auth-submit"
                type="submit"
                disabled={form.formState.isSubmitting}
                data-testid="button-auth-submit"
              >
                {form.formState.isSubmitting
                  ? (isSignup ? 'Creating account…' : 'Signing in…')
                  : (isSignup ? 'Create account' : 'Sign in')}
              </button>
            </form>
          </Form>

          <p className="auth-switch">
            {isSignup ? 'Already have an account?' : 'New to ROSE?'}{' '}
            <Link href={isSignup ? '/login' : '/signup'} data-testid="link-auth-switch">
              {isSignup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

export function LoginPage() {
  return <AuthPage mode="login" />;
}

export function SignUpPage() {
  return <AuthPage mode="signup" />;
}
