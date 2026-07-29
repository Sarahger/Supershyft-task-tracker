import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import clsx from 'clsx';
import { Download, Search } from 'lucide-react';
import { attendanceApi, departmentsApi, usersApi } from '../services/endpoints';
import { AttendanceHrStats } from '../components/attendance/AttendanceHrStats';
import { AttendanceHrWeekTable } from '../components/attendance/AttendanceHrWeekTable';
import { AttendanceEmployeeDrawer } from '../components/attendance/AttendanceEmployeeDrawer';
import { AttendanceTable } from '../components/attendance/AttendanceTable';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { toast } from '../components/ui/Toast';
import type { AttendanceFilterStatus } from '../types';

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
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState<AttendanceFilterStatus>('ALL');
  const [userId, setUserId] = useState('');
  const [view, setView] = useState<'week' | 'table'>('week');
  const [drawerUserId, setDrawerUserId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const opt = options.find((o) => o.value === selectedMonth) ?? options[0];

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list().then((r) => r.data.data),
  });

  const { data: users } = useQuery({
    queryKey: ['users', 'attendance-hr'],
    queryFn: () => usersApi.list({ page_size: 100 }).then((r) => r.data.data.items),
  });

  const listParams = {
    year: opt.year,
    month: opt.month,
    department_id: departmentId ? Number(departmentId) : undefined,
    user_id: userId ? Number(userId) : undefined,
    status: status === 'ALL' ? undefined : status,
  };

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['attendance', 'list', listParams],
    queryFn: () => attendanceApi.list(listParams).then((r) => r.data.data),
  });

  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['attendance', 'week', departmentId],
    queryFn: () =>
      attendanceApi
        .week({ department_id: departmentId ? Number(departmentId) : undefined })
        .then((r) => r.data.data),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await attendanceApi.exportCsv({
        year: opt.year,
        month: opt.month,
        department_id: departmentId ? Number(departmentId) : null,
        user_id: userId ? Number(userId) : null,
        status,
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

  return (
    <div className="w-full pb-12" data-testid="attendance-hr-page">
      <PageHeader
        title="Attendance — HR"
        subtitle="Organization overview and monthly filters."
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

      <AttendanceHrStats stats={listData?.today_stats} loading={listLoading} />

      <div className="sticky top-0 z-20 mt-6 mb-4 py-3 bg-dark-bg border-b border-dark-border">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
            <input
              type="search"
              placeholder="Search employee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 py-2 text-sm min-h-[40px]"
              data-testid="hr-search"
            />
          </div>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="input py-2 text-sm w-auto min-h-[40px]"
            aria-label="Department"
          >
            <option value="">All departments</option>
            {(departments || []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="input py-2 text-sm w-auto min-h-[40px]"
            aria-label="Employee"
          >
            <option value="">All employees</option>
            {(users || []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name}
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input py-2 text-sm w-auto min-h-[40px]"
            aria-label="Month"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceFilterStatus)}
            className="input py-2 text-sm w-auto min-h-[40px]"
            aria-label="Status"
          >
            <option value="ALL">All statuses</option>
            <option value="WFO">WFO</option>
            <option value="WFH">WFH</option>
            <option value="LEAVE">Leave</option>
            <option value="NOT_MARKED">Not Marked</option>
          </select>
          <div className="flex rounded-lg border border-dark-border overflow-hidden bg-dark-card ml-auto">
            <button
              type="button"
              onClick={() => setView('week')}
              className={clsx(
                'px-3 py-2 text-xs font-medium min-h-[40px] transition-colors duration-hover',
                view === 'week' ? 'bg-surface-highlight text-text-primary' : 'text-text-muted',
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView('table')}
              className={clsx(
                'px-3 py-2 text-xs font-medium min-h-[40px] transition-colors duration-hover',
                view === 'table' ? 'bg-surface-highlight text-text-primary' : 'text-text-muted',
              )}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      <section className="workspace-section !mb-0">
        <h2 className="workspace-section-title">Attendance this week</h2>
        {view === 'week' ? (
          <AttendanceHrWeekTable
            week={weekData}
            loading={weekLoading}
            onSelectUser={setDrawerUserId}
            search={search}
          />
        ) : (
          <AttendanceTable records={listData?.records ?? []} loading={listLoading} />
        )}
      </section>

      <AttendanceEmployeeDrawer userId={drawerUserId} onClose={() => setDrawerUserId(null)} />
    </div>
  );
}
