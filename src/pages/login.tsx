import { zodResolver } from "@hookform/resolvers/zod";
import { Receipt } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn, session, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (loading) return null;
  if (session) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      await signIn(data.email, data.password);
      navigate("/", { replace: true });
    } catch (e) {
      setError(t("auth.signInError"));
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-[color:var(--color-background)] to-[color:var(--color-accent)] p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-xl bg-[color:var(--color-primary)] text-white grid place-items-center">
            <Receipt className="h-7 w-7" />
          </div>
          <CardTitle>{t("app.name")}</CardTitle>
          <CardDescription>{t("common.login")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                dir="ltr"
                className="text-start"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-[color:var(--color-destructive)] mt-1">
                  {t("common.required")}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                className="text-start"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-[color:var(--color-destructive)] mt-1">
                  {t("common.required")}
                </p>
              )}
            </div>
            {error && (
              <div className="rounded-md bg-[color:var(--color-destructive)]/10 p-3 text-sm text-[color:var(--color-destructive)]">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
