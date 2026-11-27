import { departmentsApi } from '../services/endpoints';
export async function resolveUserDepartmentIds(form, departments) {
    const department_ids = [...form.department_ids];
    for (const name of form.new_department_names) {
        const trimmed = name.trim();
        if (!trimmed)
            continue;
        const existing = departments?.find((d) => d.name.toLowerCase() === trimmed.toLowerCase());
        if (existing) {
            if (!department_ids.includes(existing.id))
                department_ids.push(existing.id);
        }
        else {
            const created = await departmentsApi.create({ name: trimmed });
            department_ids.push(created.data.data.id);
        }
    }
    return department_ids;
}
