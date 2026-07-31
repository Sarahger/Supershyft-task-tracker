import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download } from 'lucide-react';
import { attendanceApi } from '../services/endpoints';
import { AttendanceHrStats, ATTENDANCE_HR_STAT_LABELS } from '../components/attendance/AttendanceHrStats';
import { AttendanceHrPeopleModal } from '../components/attendance/AttendanceHrPeopleModal';
import { AttendanceEmployeeDrawer } from '../components/attendance/AttendanceEmployeeDrawer';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import type { AttendanceTodayStatKey } from '../types';

function monthOptions(count = 18) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${d.getMonth() + 1}`,
      label: format(d, 'MMMM yyyy'),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    });
  }
  return out;
}

export default function AttendanceHrPage() {
  const navigate = useNavigate();
  const options = monthOptions();
  const [selectedMonth, setSelectedMonth] = useState(options[0].value);
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);
  const [statKey, setStatKey] = useState<AttendanceTodayStatKey | null>(null);
  const [exporting, setExporting] = useState(false);

  const opt = options.find((o) => o.value === selectedMonth) ?? options[0];

  const listParams = {
    year: opt.year,
    month: opt.month,
  };

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['attendance', 'list', listParams],
    queryFn: () => attendanceApi.list(listParams).then((r) => r.data.data),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await attendanceApi.exportCsv({
        year: opt.year,
        month: opt.month,
        status: 'ALL',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'attendance_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const people = (statKey && listData?.today_stats?.people?.[statKey]) || [];
  const peopleTitle = statKey
    ? `${ATTENDANCE_HR_STAT_LABELS[statKey]} · ${people.length}`
    : '';

  return (
    <div className="w-full pb-12" data-testid="attendance-hr-page">
      <PageHeader
        title="Attendance — HR"
        subtitle="Organization overview for today, and monthly attendance records."
        onMobileBack={() => navigate('/attendance')}
        action={
          <Button
            variant="secondary"
            loading={exporting}
            onClick={handleExport}
            data-testid="export-csv"
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        }
      />

      <AttendanceHrStats
        stats={listData?.today_stats}
        loading={listLoading}
        activeKey={statKey}
        onSelect={setStatKey}
      />

      <div className="sticky top-0 z-20 mt-6 mb-4 py-3 bg-dark-bg border-b border-dark-border">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
            Month
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input py-2 text-sm w-auto min-h-[40px]"
              aria-label="Month"
              data-testid="hr-month-filter"
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="workspace-section !mb-0">
        <h2 className="workspace-section-title">Attendance · {opt.label}</h2>
        <AttendanceTable
          records={listData?.records ?? []}
          loading={listLoading}
          showEmployee
          onSelectUser={setDrawerUserId}
        />
      </section>

      <AttendanceHrPeopleModal
        open={!!statKey}
        title={peopleTitle}
        people={people}
        onClose={() => setStatKey(null)}
        onSelectUser={setDrawerUserId}
      />

      <AttendanceEmployeeDrawer userId={drawerUserId} onClose={() => setDrawerUserId(null)} />
    </div>
  );
}
