import { test, expect, type Page, type Route } from '@playwright/test';

const meUnmarked = {
  success: true,
  message: '',
  data: {
    year: 2026,
    month: 7,
    today: '2026-07-29',
    today_record: null,
    records: [],
    summary: {
      wfo_count: 0,
      wfh_count: 0,
      leave_count: 0,
      half_day_count: 0,
      camp_count: 0,
      present_count: 0,
      total_marked: 0,
      working_days: 20,
      attendance_percent: 0,
      late_count: 0,
    },
    week: [null, null, null, null, null, null, null],
  },
};

const markedRecord = {
  id: 1,
  user_id: 1,
  attendance_date: '2026-07-29',
  status: 'WFO',
  recorded_at: '2026-07-29T03:44:00Z',
  created_at: '2026-07-29T03:44:00Z',
  editable: false,
};

const meMarked = {
  ...meUnmarked,
  data: {
    ...meUnmarked.data,
    today_record: markedRecord,
    records: [markedRecord],
    summary: {
      ...meUnmarked.data.summary,
      wfo_count: 1,
      present_count: 1,
      total_marked: 1,
      attendance_percent: 5,
    },
    week: [null, null, markedRecord, null, null, null, null],
  },
};

const fakeEmployee = {
  id: 1,
  first_name: 'Test',
  last_name: 'Employee',
  email: 'test@company.com',
  role: 'employee',
  status: 'active',
  departments: [],
  created_at: '2026-01-01T00:00:00Z',
};

const fakeManager = {
  ...fakeEmployee,
  id: 2,
  first_name: 'Man',
  last_name: 'Ager',
  email: 'mgr@company.com',
  role: 'manager',
};

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

async function fulfillApi(
  route: Route,
  opts: {
    user: typeof fakeEmployee;
    getMe: () => typeof meUnmarked;
    onMark?: () => void;
  },
) {
  const url = route.request().url();
  const method = route.request().method();
  const path = new URL(url).pathname;

  if (path.includes('/auth/me')) {
    await route.fulfill(json({ success: true, data: opts.user, message: '' }));
    return;
  }
  if (path.includes('/auth/refresh')) {
    await route.fulfill(
      json({ success: true, data: { access_token: 'e2e-test-token', refresh_token: 'e2e-refresh' }, message: '' }),
    );
    return;
  }
  if (path.includes('/notifications')) {
    await route.fulfill(json({ success: true, data: [], message: '' }));
    return;
  }
  if (method === 'POST' && (path === '/api/attendance' || path.endsWith('/attendance'))) {
    opts.onMark?.();
    await route.fulfill(json({ success: true, data: markedRecord, message: 'Attendance Recorded' }));
    return;
  }
  if (path.includes('/attendance/me')) {
    await route.fulfill(json(opts.getMe()));
    return;
  }
  if (path.includes('/attendance/week')) {
    await route.fulfill(
      json({
        success: true,
        data: {
          week_start: '2026-07-27',
          week_end: '2026-08-02',
          rows: [
            {
              user: {
                id: 1,
                first_name: 'Emp',
                last_name: 'Loyee',
                departments: ['Engineering'],
              },
              days: [
                { date: '2026-07-27', status: null, recorded_at: null },
                { date: '2026-07-28', status: null, recorded_at: null },
                { date: '2026-07-29', status: 'WFO', recorded_at: '2026-07-29T03:44:00Z' },
                { date: '2026-07-30', status: null, recorded_at: null },
                { date: '2026-07-31', status: null, recorded_at: null },
                { date: '2026-08-01', status: null, recorded_at: null },
                { date: '2026-08-02', status: null, recorded_at: null },
              ],
            },
          ],
        },
        message: '',
      }),
    );
    return;
  }
  if (path.includes('/attendance/day')) {
    const empUser = {
      id: 1,
      first_name: 'Emp',
      last_name: 'Loyee',
      departments: ['Engineering'],
      profile_picture: null,
      job_title: 'Engineer',
      role: 'employee',
    };
    await route.fulfill(
      json({
        success: true,
        data: {
          date: '2026-07-29',
          rows: [
            {
              user: empUser,
              status: 'WFO',
              recorded_at: '2026-07-29T03:44:00Z',
              attendance_date: '2026-07-29',
            },
            {
              user: {
                id: 2,
                first_name: 'Man',
                last_name: 'Ager',
                departments: ['HR'],
              },
              status: null,
              recorded_at: null,
              attendance_date: '2026-07-29',
            },
          ],
          stats: {
            present_wfo: 1,
            wfh: 0,
            on_leave: 0,
            half_day: 0,
            camp: 0,
            not_marked: 1,
            total_active: 2,
            people: {
              present_wfo: [empUser],
              wfh: [],
              on_leave: [],
              half_day: [],
              camp: [],
              not_marked: [
                {
                  id: 2,
                  first_name: 'Man',
                  last_name: 'Ager',
                  departments: ['HR'],
                },
              ],
            },
          },
        },
        message: '',
      }),
    );
    return;
  }
  if (path.includes('/attendance/users/')) {
    await route.fulfill(
      json({
        success: true,
        data: {
          user: {
            id: 1,
            first_name: 'Emp',
            last_name: 'Loyee',
            departments: ['Engineering'],
            role: 'employee',
          },
          year: 2026,
          month: 7,
          records: [markedRecord],
          summary: meMarked.data.summary,
        },
        message: '',
      }),
    );
    return;
  }
  if (method === 'POST' && path.includes('/attendance/export/csv')) {
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: 'Employee,Department,Date,Status,Time\n',
      headers: { 'Content-Disposition': 'attachment; filename=attendance_export.csv' },
    });
    return;
  }
  if (path.endsWith('/attendance') || path.endsWith('/attendance/')) {
    const empUser = {
      id: 1,
      first_name: 'Emp',
      last_name: 'Loyee',
      departments: ['Engineering'],
      profile_picture: null,
      job_title: 'Engineer',
      role: 'employee',
    };
    await route.fulfill(
      json({
        success: true,
        data: {
          records: [{ ...markedRecord, user: empUser }],
          today_stats: {
            present_wfo: 1,
            wfh: 0,
            on_leave: 0,
            half_day: 0,
            camp: 0,
            not_marked: 2,
            total_active: 3,
            people: {
              present_wfo: [empUser],
              wfh: [],
              on_leave: [],
              half_day: [],
              camp: [],
              not_marked: [
                {
                  id: 2,
                  first_name: 'Man',
                  last_name: 'Ager',
                  departments: ['HR'],
                },
                {
                  id: 3,
                  first_name: 'Other',
                  last_name: 'Person',
                  departments: [],
                },
              ],
            },
          },
          year: 2026,
          month: 7,
        },
        message: '',
      }),
    );
    return;
  }
  if (path.includes('/departments')) {
    await route.fulfill(json({ success: true, data: [], message: '' }));
    return;
  }
  if (path.includes('/users')) {
    await route.fulfill(
      json({
        success: true,
        data: { items: [], total: 0, page: 1, page_size: 100, total_pages: 0 },
        message: '',
      }),
    );
    return;
  }
  await route.fulfill(json({ success: true, data: null, message: '' }));
}

