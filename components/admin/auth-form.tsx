"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import type { FormState } from "@/app/admin/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthFormProps {
  mode: "login" | "setup";
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
  minPasswordLength: number;
}

export function AuthForm({ mode, action, minPasswordLength }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  // React vide les champs non contrôlés après chaque envoi : l'email et le jeton sont
  // gardés en mémoire pour ne pas avoir à les ressaisir après une erreur.
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const isSetup = mode === "setup";

  return (
    <form action={formAction} className="space-y-4">
      {isSetup && (
        <div>
          <Label htmlFor="token">Jeton d&apos;installation</Label>
          <Input id="token" name="token" type="password" required autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} />
          <p className="mt-1 text-xs text-chalet-muted">
            C&apos;est la valeur de ADMIN_SETUP_TOKEN définie sur le serveur.
          </p>
        </div>
      )}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="username" maxLength={200} value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={isSetup ? minPasswordLength : undefined}
          maxLength={500}
          autoComplete={isSetup ? "new-password" : "current-password"}
        />
        {isSetup && (
          <p className="mt-1 text-xs text-chalet-muted">
            {minPasswordLength} caractères minimum. Une phrase de plusieurs mots est idéale.
          </p>
        )}
      </div>
      {state.error && (
        <p role="alert" className="rounded-sm border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSetup ? "Créer le compte" : "Se connecter"}
      </Button>
    </form>
  );
}
