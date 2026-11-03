import { AccountsOff } from "@/components/AccountsOff";
import { LoginForm } from "@/components/LoginForm";
import { supabaseConfig } from "@/lib/supabase/env";

export default function LoginPage() {
  return supabaseConfig() ? <LoginForm /> : <AccountsOff />;
}
