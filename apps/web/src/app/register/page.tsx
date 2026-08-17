import RegisterPage from "@/components/RegisterPage";

type PageProps = {
  searchParams: Promise<{
    invite?: string;
  }>;
};

export default async function Page({
  searchParams,
}: PageProps) {
  const query = await searchParams;

  return (
    <RegisterPage
      inviteToken={query.invite ?? ""}
    />
  );
}