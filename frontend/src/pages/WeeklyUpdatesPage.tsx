import { WeeklyUpdatesPanel } from '../components/weekly-updates/WeeklyUpdatesPanel';

export default function WeeklyUpdatesPage() {
  return (
    <div className="w-full pb-12">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-text-primary">Weekly Updates</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Review team progress, weekly commitments and deadlines.
        </p>
      </header>
      <WeeklyUpdatesPanel />
    </div>
  );
}
