import { AppShell } from '../../components/layout/AppShell';

export default function AdminOverview() {
  return (
    <AppShell pageTitle="Overview">
      <div
        data-testid="screen-admin-dashboard"
        className="flex items-center justify-center h-full"
      >
        <div className="text-center">
          <p className="text-[#4A5A67] text-sm">Coming soon — full overview in M4</p>
        </div>
      </div>
    </AppShell>
  );
}
