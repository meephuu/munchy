import { AccountsOff } from "@/components/AccountsOff";
import { SignupForm } from "@/components/SignupForm";
import { supabaseConfig } from "@/lib/supabase/env";

export default function SignupPage() {
  return supabaseConfig() ? <SignupForm /> : <AccountsOff />;
}
