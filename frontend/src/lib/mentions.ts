export type MentionUser = {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  profile_picture?: string;
};

export function mentionDisplayName(user: MentionUser): string {
  return `${user.first_name} ${user.last_name}`;
}

export function mentionToken(user: MentionUser): string {
  return `@${mentionDisplayName(user)}`;
}

export function matchMentionUsers(users: MentionUser[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return users;
  return users.filter((u) => {
    const full = mentionDisplayName(u).toLowerCase();
    const emailLocal = u.email?.split('@')[0].toLowerCase() ?? '';
    return (
      full.includes(q)
      || u.first_name.toLowerCase().includes(q)
      || u.last_name.toLowerCase().includes(q)
      || emailLocal.includes(q)
    );
  });
}

export function extractMentionedUserIds(content: string, users: MentionUser[]): number[] {
  const ids = new Set<number>();
  for (const user of users) {
    if (content.includes(mentionToken(user))) {
      ids.add(user.id);
    }
  }
  return [...ids];
}

const MENTION_SPLIT = /(@[\w]+(?:\s[\w]+)?)/g;

export function splitCommentMentions(content: string): string[] {
  return content.split(MENTION_SPLIT).filter((part) => part.length > 0);
}

export function isMentionPart(part: string): boolean {
  return part.startsWith('@') && part.length > 1;
}
