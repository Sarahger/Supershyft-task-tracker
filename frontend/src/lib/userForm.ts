import { departmentsApi } from '../services/endpoints';
import type { UserFormState } from '../components/users/UserFormModal';

export async function resolveUserDepartmentIds(
  form: UserFormState,
  departments: { id: number; name: string }[] | undefined,
) {
  const department_ids = [...form.department_ids];
  for (const name of form.new_department_names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const existing = departments?.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (!department_ids.includes(existing.id)) department_ids.push(existing.id);
    } else {
      const created = await departmentsApi.create({ name: trimmed });
      department_ids.push(created.data.data.id);
    }
  }
  return department_ids;
}
