import { safeCallbackUrl } from "@/lib/safeRedirect";
import { AuthForm } from "../AuthForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const { callbackUrl } = await searchParams;
  return <AuthForm mode="signup" callbackUrl={safeCallbackUrl(callbackUrl)} />;
}
