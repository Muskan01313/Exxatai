import { safeCallbackUrl } from "@/lib/safeRedirect";
import { AuthForm } from "../AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const { callbackUrl } = await searchParams;
  return <AuthForm mode="login" callbackUrl={safeCallbackUrl(callbackUrl)} />;
}
