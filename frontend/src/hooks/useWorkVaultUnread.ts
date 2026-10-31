import { useQuery } from '@tanstack/react-query';
import { workVaultApi } from '../services/endpoints';

export function useWorkVaultUnread() {
  return useQuery({
    queryKey: ['work-vault', 'unread'],
    queryFn: () => workVaultApi.unreadCount().then((r) => r.data.data?.count ?? 0),
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}
