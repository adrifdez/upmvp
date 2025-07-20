export function generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
}

export function getOrCreateSessionId(): string {
    const stored = sessionStorage.getItem('chatSessionId');
    if (stored) return stored;
    
    const newId = generateSessionId();
    sessionStorage.setItem('chatSessionId', newId);
    return newId;
}

export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
}

export function parseMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-base-300 px-1 rounded">$1</code>')
        .replace(/```([\s\S]*?)```/g, '<pre class="bg-base-300 p-2 rounded my-2 overflow-x-auto"><code>$1</code></pre>')
        .replace(/\n/g, '<br>');
}

export function getScoreBadgeClass(score: number): string {
    if (score >= 0.8) return 'badge-success';
    if (score >= 0.5) return 'badge-warning';
    return 'badge-ghost';
}

