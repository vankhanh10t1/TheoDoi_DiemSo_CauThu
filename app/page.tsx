import { AppShell } from '../components/app-shell';
import { AppProvider } from '../components/app-context';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <AppProvider>
      <main className="page-shell">
        <AppShell />
      </main>
    </AppProvider>
  );
}