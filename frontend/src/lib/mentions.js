export function mentionDisplayName(user) {
    return `${user.first_name} ${user.last_name}`;
}
export function mentionToken(user) {
    return `@${mentionDisplayName(user)}`;
}
export function matchMentionUsers(users, query) {
    const q = query.trim().toLowerCase();
    if (!q)
        return users;
    return users.filter((u) => {
        const full = mentionDisplayName(u).toLowerCase();
        const emailLocal = u.email?.split('@')[0].toLowerCase() ?? '';
        return (full.includes(q)
            || u.first_name.toLowerCase().includes(q)
            || u.last_name.toLowerCase().includes(q)
            || emailLocal.includes(q));
    });
}
export function extractMentionedUserIds(content, users) {
    const ids = new Set();
    for (const user of users) {
        if (content.includes(mentionToken(user))) {
            ids.add(user.id);
        }
    }
    return [...ids];
}
const MENTION_SPLIT = /(@[\w]+(?:\s[\w]+)?)/g;
export function splitCommentMentions(content) {
    return content.split(MENTION_SPLIT).filter((part) => part.length > 0);
}
export function isMentionPart(part) {
    return part.startsWith('@') && part.length > 1;
}