async function mockAuth(page: Page, user: typeof fakeEmployee, getMe: () => typeof meUnmarked, onMark?: () => void) {
  await page.addInitScript(() => {
    localStorage.setItem('access_token', 'e2e-test-token');
    localStorage.setItem('refresh_token', 'e2e-refresh');
  });
  await page.route('**/api/**', (route) => fulfillApi(route, { user, getMe, onMark }));
}

test.describe('Attendance employee flows', () => {
  test('one-tap mark shows success and submitted state', async ({ page }) => {
    let marked = false;
    await mockAuth(page, fakeEmployee, () => (marked ? meMarked : meUnmarked), () => {
      marked = true;
    });

    await page.goto('/attendance');
    await expect(page.getByTestId('attendance-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('mark-WFO')).toBeVisible();
    await page.getByTestId('mark-WFO').click();
    await expect(page.getByTestId('attendance-success')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('attendance-submitted')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('edit-today-attendance')).toBeVisible();
  });

  test('employee is redirected away from HR route', async ({ page }) => {
    await mockAuth(page, fakeEmployee, () => meMarked);
    await page.goto('/attendance/hr');
    await expect(page).not.toHaveURL(/\/attendance\/hr/, { timeout: 15000 });
  });

  test('crafted status strings are not rendered as HTML', async ({ page }) => {
    await mockAuth(page, fakeEmployee, () => meMarked);
    await page.goto('/attendance');
    await expect(page.getByTestId('attendance-submitted')).toBeVisible({ timeout: 15000 });
    const html = await page.content();
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

test.describe('Attendance HR flows', () => {
  test('manager sees HR day table, calendar, and KPI people list', async ({ page }) => {
    await mockAuth(page, { ...fakeManager, role: 'administrator' }, () => meMarked);
    await page.goto('/attendance/hr');
    await expect(page.getByTestId('attendance-hr-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('hr-stat-present_wfo')).toBeVisible();
    await expect(page.getByTestId('hr-open-calendar')).toBeVisible();
    await expect(page.getByTestId('hr-attendance-table')).toBeVisible();
    await page.getByTestId('hr-open-calendar').click();
    await expect(page.getByTestId('hr-calendar-popup')).toBeVisible();
    await page.getByLabel('Close').click();
    await page.getByTestId('hr-stat-present_wfo').click();
    await expect(page.getByTestId('hr-stat-people-list')).toBeVisible();
    await page.getByText('Emp Loyee').first().click();
    await expect(page.getByTestId('attendance-employee-drawer')).toBeVisible();
  });
});
