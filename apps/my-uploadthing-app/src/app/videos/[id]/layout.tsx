export default function VideoLayout({
  children,
  modal, // slot paralelo
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal} {/* aquí se renderizan intercepts como modal */}
    </>
  );
}
