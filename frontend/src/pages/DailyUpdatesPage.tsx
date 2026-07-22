import { DailyUpdatesPanel } from '../components/daily-updates/DailyUpdatesPanel';

export default function DailyUpdatesPage() {
  return (
    <div className="w-full pb-12">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-text-primary">Daily Updates</h1>
        <p className="text-sm text-text-muted mt-0.5">
          What got done today — editable until 10:30 AM the next morning.
        </p>
      </header>
      <DailyUpdatesPanel hideIntro />
    </div>
  );
}
