export function FormDrawerFooter({ children }: { children: React.ReactNode }) {
  return (
    <footer className="sticky bottom-0 border-t border-gray-300 bg-gray-100 p-4">
      {children}
    </footer>
  );
}
