import { useQuery } from '@tanstack/react-query';
import { announcementsApi } from '../services/endpoints';

export function useAnnouncementUnread() {
  return useQuery({
    queryKey: ['announcements', 'unread'],
    queryFn: () => announcementsApi.unreadCount().then((r) => r.data.data?.count ?? 0),
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
}
