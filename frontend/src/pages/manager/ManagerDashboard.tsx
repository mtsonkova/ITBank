import { AppShell } from '../../components/layout/AppShell';

export default function ManagerDashboard() {
  return (
    <AppShell pageTitle="Dashboard">
      <div
        data-testid="screen-manager-dashboard"
        className="flex items-center justify-center h-full"
      >
        <div className="text-center">
          <p className="text-[#4A5A67] text-sm">Coming soon — full dashboard in M3</p>
        </div>
      </div>
    </AppShell>
  );
}
