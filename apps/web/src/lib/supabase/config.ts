const readRequired = (name: string, value: string | undefined): string => {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

export const getSupabaseConfig = () => ({
  url: readRequired("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  publishableKey: readRequired(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
});
